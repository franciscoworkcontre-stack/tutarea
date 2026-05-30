import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { forms, projects, workspaceMembers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const projectForms = await db.select().from(forms).where(eq(forms.projectId, projectId)).orderBy(desc(forms.createdAt));

  return NextResponse.json({ forms: projectForms });
}

export async function POST(req: Request, { params }: Params) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    title: string;
    description?: string;
    fieldsJsonb?: Array<{
      id: string;
      type: string;
      label: string;
      required: boolean;
      options?: string[];
      placeholder?: string;
    }>;
    defaultPriority?: "no_priority" | "low" | "medium" | "high" | "urgent";
    isPublic?: boolean;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const slug =
    body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 7);

  const [form] = await db
    .insert(forms)
    .values({
      projectId,
      workspaceId: project.workspaceId,
      title: body.title.trim(),
      description: body.description?.trim() ?? null,
      slug,
      fieldsJsonb: body.fieldsJsonb ?? [],
      defaultPriority: body.defaultPriority ?? "no_priority",
      isPublic: body.isPublic ?? true,
      isActive: true,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ form }, { status: 201 });
}
