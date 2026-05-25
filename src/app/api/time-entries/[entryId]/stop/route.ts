import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
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
    where: eq(timeEntries.id, entryId),
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (entry.userId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!entry.isRunning)
    return NextResponse.json({ error: "Entry is not running" }, { status: 400 });

  const now = new Date();
  const startedAt = new Date(entry.startedAt);
  const durationMinutes = Math.round(
    (now.getTime() - startedAt.getTime()) / 60000
  );

  const [updated] = await db
    .update(timeEntries)
    .set({
      isRunning: false,
      endedAt: now,
      durationMinutes,
      updatedAt: now,
    })
    .where(eq(timeEntries.id, entryId))
    .returning();

  return NextResponse.json({ entry: updated });
}
