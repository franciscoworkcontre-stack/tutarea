import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  forms,
  formSubmissions,
  tasks,
  taskStatuses,
  projects,
  workspaceMembers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";

type Params = { params: Promise<{ formId: string; submissionId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { formId, submissionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, form.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const submission = await db.query.formSubmissions.findFirst({
    where: and(
      eq(formSubmissions.id, submissionId),
      eq(formSubmissions.formId, formId)
    ),
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ submission });
}

export async function PUT(req: Request, { params }: Params) {
  const { formId, submissionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, form.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const submission = await db.query.formSubmissions.findFirst({
    where: and(
      eq(formSubmissions.id, submissionId),
      eq(formSubmissions.formId, formId)
    ),
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    status: "approved" | "rejected";
    convertToTask?: boolean;
  };

  if (!["approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });
  }

  let convertedTaskId = submission.convertedTaskId;

  if (body.convertToTask && !convertedTaskId) {
    try {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, form.projectId),
      });

      if (project) {
        const existingTasks = await db.query.tasks.findMany({
          where: eq(tasks.projectId, form.projectId),
        });

        let taskTitle = "Untitled submission";
        const titleField = form.fieldsJsonb.find(
          (f) =>
            f.label.toLowerCase().includes("título") ||
            f.label.toLowerCase().includes("titulo") ||
            f.label.toLowerCase().includes("nombre") ||
            f.label.toLowerCase() === "title" ||
            f.label.toLowerCase() === "name"
        );
        if (titleField) {
          const val = submission.dataJsonb[titleField.id];
          if (typeof val === "string" && val.trim()) {
            taskTitle = val.trim();
          }
        } else if (submission.submitterName) {
          taskTitle = submission.submitterName;
        }

        // Pick first available status for the project if no default set
        let statusId = form.defaultStatusId;
        if (!statusId) {
          const defaultStatus = await db.query.taskStatuses.findFirst({
            where: eq(taskStatuses.projectId, form.projectId),
            orderBy: [taskStatuses.position],
          });
          statusId = defaultStatus?.id ?? null;
        }

        const taskKey = `${project.key}-${existingTasks.length + 1}`;
        const insertedTasks = await db
          .insert(tasks)
          .values({
            title: taskTitle,
            projectId: form.projectId,
            workspaceId: form.workspaceId,
            key: taskKey,
            statusId: statusId ?? null,
            priority: form.defaultPriority ?? "no_priority",
            assigneeId: form.defaultAssigneeId ?? null,
            createdBy: user.id,
            position: generateKeyBetween(null, null),
          })
          .returning();

        const createdTask = insertedTasks[0];
        if (createdTask) {
          convertedTaskId = createdTask.id;
        }
      }
    } catch {
      // Non-blocking: task conversion failure does not abort the status update
    }
  }

  const updatedRows = await db
    .update(formSubmissions)
    .set({
      status: body.status,
      reviewedAt: new Date(),
      reviewedBy: user.id,
      convertedTaskId: convertedTaskId ?? null,
    })
    .where(eq(formSubmissions.id, submissionId))
    .returning();

  const updated = updatedRows[0];
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ submission: updated });
}
