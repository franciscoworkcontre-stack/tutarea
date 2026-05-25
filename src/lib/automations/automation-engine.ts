import type { DB } from "@/db";
import {
  automations,
  automationRuns,
  tasks,
  taskLabelPivot,
  notifications,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutomationTrigger =
  | "task_created"
  | "task_status_changed"
  | "task_assigned"
  | "task_due_date"
  | "task_priority_changed"
  | "task_completed"
  | "sprint_started"
  | "sprint_completed";

export type AutomationEvent = {
  type: AutomationTrigger;
  projectId: string;
  workspaceId: string;
  taskId?: string;
  triggeredBy?: string;
  payload: Record<string, unknown>;
};

type Condition = {
  field: string;
  operator: string;
  value: unknown;
};

type Action = {
  type: string;
  config: Record<string, unknown>;
};

type TaskRow = {
  id: string;
  projectId: string;
  workspaceId: string;
  title: string;
  statusId: string | null;
  priority: string;
  assigneeId: string | null;
  key: string;
  description: string | null;
  dueDate: Date | null;
  startDate: Date | null;
  estimateHours: number | null;
  position: string;
  archivedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  parentTaskId: string | null;
  reporterId: string | null;
};

// ─── Condition evaluator ──────────────────────────────────────────────────────

function getTaskFieldValue(task: TaskRow, field: string): unknown {
  switch (field) {
    case "status":
      return task.statusId;
    case "priority":
      return task.priority;
    case "assignee":
      return task.assigneeId;
    default:
      return undefined;
  }
}

function evaluateCondition(task: TaskRow, condition: Condition): boolean {
  const fieldValue = getTaskFieldValue(task, condition.field);
  const { operator, value } = condition;

  switch (operator) {
    case "equals":
      return fieldValue === value;
    case "not_equals":
      return fieldValue !== value;
    case "is_empty":
      return fieldValue === null || fieldValue === undefined || fieldValue === "";
    case "is_not_empty":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
    case "contains":
      if (typeof fieldValue === "string" && typeof value === "string") {
        return fieldValue.includes(value);
      }
      return false;
    default:
      return true;
  }
}

function evaluateConditions(task: TaskRow, conditions: Condition[]): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(task, c));
}

// ─── Action executor ──────────────────────────────────────────────────────────

async function executeAction(
  action: Action,
  task: TaskRow,
  db: DB,
  dryRun: boolean
): Promise<void> {
  if (dryRun) return;

  switch (action.type) {
    case "change_status": {
      const statusId = action.config["statusId"] as string | undefined;
      if (!statusId) break;
      await db
        .update(tasks)
        .set({ statusId, updatedAt: new Date() })
        .where(eq(tasks.id, task.id));
      break;
    }

    case "assign_task": {
      const userId = action.config["userId"] as string | undefined;
      if (!userId) break;
      await db
        .update(tasks)
        .set({ assigneeId: userId, updatedAt: new Date() })
        .where(eq(tasks.id, task.id));
      break;
    }

    case "set_priority": {
      const priority = action.config["priority"] as
        | "no_priority"
        | "low"
        | "medium"
        | "high"
        | "urgent"
        | undefined;
      if (!priority) break;
      await db
        .update(tasks)
        .set({ priority, updatedAt: new Date() })
        .where(eq(tasks.id, task.id));
      break;
    }

    case "add_label": {
      const labelId = action.config["labelId"] as string | undefined;
      if (!labelId) break;
      await db
        .insert(taskLabelPivot)
        .values({ taskId: task.id, labelId })
        .onConflictDoNothing();
      break;
    }

    case "send_notification": {
      const userId = action.config["userId"] as string | undefined;
      const message = action.config["message"] as string | undefined;
      if (!userId || !message) break;
      await db.insert(notifications).values({
        userId,
        workspaceId: task.workspaceId,
        type: "automation",
        payload: { message, taskId: task.id },
      });
      break;
    }

    case "create_task": {
      const title = action.config["title"] as string | undefined;
      if (!title) break;
      const assigneeId =
        (action.config["assigneeId"] as string | undefined) ?? null;
      const priority =
        (action.config["priority"] as
          | "no_priority"
          | "low"
          | "medium"
          | "high"
          | "urgent"
          | undefined) ?? "no_priority";

      // Count tasks for key generation
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(eq(tasks.projectId, task.projectId));
      const count = countResult[0]?.count ?? 0;
      const keyPrefix = task.key.split("-").slice(0, -1).join("-");
      const newKey = `${keyPrefix}-${Number(count) + 1}`;

      await db.insert(tasks).values({
        projectId: task.projectId,
        workspaceId: task.workspaceId,
        title,
        key: newKey,
        priority,
        assigneeId,
        createdBy: task.createdBy,
        position: "z0",
      });
      break;
    }

    default:
      break;
  }
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export async function runAutomations(
  event: AutomationEvent,
  db: DB
): Promise<void> {
  // 1. Find active automations for this project + trigger type
  const activeAutomations = await db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.projectId, event.projectId),
        eq(automations.triggerType, event.type),
        eq(automations.isActive, true)
      )
    );

  if (activeAutomations.length === 0) return;

  // 2. Fetch the task if we have a taskId
  let task: TaskRow | undefined;
  if (event.taskId) {
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, event.taskId))
      .limit(1);
    task = rows[0];
  }

  // 3. Run each automation
  for (const automation of activeAutomations) {
    let actionsExecuted = 0;
    let errorMessage: string | undefined;
    let status = "success";

    try {
      const conditions = (automation.conditionsJsonb ?? []) as Condition[];
      const actions = (automation.actionsJsonb ?? []) as Action[];

      // Evaluate conditions (require task for condition evaluation)
      if (conditions.length > 0 && !task) continue;
      if (task && !evaluateConditions(task, conditions)) continue;

      // Execute actions
      for (const action of actions) {
        if (task) {
          await executeAction(action, task, db, false);
        }
        actionsExecuted++;
      }
    } catch (err) {
      status = "failed";
      errorMessage =
        err instanceof Error ? err.message : "Unknown error";
    }

    // 4. Record the run
    await db
      .insert(automationRuns)
      .values({
        automationId: automation.id,
        triggeredBy: event.triggeredBy ?? null,
        triggerPayloadJsonb: event.payload,
        status,
        errorMessage: errorMessage ?? null,
        actionsExecuted,
      })
      .catch(() => {});

    // 5. Update run stats on the automation
    await db
      .update(automations)
      .set({
        runCount: sql`${automations.runCount} + 1`,
        lastRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(automations.id, automation.id))
      .catch(() => {});
  }
}

// ─── Test-mode runner (dry-run) ───────────────────────────────────────────────

export async function runAutomationTest(
  automationId: string,
  taskId: string | undefined,
  triggeredBy: string,
  db: DB
): Promise<{ actionsExecuted: number; status: string; errorMessage?: string }> {
  const automationRows = await db
    .select()
    .from(automations)
    .where(eq(automations.id, automationId))
    .limit(1);

  const automation = automationRows[0];
  if (!automation) {
    return { actionsExecuted: 0, status: "failed", errorMessage: "Automation not found" };
  }

  let task: TaskRow | undefined;
  if (taskId) {
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    task = rows[0];
  }

  const conditions = (automation.conditionsJsonb ?? []) as Condition[];
  const actions = (automation.actionsJsonb ?? []) as Action[];

  if (conditions.length > 0 && !task) {
    return {
      actionsExecuted: 0,
      status: "skipped",
      errorMessage: "Conditions require a task but no taskId provided",
    };
  }

  if (task && !evaluateConditions(task, conditions)) {
    return { actionsExecuted: 0, status: "skipped", errorMessage: "Conditions not met" };
  }

  // Dry-run: count actions but don't apply
  let actionsExecuted = 0;
  for (const action of actions) {
    if (task) {
      await executeAction(action, task, db, true /* dryRun */);
    }
    actionsExecuted++;
  }

  // Record the test run
  await db.insert(automationRuns).values({
    automationId,
    triggeredBy,
    triggerPayloadJsonb: { test: true, taskId: taskId ?? null },
    status: "success",
    actionsExecuted,
  });

  await db
    .update(automations)
    .set({
      runCount: sql`${automations.runCount} + 1`,
      lastRunAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(automations.id, automationId));

  return { actionsExecuted, status: "success" };
}
