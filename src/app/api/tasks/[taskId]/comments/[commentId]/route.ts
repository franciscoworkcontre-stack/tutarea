import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { taskComments } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ taskId: string; commentId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await params;

  const deleted = await db
    .delete(taskComments)
    .where(and(eq(taskComments.id, commentId), eq(taskComments.authorId, user.id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
