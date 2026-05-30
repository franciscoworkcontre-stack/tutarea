import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import TelegramSettings from "@/components/settings/telegram-settings";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function TelegramPage({ params }: Props) {
  const { workspace } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  return (
    <TelegramSettings
      profile={profile ?? null}
      userId={user.id}
      workspaceSlug={workspace}
    />
  );
}
