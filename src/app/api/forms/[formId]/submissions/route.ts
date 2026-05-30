import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { forms, formSubmissions, workspaceMembers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

type Params = { params: Promise<{ formId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { formId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, form.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const whereClause = status
    ? and(eq(formSubmissions.formId, formId), eq(formSubmissions.status, status))
    : eq(formSubmissions.formId, formId);

  const submissions = await db.select().from(formSubmissions).where(whereClause).orderBy(desc(formSubmissions.submittedAt)).limit(limit).offset(offset);

  return NextResponse.json({ submissions, page, limit });
}
