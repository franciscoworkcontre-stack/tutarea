import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaces, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import WorkspaceDashboard from "@/components/layout/workspace-dashboard";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function WorkspacePage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);

  const profile = user
    ? await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1).then(r => r[0] ?? null)
    : null;

  return (
    <WorkspaceDashboard
      workspace={workspace}
      profile={profile}
      userId={user?.id ?? ""}
    />
  );
}
