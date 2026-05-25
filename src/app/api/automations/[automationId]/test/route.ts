import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { automations, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { runAutomationTest } from "@/lib/automations/automation-engine";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { automationId } = await params;

  const existing = await db.query.automations.findFirst({
    where: eq(automations.id, automationId),
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, existing.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    taskId?: string;
    dryRun?: boolean;
  };

  const result = await runAutomationTest(
    automationId,
    body.taskId,
    user.id,
    db
  );

  return NextResponse.json({ result });
}
