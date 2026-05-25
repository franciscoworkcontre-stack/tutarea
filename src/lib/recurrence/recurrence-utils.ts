import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  nextDay,
  setDate,
} from "date-fns";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Calculate the next occurrence date based on frequency/interval/config.
 * For weekly with daysOfWeek, finds the next matching weekday at or after `from`.
 * For monthly with dayOfMonth, moves to that day in the next month (or current if not yet reached).
 */
export function calculateNextOccurrence(
  from: Date,
  frequency: RecurrenceFrequency,
  interval: number,
  daysOfWeek?: number[],
  dayOfMonth?: number
): Date {
  switch (frequency) {
    case "daily":
      return addDays(from, interval);

    case "weekly": {
      if (daysOfWeek && daysOfWeek.length > 0) {
        // Find next matching day-of-week at/after (from + 1 day)
        const base = addDays(from, 1);
        // date-fns nextDay Day: 0=Sun, 1=Mon … 6=Sat
        // Try each target day and pick the closest one
        const candidates = daysOfWeek.map((d) => {
          const dow = d as 0 | 1 | 2 | 3 | 4 | 5 | 6;
          const candidate = nextDay(base, dow);
          return candidate;
        });
        // Sort ascending and take the first
        candidates.sort((a, b) => a.getTime() - b.getTime());
        // After interval weeks we might need to advance
        const nearest = candidates[0];
        if (!nearest) return addWeeks(from, interval);
        // If interval > 1, we need to keep iterating week by week
        if (interval <= 1) return nearest;
        // Find which week-cycle we're on; advance until interval weeks pass
        let result = nearest;
        for (let i = 1; i < interval; i++) {
          result = addWeeks(result, 1);
          // Find next matching day in that week
          const weekBase = addDays(result, -result.getDay()); // Sunday of that week
          const weekCandidates = daysOfWeek.map((d) => {
            const dow = d as 0 | 1 | 2 | 3 | 4 | 5 | 6;
            return nextDay(weekBase, dow);
          });
          weekCandidates.sort((a, b) => a.getTime() - b.getTime());
          if (weekCandidates[0]) result = weekCandidates[0];
        }
        return result;
      }
      return addWeeks(from, interval);
    }

    case "monthly": {
      const next = addMonths(from, interval);
      if (dayOfMonth !== undefined && dayOfMonth >= 1 && dayOfMonth <= 31) {
        // Clamp to last day of month
        const year = next.getFullYear();
        const month = next.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const clampedDay = Math.min(dayOfMonth, lastDay);
        return setDate(next, clampedDay);
      }
      return next;
    }

    case "yearly":
      return addYears(from, interval);
  }
}

/**
 * Returns true if another occurrence should be created.
 */
export function shouldCreateNextOccurrence(recurrence: {
  endDate: Date | null;
  maxOccurrences: number | null;
  occurrenceCount: number;
}): boolean {
  if (
    recurrence.maxOccurrences !== null &&
    recurrence.occurrenceCount >= recurrence.maxOccurrences
  ) {
    return false;
  }
  if (recurrence.endDate !== null && new Date() > recurrence.endDate) {
    return false;
  }
  return true;
}

/**
 * Shape required to insert a task (subset used by the clone logic).
 */
export type TaskInsert = {
  projectId: string;
  workspaceId: string;
  title: string;
  description: string | null;
  statusId: string | null;
  priority: "no_priority" | "low" | "medium" | "high" | "urgent";
  assigneeId: string | null;
  dueDate: Date | null;
  createdBy: string;
  key: string;
  position: string;
  parentTaskId: string | null;
};

/**
 * Minimal task record shape needed for cloning.
 */
export type TaskRecord = {
  projectId: string;
  workspaceId: string;
  title: string;
  description: string | null;
  statusId: string | null;
  priority: "no_priority" | "low" | "medium" | "high" | "urgent";
  assigneeId: string | null;
  createdBy: string;
};

/**
 * Clone a task for the next recurrence occurrence with a new due date.
 * The caller is responsible for generating `key` and `position`.
 */
export function cloneTaskForRecurrence(
  task: TaskRecord,
  nextDue: Date,
  key: string,
  position: string,
  firstStatusId?: string | null
): TaskInsert {
  return {
    projectId: task.projectId,
    workspaceId: task.workspaceId,
    title: task.title,
    description: task.description,
    statusId: firstStatusId ?? task.statusId,
    priority: task.priority,
    assigneeId: task.assigneeId,
    dueDate: nextDue,
    createdBy: task.createdBy,
    key,
    position,
    parentTaskId: null,
  };
}
