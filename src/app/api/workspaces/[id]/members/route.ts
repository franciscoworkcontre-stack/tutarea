import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaceMembers, profiles } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workspaceId } = await params;

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  const memberUserIds = members.map((m) => m.userId);
  const profileRows = memberUserIds.length > 0
    ? await db.select().from(profiles).where(inArray(profiles.id, memberUserIds))
    : [];

  const withProfiles = members.map((m) => ({
    userId: m.userId,
    role: m.role,
    profile: profileRows.find((p) => p.id === m.userId) ?? null,
  }));

  return NextResponse.json({ members: withProfiles });
}
