import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaceMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const memberships = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.userId, user.id),
    with: { workspace: true },
    limit: 1,
  });

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const firstWorkspace = memberships[0]?.workspace;
  if (firstWorkspace) {
    redirect(`/app/${firstWorkspace.slug}`);
  }

  redirect("/onboarding");
}
