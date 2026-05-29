import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, taskStatuses, profiles, workspaceMembers } from "@/db/schema";
import { and, isNull, lte, gte, isNotNull } from "drizzle-orm";
import { sendTelegramMessage } from "@/lib/telegram";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatDueDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()] ?? ""} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Fetch all task statuses to know which are "done"
  const allStatuses = await db.query.taskStatuses.findMany();
  const doneStatusIds = new Set(allStatuses.filter((s) => s.type === "done").map((s) => s.id));

  // Find tasks due within next 24 hours, not archived, with an assignee
  const upcomingTasks = await db.query.tasks.findMany({
    where: and(
      isNull(tasks.archivedAt),
      isNotNull(tasks.assigneeId),
      isNotNull(tasks.dueDate),
      gte(tasks.dueDate, now),
      lte(tasks.dueDate, in24h),
    ),
    with: {
      status: true,
    },
  });

  // Filter out already-done tasks
  const pendingTasks = upcomingTasks.filter(
    (t) => !doneStatusIds.has(t.statusId ?? "")
  );

  if (pendingTasks.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Group tasks by assignee
  const tasksByAssignee = new Map<string, typeof pendingTasks>();
  for (const task of pendingTasks) {
    if (!task.assigneeId) continue;
    const existing = tasksByAssignee.get(task.assigneeId) ?? [];
    existing.push(task);
    tasksByAssignee.set(task.assigneeId, existing);
  }

  let sentCount = 0;

  for (const [assigneeId, assigneeTasks] of tasksByAssignee) {
    // Get the user's profile to find their Telegram chat ID
    const profile = await db.query.profiles.findFirst({
      where: (profiles, { eq }) => eq(profiles.id, assigneeId),
    });

    if (!profile?.telegramChatId) continue;

    const chatId = parseInt(profile.telegramChatId, 10);
    if (isNaN(chatId)) continue;

    const firstName = profile.fullName?.split(" ")[0] ?? "Hola";

    const lines: string[] = [];
    lines.push(`⏰ *Tareas vencen en las próximas 24h, ${firstName}*\n`);

    for (const task of assigneeTasks) {
      const due = task.dueDate ? formatDueDate(new Date(task.dueDate)) : "—";
      const statusName = task.status?.name ?? "Sin estado";
      lines.push(`• *${task.key}* ${task.title}`);
      lines.push(`  📅 Vence: ${due} · ${statusName}`);
    }

    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tutarea-vert.vercel.app";
    lines.push(`\n[Ver mis tareas](${appUrl}/app)`);

    try {
      await sendTelegramMessage(chatId, lines.join("\n"));
      sentCount++;
    } catch (err) {
      console.error(`Failed to send due-alert to chatId ${chatId}:`, err);
    }
  }

  return NextResponse.json({ sent: sentCount });
}
