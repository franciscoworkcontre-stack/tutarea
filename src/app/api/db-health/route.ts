import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET() {
  const start = Date.now();
  try {
    const rows = await db.query.workspaceMembers.findMany({ limit: 1 });
    return NextResponse.json({ ok: true, count: rows.length, ms: Date.now() - start });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
