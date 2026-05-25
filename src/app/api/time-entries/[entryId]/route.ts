import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { entryId } = await params;

  const entry = await db.query.timeEntries.findFirst({
    where: eq(timeEntries.id, entryId),
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (entry.userId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    description?: string;
    durationMinutes?: number;
    startedAt?: string;
    endedAt?: string;
    isRunning?: boolean;
  };

  type TimeEntryRow = InferSelectModel<typeof timeEntries>;
  const updateData: Partial<TimeEntryRow> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (body.description !== undefined) updateData.description = body.description;
  if (body.durationMinutes !== undefined)
    updateData.durationMinutes = body.durationMinutes;
  if (body.startedAt !== undefined)
    updateData.startedAt = new Date(body.startedAt);
  if (body.endedAt !== undefined)
    updateData.endedAt = body.endedAt ? new Date(body.endedAt) : null;
  if (body.isRunning !== undefined) updateData.isRunning = body.isRunning;

  const [updated] = await db
    .update(timeEntries)
    .set(updateData)
    .where(eq(timeEntries.id, entryId))
    .returning();

  return NextResponse.json({ entry: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { entryId } = await params;

  const entry = await db.query.timeEntries.findFirst({
    where: and(
      eq(timeEntries.id, entryId),
      eq(timeEntries.userId, user.id)
    ),
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(timeEntries).where(eq(timeEntries.id, entryId));

  return NextResponse.json({ success: true });
}
