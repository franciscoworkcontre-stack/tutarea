import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaceMembers, auditLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workspaceId, memberId } = await params;

  const currentMember = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!currentMember || (currentMember.role !== "owner" && currentMember.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { role: string };

  const targetMember = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.id, memberId),
  });

  if (!targetMember || targetMember.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
  }

  const [updated] = await db
    .update(workspaceMembers)
    .set({
      role: body.role as typeof targetMember.role,
      updatedAt: new Date(),
    })
    .where(eq(workspaceMembers.id, memberId))
    .returning();

  // Audit log
  await db.insert(auditLog).values({
    workspaceId,
    actorId: user.id,
    entityType: "workspace_member",
    entityId: targetMember.userId,
    action: "role_changed",
    diff: { from: targetMember.role, to: body.role },
  });

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workspaceId, memberId } = await params;

  const currentMember = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!currentMember || (currentMember.role !== "owner" && currentMember.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetMember = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.id, memberId),
  });

  if (!targetMember || targetMember.role === "owner") {
    return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
  }

  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId));

  await db.insert(auditLog).values({
    workspaceId,
    actorId: user.id,
    entityType: "workspace_member",
    entityId: targetMember.userId,
    action: "member_removed",
    diff: { role: targetMember.role },
  });

  return NextResponse.json({ success: true });
}
