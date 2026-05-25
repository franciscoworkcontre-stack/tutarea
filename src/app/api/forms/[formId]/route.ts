import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { forms, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ formId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { formId } = await params;

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!form.isPublic) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const member = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, form.workspaceId),
        eq(workspaceMembers.userId, user.id)
      ),
    });
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ form });
}

export async function PUT(req: Request, { params }: Params) {
  const { formId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, form.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    title?: string;
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
    defaultStatusId?: string;
    defaultAssigneeId?: string;
    isPublic?: boolean;
    isActive?: boolean;
  };

  const updateData: Partial<typeof forms.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.title !== undefined) updateData.title = body.title.trim();
  if (body.description !== undefined) updateData.description = body.description.trim() || null;
  if (body.fieldsJsonb !== undefined) updateData.fieldsJsonb = body.fieldsJsonb;
  if (body.defaultPriority !== undefined) updateData.defaultPriority = body.defaultPriority;
  if (body.defaultStatusId !== undefined) updateData.defaultStatusId = body.defaultStatusId;
  if (body.defaultAssigneeId !== undefined) updateData.defaultAssigneeId = body.defaultAssigneeId;
  if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const [updated] = await db
    .update(forms)
    .set(updateData)
    .where(eq(forms.id, formId))
    .returning();

  return NextResponse.json({ form: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { formId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, form.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(forms).where(eq(forms.id, formId));

  return NextResponse.json({ success: true });
}
