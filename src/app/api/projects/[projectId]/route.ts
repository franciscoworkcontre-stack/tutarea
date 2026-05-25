import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { projects, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyAccess(projectId: string, userId: string, requireAdmin = false) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, project.workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });
  if (!member) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  if (requireAdmin && member.role !== "owner" && member.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden — admin required" }, { status: 403 }) };
  }
  return { project, member };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const access = await verifyAccess(projectId, user.id);
  if ("error" in access) return access.error;

  return NextResponse.json({ project: access.project });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const access = await verifyAccess(projectId, user.id, true);
  if ("error" in access) return access.error;

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
    status?: "active" | "archived";
  };

  const [updated] = await db
    .update(projects)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.status !== undefined && { status: body.status }),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const access = await verifyAccess(projectId, user.id, true);
  if ("error" in access) return access.error;

  await db.delete(projects).where(eq(projects.id, projectId));

  return NextResponse.json({ success: true });
}
