import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  profiles,
  tasks,
  projects,
  workspaceMembers,
  taskStatuses,
  telegramInbox,
  workspaces,
  workspaceTelegramGroups,
} from "@/db/schema";
import { eq, and, gt, lt, isNull, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { generateKeyBetween } from "fractional-indexing";
import { sendTelegramMessage } from "@/lib/telegram";

// ── Types ──────────────────────────────────────────────────────────────────

type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
};

type TelegramUpdate = {
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: TelegramChat;
    text?: string;
    voice?: { file_id: string; duration: number; mime_type?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { chat: TelegramChat; message_id: number };
    data?: string;
  };
};

type ParsedTask = {
  intent: string;
  confidence: number;
  title: string;
  description?: string | null;
  project_hint?: string | null;
  assignee_hint?: string | null;
  due_date_hint?: string | null;
  priority: string;
  labels: string[];
};

type UserContext = {
  profile: typeof profiles.$inferSelect;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
};

// ── AI clients ──────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

const SYSTEM_PROMPT = `You are a task extractor for a project management tool. The user sends short messages in Spanish (Chilean/Mexican) or English. Extract a single task. Return ONLY valid JSON, no prose.

Schema:
{
  "intent": "create_task" | "comment" | "status_update" | "unclear",
  "confidence": 0.0-1.0,
  "title": string,
  "description": string|null,
  "project_hint": string|null,
  "assignee_hint": string|null,
  "due_date_hint": string|null,
  "priority": "no_priority"|"low"|"medium"|"high"|"urgent",
  "labels": string[]
}

Rules:
- "urgente", "asap", "ya", "crítico", "bloqueante" → priority "urgent"
- "importante", "alto" → priority "high"
- If the message is a status update, set intent "status_update"
- If it's unclear, set intent "unclear" and confidence < 0.4`;

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  no_priority: "⚪",
};

const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tutarea-tusalarioio.vercel.app";
const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]!;

async function parseTaskWithClaude(text: string): Promise<ParsedTask> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });
  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("No text response");
  return JSON.parse(content.text) as ParsedTask;
}

async function transcribeVoice(fileId: string): Promise<string> {
  // 1. Get file path from Telegram
  const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string } };
  if (!fileData.ok || !fileData.result?.file_path) throw new Error("Could not get file path");

  // 2. Download the OGG audio
  const audioUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
  const audioRes = await fetch(audioUrl);
  const audioBuffer = await audioRes.arrayBuffer();
  const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });
  const audioFile = new File([audioBlob], "voice.ogg", { type: "audio/ogg" });

  // 3. Transcribe with Whisper
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: "es",
  });

  return transcription.text;
}

async function getUserContext(chatId: number): Promise<UserContext | null> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.telegramChatId, chatId.toString()),
  });
  if (!profile) return null;

  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, profile.id),
    with: { workspace: true },
  });
  if (!membership) return null;

  return {
    profile,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
  };
}

async function createTaskFromParsed(
  parsed: ParsedTask,
  ctx: UserContext,
  messageId: number,
  projectHint?: string,
  priority?: string,
  assigneeId?: string,
) {
  const projectList = await db.query.projects.findMany({
    where: and(eq(projects.workspaceId, ctx.workspaceId), eq(projects.status, "active")),
    limit: 10,
  });

  let project = projectList[0];
  if (projectHint) {
    const match = projectList.find((p) =>
      p.name.toLowerCase().includes(projectHint.toLowerCase()),
    );
    if (match) project = match;
  } else if (parsed.project_hint) {
    const match = projectList.find((p) =>
      p.name.toLowerCase().includes(parsed.project_hint!.toLowerCase()),
    );
    if (match) project = match;
  }

  if (!project) return null;

  const defaultStatus = await db.query.taskStatuses.findFirst({
    where: eq(taskStatuses.projectId, project.id),
    orderBy: [taskStatuses.position],
  });

  const taskCount = await db.query.tasks.findMany({ where: eq(tasks.projectId, project.id) });
  const taskKey = `${project.key}-${taskCount.length + 1}`;
  const finalPriority = (priority ?? parsed.priority ?? "no_priority") as
    | "no_priority" | "low" | "medium" | "high" | "urgent";

  const [newTask] = await db
    .insert(tasks)
    .values({
      projectId: project.id,
      workspaceId: ctx.workspaceId,
      key: taskKey,
      title: parsed.title,
      description: parsed.description ?? null,
      statusId: defaultStatus?.id ?? null,
      priority: finalPriority,
      position: generateKeyBetween(null, null),
      createdBy: ctx.profile.id,
      assigneeId: assigneeId ?? null,
      dueDate: null,
    })
    .returning();

  await db.insert(telegramInbox).values({
    userId: ctx.profile.id,
    messageId: messageId.toString(),
    type: "text",
    rawText: parsed.title,
    parsed: parsed as unknown as Record<string, unknown>,
    status: "converted",
  });

  return { task: newTask!, project, taskKey, priority: finalPriority };
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleStart(chatId: number, text: string, message: NonNullable<TelegramUpdate["message"]>) {
  const code = text.replace("/start link_", "").trim();
  const profileWithCode = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.telegramLinkCode, code),
      gt(profiles.telegramLinkCodeExpiresAt, new Date()),
    ),
  });

  if (!profileWithCode) {
    await sendTelegramMessage(chatId, "❌ Código inválido o expirado. Genera uno nuevo desde la app.");
    return;
  }

  await db
    .update(profiles)
    .set({
      telegramChatId: chatId.toString(),
      telegramUsername: message.from?.username ?? null,
      telegramLinkedAt: new Date(),
      telegramLinkCode: null,
      telegramLinkCodeExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profileWithCode.id));

  await sendTelegramMessage(
    chatId,
    `✅ ¡Cuenta vinculada exitosamente, *${profileWithCode.fullName ?? "hola"}*!\n\n` +
    `Ahora puedes crear tareas directamente desde aquí.\n\n` +
    `💡 Envíame un audio o texto con lo que necesitas hacer, o usa /help para ver los comandos.`,
  );
}

async function handleTarea(chatId: number, title: string, ctx: UserContext, messageId: number, priority = "medium") {
  if (!title.trim()) {
    await sendTelegramMessage(chatId, "❌ Escribe el título de la tarea.\n\nEjemplo: `/tarea Revisar propuesta de diseño`");
    return;
  }

  const parsed: ParsedTask = {
    intent: "create_task",
    confidence: 1,
    title: title.trim(),
    description: null,
    project_hint: null,
    assignee_hint: null,
    due_date_hint: null,
    priority,
    labels: [],
  };

  const result = await createTaskFromParsed(parsed, ctx, messageId);
  if (!result) {
    await sendTelegramMessage(chatId, "❌ No hay proyectos activos en tu workspace.");
    return;
  }

  const { task, project, taskKey } = result;
  const taskUrl = `${APP_URL}/app/${ctx.workspaceSlug}/projects/${project.id}/tasks/${task.id}`;

  await sendTelegramMessage(
    chatId,
    `✅ *${parsed.title}*\n${PRIORITY_EMOJI[priority]} ${priority} · 📁 ${project.name}`,
    { inline_keyboard: [[{ text: `📋 Ver ${taskKey}`, url: taskUrl }]] },
  );
}

async function handleMisTareas(chatId: number, ctx: UserContext) {
  const myTasks = await db.query.tasks.findMany({
    where: and(eq(tasks.assigneeId, ctx.profile.id), isNull(tasks.archivedAt)),
    orderBy: [tasks.createdAt],
    limit: 5,
    with: { project: true },
  });

  if (myTasks.length === 0) {
    await sendTelegramMessage(chatId, "🎉 ¡No tienes tareas pendientes asignadas!\n\nUsa /proyectos para ver los proyectos.");
    return;
  }

  const lines = myTasks.map((t, i) => {
    const prio = PRIORITY_EMOJI[t.priority ?? "no_priority"] ?? "⚪";
    return `${i + 1}. ${prio} *${t.title}*\n   📁 ${t.project?.name ?? "—"} · \`${t.key}\``;
  });

  await sendTelegramMessage(chatId, `📋 *Tus tareas activas*\n\n${lines.join("\n\n")}`);
}

async function handleHoy(chatId: number, ctx: UserContext) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.workspaceId, ctx.workspaceId),
      eq(tasks.assigneeId, ctx.profile.id),
      isNull(tasks.archivedAt),
      gt(tasks.dueDate, today),
      lt(tasks.dueDate, tomorrow),
    ),
    with: { project: true },
    limit: 10,
  });

  if (todayTasks.length === 0) {
    await sendTelegramMessage(chatId, `📅 *Hoy no tienes tareas con vencimiento para hoy.*\n\nUsa /mis_tareas para ver tus pendientes.`);
    return;
  }

  const lines = todayTasks.map((t) => {
    const prio = PRIORITY_EMOJI[t.priority ?? "no_priority"] ?? "⚪";
    return `• ${prio} *${t.title}* — 📁 ${t.project?.name ?? "—"}`;
  });

  await sendTelegramMessage(chatId, `📅 *Tareas para hoy*\n\n${lines.join("\n")}`);
}

async function handleVencidas(chatId: number, ctx: UserContext) {
  const now = new Date();

  const overdueTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.workspaceId, ctx.workspaceId),
      eq(tasks.assigneeId, ctx.profile.id),
      isNull(tasks.archivedAt),
      lt(tasks.dueDate, now),
    ),
    with: { project: true },
    limit: 10,
  });

  if (overdueTasks.length === 0) {
    await sendTelegramMessage(chatId, "✅ No tienes tareas vencidas. ¡Buen trabajo!");
    return;
  }

  const lines = overdueTasks.map((t) => {
    const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString("es-CL") : "—";
    return `• 🔴 *${t.title}*\n  Venció: ${due} · 📁 ${t.project?.name ?? "—"}`;
  });

  await sendTelegramMessage(chatId, `⚠️ *Tareas vencidas (${overdueTasks.length})*\n\n${lines.join("\n\n")}`);
}

async function handleProyectos(chatId: number, ctx: UserContext) {
  const projectList = await db.query.projects.findMany({
    where: and(eq(projects.workspaceId, ctx.workspaceId), eq(projects.status, "active")),
    limit: 15,
  });

  if (projectList.length === 0) {
    await sendTelegramMessage(chatId, "❌ No hay proyectos activos en tu workspace.");
    return;
  }

  const lines = projectList.map((p) => `• *${p.name}* (\`${p.key}\`)`);
  await sendTelegramMessage(
    chatId,
    `📁 *Proyectos activos en ${ctx.workspaceName}*\n\n${lines.join("\n")}\n\n[Abrir workspace](${APP_URL}/app/${ctx.workspaceSlug})`,
  );
}

async function handleNota(chatId: number, nota: string, ctx: UserContext, messageId: number) {
  if (!nota.trim()) {
    await sendTelegramMessage(chatId, "❌ Escribe el contenido de la nota.\n\nEjemplo: `/nota Llamar a proveedor el lunes`");
    return;
  }

  await db.insert(telegramInbox).values({
    userId: ctx.profile.id,
    messageId: messageId.toString(),
    type: "text",
    rawText: nota.trim(),
    parsed: { intent: "note", title: nota.trim() },
    status: "parsed",
  });

  await sendTelegramMessage(chatId, `📝 *Nota guardada*\n\n"${nota.trim()}"`);
}

async function handleHelp(chatId: number) {
  await sendTelegramMessage(
    chatId,
    `*tutarea — Comandos disponibles* 🤖\n\n` +
    `*Crear tareas:*\n` +
    `/tarea _[título]_ — Crear tarea nueva\n` +
    `/urgente _[título]_ — Crear tarea urgente 🔴\n` +
    `🎙 _Nota de voz_ — Dicta una tarea y la creo automáticamente\n\n` +
    `*Ver tareas:*\n` +
    `/mis_tareas — Tus 5 tareas activas\n` +
    `/hoy — Tareas con vencimiento hoy\n` +
    `/vencidas — Tareas que ya vencieron\n\n` +
    `*Workspace:*\n` +
    `/proyectos — Lista de proyectos activos\n` +
    `/nota _[texto]_ — Guardar nota rápida\n\n` +
    `💡 También puedes simplemente enviarme un mensaje con lo que necesitas y lo convierto en tarea.`,
  );
}

async function handleVoiceMessage(
  chatId: number,
  voice: NonNullable<TelegramUpdate["message"]>["voice"],
  ctx: UserContext,
  messageId: number,
) {
  if (!voice) return;

  await sendTelegramMessage(chatId, "🎙 Transcribiendo tu nota de voz...");

  let transcript: string;
  try {
    transcript = await transcribeVoice(voice.file_id);
  } catch (err) {
    console.error("Whisper error:", err);
    await sendTelegramMessage(chatId, "❌ No pude transcribir el audio. Intenta de nuevo o escribe la tarea.");
    return;
  }

  if (!transcript.trim()) {
    await sendTelegramMessage(chatId, "❌ No entendí el audio. Intenta hablar más claro.");
    return;
  }

  await sendTelegramMessage(chatId, `📝 Escuché: _"${transcript}"_\n\nCreando tarea...`);

  let parsed: ParsedTask;
  try {
    parsed = await parseTaskWithClaude(transcript);
  } catch {
    parsed = {
      intent: "create_task",
      confidence: 0.8,
      title: transcript,
      description: null,
      project_hint: null,
      assignee_hint: null,
      due_date_hint: null,
      priority: "medium",
      labels: [],
    };
  }

  if (parsed.confidence < 0.4 || parsed.intent === "unclear") {
    await sendTelegramMessage(
      chatId,
      `❓ ¿Crear esto como tarea?\n\n*"${transcript}"*`,
      {
        inline_keyboard: [
          [
            { text: "✅ Sí, crear", callback_data: `confirm_voice_${messageId}_${encodeURIComponent(transcript)}` },
            { text: "❌ No", callback_data: "dismiss" },
          ],
        ],
      },
    );
    return;
  }

  const result = await createTaskFromParsed(parsed, ctx, messageId);
  if (!result) {
    await sendTelegramMessage(chatId, "❌ No hay proyectos activos en tu workspace.");
    return;
  }

  const { task, project, taskKey, priority } = result;
  const taskUrl = `${APP_URL}/app/${ctx.workspaceSlug}/projects/${project.id}/tasks/${task.id}`;

  await sendTelegramMessage(
    chatId,
    `✅ *${parsed.title}*\n${PRIORITY_EMOJI[priority]} ${priority} · 📁 ${project.name}\n\n_Transcripción: "${transcript}"_`,
    { inline_keyboard: [[{ text: `📋 Ver ${taskKey}`, url: taskUrl }]] },
  );
}

async function handleFreeText(chatId: number, text: string, ctx: UserContext, messageId: number) {
  let parsed: ParsedTask;
  try {
    parsed = await parseTaskWithClaude(text);
  } catch {
    await sendTelegramMessage(chatId, "❌ Error al procesar el mensaje. Inténtalo de nuevo.");
    return;
  }

  await db.insert(telegramInbox).values({
    userId: ctx.profile.id,
    messageId: messageId.toString(),
    type: "text",
    rawText: text,
    parsed: parsed as unknown as Record<string, unknown>,
    status: "parsed",
  });

  if (parsed.intent === "create_task" && parsed.confidence > 0.6) {
    const result = await createTaskFromParsed(parsed, ctx, messageId);
    if (!result) {
      await sendTelegramMessage(chatId, "❌ No hay proyectos activos en tu workspace.");
      return;
    }

    const { task, project, taskKey, priority } = result;
    const taskUrl = `${APP_URL}/app/${ctx.workspaceSlug}/projects/${project.id}/tasks/${task.id}`;

    await sendTelegramMessage(
      chatId,
      `✅ *${parsed.title}*\n${PRIORITY_EMOJI[priority]} ${priority} · 📁 ${project.name}`,
      { inline_keyboard: [[{ text: `📋 Ver ${taskKey}`, url: taskUrl }]] },
    );
  } else {
    await sendTelegramMessage(
      chatId,
      `¿Crear esto como tarea?\n\n*"${text}"*`,
      {
        inline_keyboard: [
          [
            { text: "✅ Sí, crear", callback_data: `confirm_task_${messageId}` },
            { text: "❌ No", callback_data: "dismiss" },
          ],
        ],
      },
    );
  }
}

// ── Private message router ────────────────────────────────────────────────────

async function handlePrivateMessage(message: NonNullable<TelegramUpdate["message"]>) {
  const chatId = message.chat.id;
  const text = message.text ?? "";
  const messageId = message.message_id;

  // Linking flow — no auth required
  if (text.startsWith("/start link_")) {
    await handleStart(chatId, text, message);
    return;
  }

  // Unlinked user
  const ctx = await getUserContext(chatId);
  if (!ctx) {
    const appUrl = APP_URL;
    await sendTelegramMessage(
      chatId,
      "👋 ¡Hola! Soy el bot de *tutarea*.\n\nVincula tu cuenta para crear tareas desde aquí. Es solo una vez 👇",
      { inline_keyboard: [[{ text: "🔐 Vincular mi cuenta", url: `${appUrl}/settings/integrations` }]] },
    );
    return;
  }

  // Voice note
  if (message.voice) {
    await handleVoiceMessage(chatId, message.voice, ctx, messageId);
    return;
  }

  // Commands
  if (text.startsWith("/tarea ")) {
    await handleTarea(chatId, text.slice(7), ctx, messageId, "medium");
  } else if (text === "/tarea") {
    await handleTarea(chatId, "", ctx, messageId, "medium");
  } else if (text.startsWith("/urgente ")) {
    await handleTarea(chatId, text.slice(9), ctx, messageId, "urgent");
  } else if (text === "/urgente") {
    await handleTarea(chatId, "", ctx, messageId, "urgent");
  } else if (text === "/mis_tareas" || text === "/mistareas") {
    await handleMisTareas(chatId, ctx);
  } else if (text === "/hoy" || text === "/today") {
    await handleHoy(chatId, ctx);
  } else if (text === "/vencidas") {
    await handleVencidas(chatId, ctx);
  } else if (text === "/proyectos") {
    await handleProyectos(chatId, ctx);
  } else if (text.startsWith("/nota ")) {
    await handleNota(chatId, text.slice(6), ctx, messageId);
  } else if (text === "/nota") {
    await handleNota(chatId, "", ctx, messageId);
  } else if (text === "/help" || text === "/start") {
    await handleHelp(chatId);
  } else if (text && !text.startsWith("/")) {
    await handleFreeText(chatId, text, ctx, messageId);
  }
}

// ── Group message router ──────────────────────────────────────────────────────

async function handleGroupMessage(message: NonNullable<TelegramUpdate["message"]>) {
  const chatId = message.chat.id;
  const chatTitle = message.chat.title ?? "Grupo";
  const text = message.text;

  if (text?.startsWith("/link")) {
    const slug = text.replace("/link", "").trim();
    if (!slug) {
      await sendTelegramMessage(chatId, "❌ Uso: `/link <workspace-slug>`\nEjemplo: `/link mi-empresa`");
      return;
    }

    const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.slug, slug) });
    if (!workspace) {
      await sendTelegramMessage(chatId, `❌ No encontré el workspace *${slug}*. Verifica el slug en tutarea.`);
      return;
    }

    await db
      .insert(workspaceTelegramGroups)
      .values({ workspaceId: workspace.id, chatId: chatId.toString(), chatTitle })
      .onConflictDoUpdate({
        target: workspaceTelegramGroups.chatId,
        set: { workspaceId: workspace.id, chatTitle },
      });

    await sendTelegramMessage(
      chatId,
      `✅ Grupo vinculado a *${workspace.name}*\n\nDe lunes a viernes a las 9 AM recibirán el resumen diario de tareas del equipo.`,
    );
  }
}

// ── Callback query handler ────────────────────────────────────────────────────

async function handleCallbackQuery(query: NonNullable<TelegramUpdate["callback_query"]>) {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  const data = query.data ?? "";

  // Answer callback to remove loading spinner
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: query.id }),
  });

  if (data === "dismiss") {
    await sendTelegramMessage(chatId, "👍 OK, cancelado.");
    return;
  }

  if (data.startsWith("confirm_voice_")) {
    // confirm_voice_<messageId>_<encodedText>
    const parts = data.replace("confirm_voice_", "").split("_");
    const messageId = parseInt(parts[0] ?? "0");
    const transcript = decodeURIComponent(parts.slice(1).join("_"));

    const ctx = await getUserContext(chatId);
    if (!ctx) return;

    const parsed: ParsedTask = {
      intent: "create_task",
      confidence: 1,
      title: transcript,
      description: null,
      project_hint: null,
      assignee_hint: null,
      due_date_hint: null,
      priority: "medium",
      labels: [],
    };

    const result = await createTaskFromParsed(parsed, ctx, messageId);
    if (!result) {
      await sendTelegramMessage(chatId, "❌ No hay proyectos activos en tu workspace.");
      return;
    }

    const { task, project, taskKey, priority } = result;
    const taskUrl = `${APP_URL}/app/${ctx.workspaceSlug}/projects/${project.id}/tasks/${task.id}`;

    await sendTelegramMessage(
      chatId,
      `✅ *${transcript}*\n${PRIORITY_EMOJI[priority]} ${priority} · 📁 ${project.name}`,
      { inline_keyboard: [[{ text: `📋 Ver ${taskKey}`, url: taskUrl }]] },
    );
  }
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env["TELEGRAM_WEBHOOK_SECRET"]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.message) {
      const isGroup =
        update.message.chat.type === "group" || update.message.chat.type === "supergroup";
      if (isGroup) {
        await handleGroupMessage(update.message);
      } else {
        await handlePrivateMessage(update.message);
      }
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
