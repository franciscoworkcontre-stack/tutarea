import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaces, workspaceMembers, projects, taskStatuses, profiles } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { generateProjectKey } from "@/lib/utils";
import { generateKeyBetween } from "fractional-indexing";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    workspaceName: string;
    workspaceSlug: string;
  };

  if (!body.workspaceName || !body.workspaceSlug) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Check slug uniqueness
  const [existing] = await db.select().from(workspaces).where(eq(workspaces.slug, body.workspaceSlug)).limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Este URL ya está en uso. Elige otro." },
      { status: 409 }
    );
  }

  try {
    // Create workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: body.workspaceName,
        slug: body.workspaceSlug,
        createdBy: user.id,
      })
      .returning();

    if (!workspace) throw new Error("Failed to create workspace");

    // Add owner as member
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });

    // Ensure profile exists
    await db
      .insert(profiles)
      .values({
        id: user.id,
        fullName: user.user_metadata?.["full_name"] as string | null ?? null,
        onboardingCompleted: true,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          onboardingCompleted: true,
          updatedAt: new Date(),
        },
      });

    // Create a starter project
    const projectName = "Mi Primer Proyecto";
    const [project] = await db
      .insert(projects)
      .values({
        workspaceId: workspace.id,
        name: projectName,
        key: generateProjectKey(projectName),
        color: "#f57522",
        createdBy: user.id,
      })
      .returning();

    if (project) {
      // Create default statuses
      const defaultStatuses = [
        { name: "Por hacer", color: "#94a3b8", type: "todo" as const, position: 1 },
        { name: "En progreso", color: "#3b82f6", type: "in_progress" as const, position: 2 },
        { name: "En revisión", color: "#f59e0b", type: "review" as const, position: 3 },
        { name: "Hecho", color: "#22c55e", type: "done" as const, position: 4 },
      ];

      await db.insert(taskStatuses).values(
        defaultStatuses.map((s) => ({
          projectId: project.id,
          workspaceId: workspace.id,
          ...s,
        }))
      );
    }

    return NextResponse.json({ slug: workspace.slug, workspaceId: workspace.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error creating workspace" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberWorkspaces = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id));
  const workspaceIds = memberWorkspaces.map((m) => m.workspaceId);
  const workspaceRows = workspaceIds.length > 0
    ? await db.select().from(workspaces).where(inArray(workspaces.id, workspaceIds))
    : [];
  const workspaceMap = new Map(workspaceRows.map((w) => [w.id, w]));

  return NextResponse.json({
    workspaces: memberWorkspaces.map((m) => ({
      ...workspaceMap.get(m.workspaceId),
      role: m.role,
    })),
  });
}
