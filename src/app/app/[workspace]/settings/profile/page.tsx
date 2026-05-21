import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import ProfileSettings from "@/components/settings/profile-settings";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { workspace } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  return <ProfileSettings profile={profile ?? null} userEmail={user.email ?? ""} workspaceSlug={workspace} />;
}
