import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { invitations, workspaces, workspaceMembers } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;

  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.token, token),
      isNull(invitations.acceptedAt),
      gt(invitations.expiresAt, new Date())
    ),
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, invitation.workspaceId),
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Check not already a member
  const existing = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, invitation.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!existing) {
    await db.insert(workspaceMembers).values({
      workspaceId: invitation.workspaceId,
      userId: user.id,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
    });
  }

  // Mark invitation accepted
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  return NextResponse.json({ workspaceSlug: workspace.slug });
}
