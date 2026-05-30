import { NextResponse } from "next/server";
import { db } from "@/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
import { eq, and, gt, lt, isNull } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { sendTelegramMessage, answerCallbackQuery, getTelegramFileUrl, downloadTelegramFile } from "@/lib/telegram";

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

type ProjectRow = typeof projects.$inferSelect;

// ── AI clients (dynamic imports — not bundled at cold start) ──

async function getAnthropic() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
}

async function getOpenAI() {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
}

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

// ── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  no_priority: "⚪",
};

const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tutarea-tusalarioio.vercel.app";

// ── AI helpers ──────────────────────────────────────────────────────────────

async function parseTaskWithClaude(text: string): Promise<ParsedTask> {
  const response = await (await getAnthropic()).messages.create({
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
  const audioUrl = await getTelegramFileUrl(fileId);
  const audioBuffer = await downloadTelegramFile(audioUrl);
  const audioFile = new File([new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" })], "voice.ogg", { type: "audio/ogg" });

  const transcription = await (await getOpenAI()).audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: "es",
  });

  return transcription.text;
}

// ── Context helper ──────────────────────────────────────────────────────────

async function getUserContext(chatId: number): Promise<UserContext | null> {
  const [profile] = await db.select().from(profiles)
    .where(eq(profiles.telegramChatId, chatId.toString()))
    .limit(1);
  if (!profile) return null;

  const [row] = await db
    .select({ member: workspaceMembers, workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, profile.id))
    .limit(1);
  if (!row) return null;

  return {
    profile,
    workspaceId: row.member.workspaceId,
    workspaceName: row.workspace.name,
    workspaceSlug: row.workspace.slug,
  };
}

// ── Project resolution ──────────────────────────────────────────────────────

async function getActiveProjects(workspaceId: string): Promise<ProjectRow[]> {
  return db.select().from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.status, "active")))
    .orderBy(projects.updatedAt)
    .limit(10);
}

function resolveProjectFromHint(projectList: ProjectRow[], hint: string | null | undefined): ProjectRow | undefined {
  if (!hint) return undefined;
  return projectList.find((p) => p.name.toLowerCase().includes(hint.toLowerCase()));
}

// ── Project selection keyboard ──────────────────────────────────────────────
// Saves pending task in telegramInbox and asks user to pick a project.
// Returns true so the caller knows to stop and wait for callback.

async function askProjectSelection(
  chatId: number,
  parsed: ParsedTask,
  projectList: ProjectRow[],
  ctx: UserContext,
  messageId: number,
  priority: string,
): Promise<void> {
  const [inbox] = await db
    .insert(telegramInbox)
    .values({
      userId: ctx.profile.id,
      messageId: messageId.toString(),
      type: "text",
      rawText: parsed.title,
      parsed: { ...parsed, _priority: priority } as unknown as Record<string, unknown>,
      status: "pending",
    })
    .returning();

  const inboxId = inbox!.id;

  // Telegram limits callback_data to 64 bytes — use short project IDs (UUID is 36 chars)
  // Format: sp_<inboxId_short>_<projectId_short> won't fit, so we store inboxId in callback
  // and rely on the full UUID in the DB. We'll use a truncated key: sp_<8chars>_<8chars>
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < projectList.length; i += 2) {
    const pair = projectList.slice(i, i + 2).map((p) => ({
      text: `📁 ${p.name}`,
      // sp = select_project; trim UUIDs to first 8 chars (collision risk is acceptable for UX)
      callback_data: `sp_${inboxId.slice(0, 8)}_${p.id.slice(0, 8)}`,
    }));
    rows.push(pair);
  }
  rows.push([{ text: "❌ Cancelar", callback_data: "dismiss" }]);

  await sendTelegramMessage(
    chatId,
    `📁 ¿En qué proyecto va esta tarea?\n\n*"${parsed.title}"*`,
    { inline_keyboard: rows },
  );
}

// ── Task creation ───────────────────────────────────────────────────────────

async function createTask(
  parsed: ParsedTask,
  project: ProjectRow,
  ctx: UserContext,
  messageId: number,
  priority: string,
  inboxId?: string,
) {
  const [defaultStatus] = await db.select().from(taskStatuses)
    .where(eq(taskStatuses.projectId, project.id))
    .orderBy(taskStatuses.position)
    .limit(1);

  const taskCount = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, project.id));
  const taskKey = `${project.key}-${taskCount.length + 1}`;
  const finalPriority = priority as "no_priority" | "low" | "medium" | "high" | "urgent";

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
      dueDate: null,
    })
    .returning();

  // Update inbox record if it exists, otherwise insert a new one
  if (inboxId) {
    await db.update(telegramInbox).set({ status: "converted", taskId: newTask!.id }).where(eq(telegramInbox.id, inboxId));
  } else {
    await db.insert(telegramInbox).values({
      userId: ctx.profile.id,
      messageId: messageId.toString(),
      type: "text",
      rawText: parsed.title,
      parsed: parsed as unknown as Record<string, unknown>,
      status: "converted",
      taskId: newTask!.id,
    });
  }

  return { task: newTask!, taskKey, priority: finalPriority };
}

// ── Unified "resolve project then create" flow ──────────────────────────────
// Returns false if it asked the user to pick a project (deferred), true if task was created.

async function resolveAndCreate(
  chatId: number,
  parsed: ParsedTask,
  ctx: UserContext,
  messageId: number,
  priority: string,
  transcript?: string,
): Promise<boolean> {
  const projectList = await getActiveProjects(ctx.workspaceId);

  if (projectList.length === 0) {
    await sendTelegramMessage(chatId, "❌ No hay proyectos activos en tu workspace.");
    return true;
  }

  // Try to match hint from Claude parse
  const matched = resolveProjectFromHint(projectList, parsed.project_hint);

  // Single project → use it directly; hint matched → use it; otherwise ask
  const project = projectList.length === 1 ? projectList[0]! : matched ?? null;

  if (!project) {
    // Multiple projects, no clear hint → ask user
    await askProjectSelection(chatId, parsed, projectList, ctx, messageId, priority);
    return false;
  }

  const { task, taskKey } = await createTask(parsed, project, ctx, messageId, priority);
  const taskUrl = `${APP_URL}/app/${ctx.workspaceSlug}/projects/${project.id}/tasks/${task.id}`;
  const suffix = transcript ? `\n\n_"${transcript}"_` : "";

  await sendTelegramMessage(
    chatId,
    `✅ *${parsed.title}*\n${PRIORITY_EMOJI[priority] ?? "⚪"} ${priority} · 📁 ${project.name}${suffix}`,
    { inline_keyboard: [[{ text: `📋 Ver ${taskKey}`, url: taskUrl }]] },
  );
  return true;
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleStart(chatId: number, text: string, message: NonNullable<TelegramUpdate["message"]>) {
  const code = text.replace("/start link_", "").trim();
  const [profileWithCode] = await db.select().from(profiles)
    .where(and(
      eq(profiles.telegramLinkCode, code),
      gt(profiles.telegramLinkCodeExpiresAt, new Date()),
    ))
    .limit(1);

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
    `Envíame un texto o audio para crear tareas, o usa /help para ver los comandos.`,
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

  await resolveAndCreate(chatId, parsed, ctx, messageId, priority);
}

async function handleMisTareas(chatId: number, ctx: UserContext) {
  const myTaskRows = await db
    .select({ task: tasks, project: projects })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.assigneeId, ctx.profile.id), isNull(tasks.archivedAt)))
    .orderBy(tasks.createdAt)
    .limit(5);

  if (myTaskRows.length === 0) {
    await sendTelegramMessage(chatId, "🎉 ¡No tienes tareas pendientes asignadas!");
    return;
  }

  const lines = myTaskRows.map(({ task: t, project: p }, i) => {
    const prio = PRIORITY_EMOJI[t.priority ?? "no_priority"] ?? "⚪";
    return `${i + 1}. ${prio} *${t.title}*\n   📁 ${p?.name ?? "—"} · \`${t.key}\``;
  });

  await sendTelegramMessage(chatId, `📋 *Tus tareas activas*\n\n${lines.join("\n\n")}`);
}

async function handleHoy(chatId: number, ctx: UserContext) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayTaskRows = await db
    .select({ task: tasks, project: projects })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(
      eq(tasks.workspaceId, ctx.workspaceId),
      eq(tasks.assigneeId, ctx.profile.id),
      isNull(tasks.archivedAt),
      gt(tasks.dueDate, today),
      lt(tasks.dueDate, tomorrow),
    ))
    .limit(10);

  if (todayTaskRows.length === 0) {
    await sendTelegramMessage(chatId, `📅 No tienes tareas con vencimiento hoy.\n\nUsa /mis_tareas para ver tus pendientes.`);
    return;
  }

  const lines = todayTaskRows.map(({ task: t, project: p }) => {
    const prio = PRIORITY_EMOJI[t.priority ?? "no_priority"] ?? "⚪";
    return `• ${prio} *${t.title}* — 📁 ${p?.name ?? "—"}`;
  });

  await sendTelegramMessage(chatId, `📅 *Tareas para hoy*\n\n${lines.join("\n")}`);
}

async function handleVencidas(chatId: number, ctx: UserContext) {
  const now = new Date();

  const overdueTaskRows = await db
    .select({ task: tasks, project: projects })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(
      eq(tasks.workspaceId, ctx.workspaceId),
      eq(tasks.assigneeId, ctx.profile.id),
      isNull(tasks.archivedAt),
      lt(tasks.dueDate, now),
    ))
    .limit(10);

  if (overdueTaskRows.length === 0) {
    await sendTelegramMessage(chatId, "✅ No tienes tareas vencidas. ¡Buen trabajo!");
    return;
  }

  const lines = overdueTaskRows.map(({ task: t, project: p }) => {
    const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString("es-CL") : "—";
    return `• 🔴 *${t.title}*\n  Venció: ${due} · 📁 ${p?.name ?? "—"}`;
  });

  await sendTelegramMessage(chatId, `⚠️ *Tareas vencidas (${overdueTaskRows.length})*\n\n${lines.join("\n\n")}`);
}

async function handleProyectos(chatId: number, ctx: UserContext) {
  const projectList = await getActiveProjects(ctx.workspaceId);

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
    `💡 También puedes enviarme un mensaje de texto o audio con lo que necesitas.`,
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

  await sendTelegramMessage(chatId, `📝 Escuché: _"${transcript}"_`);

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
        inline_keyboard: [[
          { text: "✅ Sí, crear", callback_data: `cv_${messageId}_${encodeURIComponent(transcript.slice(0, 30))}` },
          { text: "❌ No", callback_data: "dismiss" },
        ]],
      },
    );
    return;
  }

  await resolveAndCreate(chatId, parsed, ctx, messageId, parsed.priority || "medium", transcript);
}

async function handleFreeText(chatId: number, text: string, ctx: UserContext, messageId: number) {
  let parsed: ParsedTask;
  try {
    parsed = await parseTaskWithClaude(text);
  } catch {
    await sendTelegramMessage(chatId, "❌ Error al procesar el mensaje. Inténtalo de nuevo.");
    return;
  }

  if (parsed.intent === "create_task" && parsed.confidence > 0.6) {
    await resolveAndCreate(chatId, parsed, ctx, messageId, parsed.priority || "medium");
  } else {
    await sendTelegramMessage(
      chatId,
      `¿Crear esto como tarea?\n\n*"${text}"*`,
      {
        inline_keyboard: [[
          { text: "✅ Sí, crear", callback_data: `ct_${messageId}` },
          { text: "❌ No", callback_data: "dismiss" },
        ]],
      },
    );
    // Save pending text for confirmation
    await db.insert(telegramInbox).values({
      userId: ctx.profile.id,
      messageId: messageId.toString(),
      type: "text",
      rawText: text,
      parsed: parsed as unknown as Record<string, unknown>,
      status: "pending",
    });
  }
}

// ── Private message router ────────────────────────────────────────────────────

async function handlePrivateMessage(message: NonNullable<TelegramUpdate["message"]>) {
  const chatId = message.chat.id;
  const text = message.text ?? "";
  const messageId = message.message_id;

  if (text.startsWith("/start link_")) {
    await handleStart(chatId, text, message);
    return;
  }

  const ctx = await getUserContext(chatId);
  if (!ctx) {
    await sendTelegramMessage(
      chatId,
      "👋 ¡Hola! Soy el bot de *tutarea*.\n\nVincula tu cuenta para crear tareas desde aquí 👇",
      { inline_keyboard: [[{ text: "🔐 Vincular mi cuenta", url: `${APP_URL}/settings/integrations` }]] },
    );
    return;
  }

  if (message.voice) {
    await handleVoiceMessage(chatId, message.voice, ctx, messageId);
    return;
  }

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

  if (text?.match(/^\/link(@\w+)?(\s|$)/)) {
    const slug = text.replace(/^\/link(@\w+)?\s*/, "").trim();
    console.log("[group-link] slug:", slug, "chatId:", chatId);
    if (!slug) {
      await sendTelegramMessage(chatId, "❌ Uso: `/link <workspace-slug>`\nEjemplo: `/link mi-empresa`");
      return;
    }

    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
    console.log("[group-link] workspace found:", workspace?.id ?? "null");
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

    console.log("[group-link] inserted, sending reply");
    await sendTelegramMessage(
      chatId,
      `✅ Grupo vinculado a *${workspace.name}*\n\nDe lunes a viernes a las 9 AM recibirán el resumen diario de tareas del equipo.`,
    );
    console.log("[group-link] done");
  }
}

// ── Callback query handler ────────────────────────────────────────────────────

async function handleCallbackQuery(query: NonNullable<TelegramUpdate["callback_query"]>) {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  const data = query.data ?? "";

  await answerCallbackQuery(query.id);

  if (data === "dismiss") {
    await sendTelegramMessage(chatId, "👍 OK, cancelado.");
    return;
  }

  const ctx = await getUserContext(chatId);
  if (!ctx) return;

  // ── Project selection: sp_<inboxId8>_<projectId8> ──
  if (data.startsWith("sp_")) {
    const parts = data.slice(3).split("_");
    const inboxPrefix = parts[0]!;
    const projectPrefix = parts[1]!;

    // Find inbox record by prefix match
    const allInbox = await db.select().from(telegramInbox)
      .where(and(eq(telegramInbox.userId, ctx.profile.id), eq(telegramInbox.status, "pending")))
      .orderBy(telegramInbox.createdAt)
      .limit(20);
    const inbox = allInbox.find((r) => r.id.startsWith(inboxPrefix));
    if (!inbox) {
      await sendTelegramMessage(chatId, "❌ No encontré la tarea pendiente. Vuelve a intentarlo.");
      return;
    }

    // Find project by prefix match
    const projectList = await getActiveProjects(ctx.workspaceId);
    const project = projectList.find((p) => p.id.startsWith(projectPrefix));
    if (!project) {
      await sendTelegramMessage(chatId, "❌ No encontré ese proyecto.");
      return;
    }

    const inboxParsed = inbox.parsed as Record<string, unknown>;
    const priority = (inboxParsed["_priority"] as string | undefined) ?? (inboxParsed["priority"] as string | undefined) ?? "medium";
    const parsed: ParsedTask = {
      intent: "create_task",
      confidence: 1,
      title: (inboxParsed["title"] as string | undefined) ?? inbox.rawText ?? "Nueva tarea",
      description: (inboxParsed["description"] as string | undefined) ?? null,
      project_hint: null,
      assignee_hint: null,
      due_date_hint: null,
      priority,
      labels: [],
    };

    const { task, taskKey } = await createTask(parsed, project, ctx, parseInt(inbox.messageId), priority, inbox.id);
    const taskUrl = `${APP_URL}/app/${ctx.workspaceSlug}/projects/${project.id}/tasks/${task.id}`;

    await sendTelegramMessage(
      chatId,
      `✅ *${parsed.title}*\n${PRIORITY_EMOJI[priority] ?? "⚪"} ${priority} · 📁 ${project.name}`,
      { inline_keyboard: [[{ text: `📋 Ver ${taskKey}`, url: taskUrl }]] },
    );
    return;
  }

  // ── Confirm text task: ct_<messageId> ──
  if (data.startsWith("ct_")) {
    const messageId = parseInt(data.slice(3));
    const [inbox] = await db.select().from(telegramInbox)
      .where(and(
        eq(telegramInbox.userId, ctx.profile.id),
        eq(telegramInbox.messageId, messageId.toString()),
        eq(telegramInbox.status, "pending"),
      ))
      .limit(1);

    if (!inbox || !inbox.rawText) {
      await sendTelegramMessage(chatId, "❌ No encontré el mensaje original.");
      return;
    }

    const parsed: ParsedTask = {
      intent: "create_task",
      confidence: 1,
      title: inbox.rawText,
      description: null,
      project_hint: null,
      assignee_hint: null,
      due_date_hint: null,
      priority: "medium",
      labels: [],
    };

    await resolveAndCreate(chatId, parsed, ctx, messageId, "medium");
    await db.update(telegramInbox).set({ status: "converted" }).where(eq(telegramInbox.id, inbox.id));
    return;
  }

  // ── Confirm voice task: cv_<messageId>_<encodedTitle> ──
  if (data.startsWith("cv_")) {
    const rest = data.slice(3);
    const underscoreIdx = rest.indexOf("_");
    const messageId = parseInt(rest.slice(0, underscoreIdx));
    const title = decodeURIComponent(rest.slice(underscoreIdx + 1));

    const parsed: ParsedTask = {
      intent: "create_task",
      confidence: 1,
      title,
      description: null,
      project_hint: null,
      assignee_hint: null,
      due_date_hint: null,
      priority: "medium",
      labels: [],
    };

    await resolveAndCreate(chatId, parsed, ctx, messageId, "medium");
  }
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  console.log("[webhook-entry] handler started");
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = process.env["TELEGRAM_WEBHOOK_SECRET"];
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    console.error("[webhook-entry] failed to parse JSON");
    return NextResponse.json({ ok: true });
  }

  console.log("[webhook]", JSON.stringify({
    type: update.callback_query ? "callback" : update.message ? "message" : "other",
    chat_type: update.message?.chat.type,
    text: update.message?.text?.slice(0, 80),
  }));

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
