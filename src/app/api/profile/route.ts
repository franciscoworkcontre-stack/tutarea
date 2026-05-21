import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    fullName?: string;
    timezone?: string;
    locale?: string;
    avatarUrl?: string;
  };

  try {
    await db
      .insert(profiles)
      .values({
        id: user.id,
        fullName: body.fullName ?? null,
        timezone: body.timezone ?? "America/Santiago",
        locale: body.locale ?? "es-CL",
        avatarUrl: body.avatarUrl ?? null,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          fullName: body.fullName ?? null,
          timezone: body.timezone ?? "America/Santiago",
          locale: body.locale ?? "es-CL",
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error saving profile" }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  return NextResponse.json({ profile });
}
