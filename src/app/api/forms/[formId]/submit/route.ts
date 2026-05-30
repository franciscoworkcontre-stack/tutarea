import { NextResponse } from "next/server";
import { db } from "@/db";
import { forms, formSubmissions, tasks, taskStatuses, projects } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";

type Params = { params: Promise<{ formId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { formId } = await params;

  const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!form.isActive) return NextResponse.json({ error: "This form is no longer active" }, { status: 403 });

  const body = (await req.json()) as {
    data: Record<string, unknown>;
    submitterName?: string;
    submitterEmail?: string;
  };

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "data is required" }, { status: 400 });
  }

  // Validate required fields
  const missingFields: string[] = [];
  for (const field of form.fieldsJsonb) {
    if (field.required) {
      const value = body.data[field.id];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        missingFields.push(field.label);
      }
    }
  }

  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: `Required fields missing: ${missingFields.join(", ")}` },
      { status: 400 }
    );
  }

  // Determine a title for the auto-task
  let taskTitle: string | null = null;
  const titleField = form.fieldsJsonb.find(
    (f) =>
      f.label.toLowerCase().includes("título") ||
      f.label.toLowerCase().includes("titulo") ||
      f.label.toLowerCase().includes("nombre") ||
      f.label.toLowerCase() === "title" ||
      f.label.toLowerCase() === "name"
  );
  if (titleField) {
    const val = body.data[titleField.id];
    if (typeof val === "string" && val.trim()) {
      taskTitle = val.trim();
    }
  }
  if (!taskTitle && body.submitterName) {
    taskTitle = body.submitterName;
  }
  if (!taskTitle) {
    taskTitle = `Submission from ${body.submitterEmail ?? "anonymous"}`;
  }

  // Create submission
  const insertedSubmissions = await db
    .insert(formSubmissions)
    .values({
      formId,
      projectId: form.projectId,
      dataJsonb: body.data,
      submitterEmail: body.submitterEmail ?? null,
      submitterName: body.submitterName ?? null,
      status: "pending",
    })
    .returning();

  const submission = insertedSubmissions[0];
  if (!submission) {
    return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
  }

  // Increment submission_count
  await db
    .update(forms)
    .set({ submissionCount: sql`${forms.submissionCount} + 1` })
    .where(eq(forms.id, formId));

  // Auto-create task if defaultStatusId is set
  if (form.defaultStatusId) {
    try {
      const [status] = await db.select().from(taskStatuses).where(eq(taskStatuses.id, form.defaultStatusId)).limit(1);

      if (status) {
        const [project] = await db.select().from(projects).where(eq(projects.id, form.projectId)).limit(1);

        if (project) {
          const existingTasks = await db.select().from(tasks).where(eq(tasks.projectId, form.projectId));
          const taskKey = `${project.key}-${existingTasks.length + 1}`;

          const insertedTasks = await db
            .insert(tasks)
            .values({
              title: taskTitle,
              projectId: form.projectId,
              workspaceId: form.workspaceId,
              key: taskKey,
              statusId: form.defaultStatusId,
              priority: form.defaultPriority ?? "no_priority",
              assigneeId: form.defaultAssigneeId ?? null,
              createdBy: form.createdBy,
              position: generateKeyBetween(null, null),
            })
            .returning();

          const createdTask = insertedTasks[0];
          if (createdTask && submission) {
            // Link submission to task
            await db
              .update(formSubmissions)
              .set({ convertedTaskId: createdTask.id })
              .where(eq(formSubmissions.id, submission.id));
          }
        }
      }
    } catch {
      // Non-blocking: if task creation fails, the submission still succeeds
    }
  }

  return NextResponse.json({ success: true, submissionId: submission.id }, { status: 201 });
}
