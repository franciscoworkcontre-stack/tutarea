import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { invitations, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    emails: string[];
    role: string;
    message?: string;
    workspaceId: string;
  };

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, body.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const created = await Promise.allSettled(
    body.emails.map((email) => {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      return db
        .insert(invitations)
        .values({
          workspaceId: body.workspaceId,
          email,
          role: (body.role as "admin" | "member" | "viewer" | "guest") ?? "member",
          token,
          expiresAt,
          invitedBy: user.id,
        })
        .onConflictDoNothing();
    })
  );

  const count = created.filter((r) => r.status === "fulfilled").length;

  return NextResponse.json({ count });
}
