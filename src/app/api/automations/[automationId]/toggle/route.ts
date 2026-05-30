import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { automations, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { automationId } = await params;

  const [existing] = await db.select().from(automations).where(eq(automations.id, automationId)).limit(1);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, existing.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [updated] = await db
    .update(automations)
    .set({ isActive: !existing.isActive, updatedAt: new Date() })
    .where(eq(automations.id, automationId))
    .returning();

  return NextResponse.json({ automation: updated });
}
