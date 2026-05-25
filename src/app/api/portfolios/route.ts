import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { portfolios, portfolioProjects, workspaceMembers } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.query.portfolios.findMany({
    where: eq(portfolios.workspaceId, workspaceId),
    orderBy: [desc(portfolios.createdAt)],
    with: {
      portfolioProjects: true,
    },
  });

  const portfoliosWithCount = rows.map((p) => ({
    id: p.id,
    workspaceId: p.workspaceId,
    name: p.name,
    description: p.description,
    color: p.color,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    projectCount: p.portfolioProjects.length,
  }));

  return NextResponse.json({ portfolios: portfoliosWithCount });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    workspaceId: string;
    name: string;
    description?: string;
    color?: string;
  };

  if (!body.workspaceId || !body.name) {
    return NextResponse.json(
      { error: "workspaceId and name required" },
      { status: 400 }
    );
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, body.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [portfolio] = await db
    .insert(portfolios)
    .values({
      workspaceId: body.workspaceId,
      name: body.name,
      description: body.description ?? null,
      color: body.color ?? "#6366f1",
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ portfolio }, { status: 201 });
}
