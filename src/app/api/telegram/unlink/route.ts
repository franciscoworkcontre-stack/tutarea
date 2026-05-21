import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db
    .update(profiles)
    .set({
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  return NextResponse.json({ success: true });
}
