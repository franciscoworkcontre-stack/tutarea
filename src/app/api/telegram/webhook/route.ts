import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, tasks, projects, workspaceMembers, taskStatuses, telegramInbox, workspaces, workspaceTelegramGroups } from "@/db/schema";
import { generateTelegramLinkToken } from "@/lib/telegram-token";
import { eq, and, gt } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { generateKeyBetween } from "fractional-indexing";

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
    voice?: { file_id: string; duration: number };
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

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

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
- "urgente", "asap", "ya" → priority "urgent"
- If the message is a status update, set intent "status_update"
- If it's unclear, set intent "unclear" and confidence < 0.4`;

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

export async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    }),
  });
}

async function handleGroupMessage(message: NonNullable<TelegramUpdate["message"]>) {
  const chatId = message.chat.id;
  const chatTitle = message.chat.title ?? "Grupo";
  const text = message.text;
  const senderTelegramId = message.from?.id.toString();

  // /link <workspace-slug> — link this group to a workspace
  if (text?.startsWith("/link")) {
    const slug = text.replace("/link", "").trim();
    if (!slug) {
      await sendTelegramMessage(chatId, "❌ Uso: `/link <workspace-slug>`\nEjemplo: `/link mi-empresa`");
      return;
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, slug),
    });

    if (!workspace) {
      await sendTelegramMessage(chatId, `❌ No encontré el workspace *${slug}*. Verifica el slug en tutarea.`);
      return;
    }

    await db
      .insert(workspaceTelegramGroups)
      .values({
        workspaceId: workspace.id,
        chatId: chatId.toString(),
        chatTitle,
      })
      .onConflictDoUpdate({
        target: workspaceTelegramGroups.chatId,
        set: { workspaceId: workspace.id, chatTitle },
      });

    await sendTelegramMessage(
      chatId,
      `✅ Grupo vinculado a *${workspace.name}*\n\nDe lunes a viernes a las 9 AM recibirán el resumen diario de tareas del equipo.`,
    );
    return;
  }

  // Any other group message: silently ignore (bot only speaks when spoken to or on schedule)
}

async function handlePrivateMessage(message: NonNullable<TelegramUpdate["message"]>) {
  const chatId = message.chat.id;
  const text = message.text;

  // Find user by telegram_chat_id
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.telegramChatId, chatId.toString()),
  });

  // Handle /start link_CODE
  if (text?.startsWith("/start link_")) {
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
      `✅ Vinculado a *${profileWithCode.fullName ?? "tu cuenta"}*. Envíame texto o un audio para crear una tarea.`,
    );
    return;
  }

  if (!profile) {
    const linkToken = generateTelegramLinkToken(chatId);
    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tutarea-vert.vercel.app";
    const linkUrl = `${appUrl}/auth/telegram?token=${linkToken}`;

    await sendTelegramMessage(
      chatId,
      "👋 ¡Hola! Soy el bot de *tutarea*.\n\nPara crear tareas desde aquí, necesito vincular este chat con tu cuenta. Es solo una vez. 👇",
      {
        inline_keyboard: [[{ text: "🔐 Vincular mi cuenta", url: linkUrl }]],
      },
    );
    return;
  }

  if (text === "/today") {
    await sendTelegramMessage(chatId, "📅 *Tus tareas de hoy*\n\nAbre la app para ver el detalle: https://tutarea-vert.vercel.app");
    return;
  }

  if (text === "/help") {
    await sendTelegramMessage(
      chatId,
      `*tutarea — Comandos*\n\n/today — Tareas de hoy\n/help — Esta ayuda\n\nO simplemente envía texto o un 🎙 audio para crear una tarea.`,
    );
    return;
  }

  if (text && !text.startsWith("/")) {
    try {
      const parsed = await parseTaskWithClaude(text);

      await db.insert(telegramInbox).values({
        userId: profile.id,
        messageId: message.message_id.toString(),
        type: "text",
        rawText: text,
        parsed: parsed as unknown as Record<string, unknown>,
        status: "parsed",
      });

      if (parsed.intent === "create_task" && parsed.confidence > 0.6) {
        const memberships = await db.query.workspaceMembers.findMany({
          where: eq(workspaceMembers.userId, profile.id),
          with: { workspace: true },
          limit: 1,
        });

        const membership = memberships[0];
        if (!membership) {
          await sendTelegramMessage(chatId, "❌ No tienes un workspace configurado.");
          return;
        }

        const workspaceProjects = await db.query.projects.findMany({
          where: and(eq(projects.workspaceId, membership.workspaceId), eq(projects.status, "active")),
          limit: 1,
        });

        const project = workspaceProjects[0];
        if (!project) {
          await sendTelegramMessage(chatId, "❌ No hay proyectos en tu workspace.");
          return;
        }

        const defaultStatus = await db.query.taskStatuses.findFirst({
          where: eq(taskStatuses.projectId, project.id),
          orderBy: [taskStatuses.position],
        });

        const taskCount = await db.query.tasks.findMany({ where: eq(tasks.projectId, project.id) });
        const taskKey = `${project.key}-${taskCount.length + 1}`;

        const [newTask] = await db
          .insert(tasks)
          .values({
            projectId: project.id,
            workspaceId: membership.workspaceId,
            key: taskKey,
            title: parsed.title,
            description: parsed.description ?? null,
            statusId: defaultStatus?.id ?? null,
            priority: (parsed.priority as "no_priority" | "low" | "medium" | "high" | "urgent") ?? "no_priority",
            position: generateKeyBetween(null, null),
            createdBy: profile.id,
            dueDate: null,
          })
          .returning();

        const priorityEmoji: Record<string, string> = {
          urgent: "🔴", high: "🟠", medium: "🟡", low: "🔵", no_priority: "⚪",
        };

        const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tutarea-vert.vercel.app";
        const taskUrl = `${appUrl}/app/${membership.workspace.slug}/projects/${project.id}/tasks/${newTask?.id}`;

        await sendTelegramMessage(
          chatId,
          `✅ *${parsed.title}*\n${priorityEmoji[parsed.priority] ?? "⚪"} ${parsed.priority} · 📁 ${project.name}\n\n[Ver tarea ${taskKey}](${taskUrl})`,
          { inline_keyboard: [[{ text: "✏️ Editar", url: taskUrl }]] },
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `¿Crear esto como tarea?\n\n*"${text}"*`,
          {
            inline_keyboard: [
              [
                { text: "✅ Sí, crear", callback_data: `confirm_task_${message.message_id}` },
                { text: "❌ No", callback_data: "dismiss" },
              ],
            ],
          },
        );
      }
    } catch (err) {
      console.error("Error parsing task:", err);
      await sendTelegramMessage(chatId, "❌ Error al procesar el mensaje. Inténtalo de nuevo.");
    }
  }
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env["TELEGRAM_WEBHOOK_SECRET"]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;

  if (!message) return NextResponse.json({ ok: true });

  const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";

  try {
    if (isGroup) {
      await handleGroupMessage(message);
    } else {
      await handlePrivateMessage(message);
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
