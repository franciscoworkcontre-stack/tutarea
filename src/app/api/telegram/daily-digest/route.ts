import { NextResponse } from "next/server";
import { db } from "@/db";
import { workspaceTelegramGroups, workspaceMembers, tasks, taskStatuses, profiles, workspaces } from "@/db/schema";
import { eq, and, isNull, lt, inArray } from "drizzle-orm";
import { sendTelegramMessage } from "@/lib/telegram";

const WEEKDAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatDate(d: Date): string {
  const day = WEEKDAYS_ES[d.getDay()] ?? "";
  return `${day.charAt(0).toUpperCase() + day.slice(1)} ${d.getDate()} ${MONTHS_ES[d.getMonth()] ?? ""}`;
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await db.select().from(workspaceTelegramGroups);

  const now = new Date();
  const results: { chatId: string; sent: boolean; error?: string }[] = [];

  for (const group of groups) {
    try {
      await sendDigestToGroup(group.chatId, group.workspaceId, now);
      results.push({ chatId: group.chatId, sent: true });
    } catch (err) {
      console.error(`Digest failed for group ${group.chatId}:`, err);
      results.push({ chatId: group.chatId, sent: false, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, results });
}

async function sendDigestToGroup(chatId: string, workspaceId: string, now: Date) {
  // Get all workspace members
  const members = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));

  if (members.length === 0) return;

  // Fetch workspace for slug
  const [workspaceRow] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);

  // Get all task statuses for this workspace
  const allStatuses = await db.select().from(taskStatuses).where(eq(taskStatuses.workspaceId, workspaceId));

  const doneStatusIds = new Set(allStatuses.filter((s) => s.type === "done").map((s) => s.id));
  const inProgressStatusIds = new Set(allStatuses.filter((s) => s.type === "in_progress").map((s) => s.id));

  // Get all non-done tasks for this workspace
  const allTasksRaw = await db.select().from(tasks).where(and(
    eq(tasks.workspaceId, workspaceId),
    isNull(tasks.archivedAt),
  ));

  // Attach status to tasks
  const statusMap = new Map(allStatuses.map((s) => [s.id, s]));
  const allTasks = allTasksRaw.map((t) => ({ ...t, status: t.statusId ? statusMap.get(t.statusId) ?? null : null }));
  const activeTasks = allTasks.filter((t) => !doneStatusIds.has(t.statusId ?? ""));

  // Get profiles for all members in batch
  const memberUserIds = members.map((m) => m.userId);
  const profileRows = memberUserIds.length > 0 ? await db.select().from(profiles).where(inArray(profiles.id, memberUserIds)) : [];
  const profileMap = new Map(profileRows.map((p) => [p.id, p]));

  // Build per-member task summary
  const lines: string[] = [];
  lines.push(`📋 *Standup — ${formatDate(now)}*\n`);

  let hasAnyTask = false;

  for (const member of members) {
    const profile = profileMap.get(member.userId);
    const firstName = profile?.fullName?.split(" ")[0] ?? "Miembro";

    const myTasks = activeTasks.filter((t) => t.assigneeId === member.userId);
    if (myTasks.length === 0) continue;

    hasAnyTask = true;

    const overdue = myTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
    const inProgress = myTasks.filter((t) => inProgressStatusIds.has(t.statusId ?? ""));
    const pending = myTasks.filter(
      (t) => !inProgressStatusIds.has(t.statusId ?? "") && !(t.dueDate && new Date(t.dueDate) < now),
    );

    lines.push(`👤 *${firstName}*`);

    if (overdue.length > 0) {
      const titles = overdue.map((t) => `${t.key}`).join(", ");
      lines.push(`🔴 Atrasadas (${overdue.length}): ${overdue.map((t) => t.title).join(" · ")}`);
    }

    if (inProgress.length > 0) {
      lines.push(`🔄 En progreso: ${inProgress.map((t) => t.title).join(" · ")}`);
    }

    if (pending.length > 0) {
      lines.push(`📌 Pendientes (${pending.length}): ${pending.map((t) => t.title).join(" · ")}`);
    }

    lines.push("");
  }

  if (!hasAnyTask) {
    lines.push("✅ No hay tareas pendientes asignadas. ¡Buen día!");
  }

  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tutarea-vert.vercel.app";
  const workspaceSlug = workspaceRow?.slug;
  if (workspaceSlug) {
    lines.push(`[Ver en tutarea](${appUrl}/app/${workspaceSlug})`);
  }

  await sendTelegramMessage(parseInt(chatId, 10), lines.join("\n"));
}
