import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = randomBytes(3).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db
    .insert(profiles)
    .values({
      id: user.id,
      telegramLinkCode: code,
      telegramLinkCodeExpiresAt: expiresAt,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        telegramLinkCode: code,
        telegramLinkCodeExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ code });
}
