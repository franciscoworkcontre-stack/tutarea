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

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, slug),
  });

  const profile = user
    ? await db.query.profiles.findFirst({
        where: eq(profiles.id, user.id),
      })
    : null;

  return (
    <WorkspaceDashboard
      workspace={workspace}
      profile={profile}
      userId={user?.id ?? ""}
    />
  );
}
