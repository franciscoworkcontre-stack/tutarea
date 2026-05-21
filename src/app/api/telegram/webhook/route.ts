import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, tasks, projects, workspaceMembers, taskStatuses, telegramInbox } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { generateKeyBetween } from "fractional-indexing";

type TelegramUpdate = {
  message?: {
    message_id: number;
    from?: { id: number; username?: string };
    chat: { id: number };
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

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: unknown) {
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

export async function POST(request: Request) {
  // Verify secret
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env["TELEGRAM_WEBHOOK_SECRET"]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;

  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const telegramUserId = message.from?.id.toString();
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
        gt(profiles.telegramLinkCodeExpiresAt, new Date())
      ),
    });

    if (!profileWithCode) {
      await sendTelegramMessage(chatId, "❌ Código inválido o expirado. Genera uno nuevo desde la app.");
      return NextResponse.json({ ok: true });
    }

    await db.update(profiles)
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
      `✅ Vinculado a *${profileWithCode.fullName ?? "tu cuenta"}*. Envíame texto o un audio para crear una tarea.`
    );
    return NextResponse.json({ ok: true });
  }

  if (!profile) {
    await sendTelegramMessage(
      chatId,
      "👋 Hola! Para usar tutarea desde Telegram, primero vincula tu cuenta desde *Configuración → Telegram* en la app."
    );
    return NextResponse.json({ ok: true });
  }

  // Handle /today command
  if (text === "/today") {
    await sendTelegramMessage(chatId, "📅 *Tus tareas de hoy*\n\nAbre la app para ver el detalle: https://app.tutarea.com");
    return NextResponse.json({ ok: true });
  }

  // Handle /help command
  if (text === "/help") {
    await sendTelegramMessage(
      chatId,
      `*tutarea — Comandos*\n\n/today — Tareas de hoy\n/inbox — Notificaciones\n/tasks — Mis tareas\n/help — Esta ayuda\n\nO simplemente envía texto o un 🎙 audio para crear una tarea.`
    );
    return NextResponse.json({ ok: true });
  }

  // Parse text message
  if (text && !text.startsWith("/")) {
    try {
      const parsed = await parseTaskWithClaude(text);

      // Log to telegram_inbox
      await db.insert(telegramInbox).values({
        userId: profile.id,
        messageId: message.message_id.toString(),
        type: "text",
        rawText: text,
        parsed: parsed as unknown as Record<string, unknown>,
        status: "parsed",
      });

      if (parsed.intent === "create_task" && parsed.confidence > 0.6) {
        // Find workspace
        const memberships = await db.query.workspaceMembers.findMany({
          where: eq(workspaceMembers.userId, profile.id),
          with: { workspace: true },
          limit: 1,
        });

        const membership = memberships[0];
        if (!membership) {
          await sendTelegramMessage(chatId, "❌ No tienes un workspace configurado.");
          return NextResponse.json({ ok: true });
        }

        // Find project
        const workspaceProjects = await db.query.projects.findMany({
          where: and(
            eq(projects.workspaceId, membership.workspaceId),
            eq(projects.status, "active")
          ),
          limit: 1,
        });

        const project = workspaceProjects[0];
        if (!project) {
          await sendTelegramMessage(chatId, "❌ No hay proyectos en tu workspace.");
          return NextResponse.json({ ok: true });
        }

        // Get default status
        const defaultStatus = await db.query.taskStatuses.findFirst({
          where: eq(taskStatuses.projectId, project.id),
          orderBy: [taskStatuses.position],
        });

        // Count tasks for key
        const taskCount = await db.query.tasks.findMany({
          where: eq(tasks.projectId, project.id),
        });

        const taskKey = `${project.key}-${taskCount.length + 1}`;

        // Create task
        const [newTask] = await db.insert(tasks).values({
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
        }).returning();

        const priorityEmoji: Record<string, string> = {
          urgent: "🔴",
          high: "🟠",
          medium: "🟡",
          low: "🔵",
          no_priority: "⚪",
        };

        const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://app.tutarea.com";
        const taskUrl = `${appUrl}/app/${membership.workspace.slug}/projects/${project.id}/tasks/${newTask?.id}`;

        await sendTelegramMessage(
          chatId,
          `✅ *${parsed.title}*\n${priorityEmoji[parsed.priority] ?? "⚪"} ${parsed.priority} · 📁 ${project.name}\n\n[Ver tarea ${taskKey}](${taskUrl})`,
          {
            inline_keyboard: [
              [
                { text: "✏️ Editar", url: taskUrl },
              ],
            ],
          }
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
          }
        );
      }
    } catch (err) {
      console.error("Error parsing task:", err);
      await sendTelegramMessage(chatId, "❌ Error al procesar el mensaje. Inténtalo de nuevo.");
    }
  }

  return NextResponse.json({ ok: true });
}
