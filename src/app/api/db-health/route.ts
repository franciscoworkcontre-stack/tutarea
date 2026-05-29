import { NextResponse } from "next/server";
import { db, workspaceMembers } from "@/db";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  console.log("[db-health] start");
  const start = Date.now();
  try {
    const rows = await db.select().from(workspaceMembers).limit(1);
    console.log("[db-health] done", Date.now() - start, "ms");
    return NextResponse.json({ ok: true, count: rows.length, ms: Date.now() - start });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[db-health] error", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
