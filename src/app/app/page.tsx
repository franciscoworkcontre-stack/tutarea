import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [membership] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id)).limit(1);

  if (!membership) {
    redirect("/onboarding");
  }

  const [firstWorkspace] = await db.select().from(workspaces).where(eq(workspaces.id, membership.workspaceId)).limit(1);
  if (firstWorkspace) {
    redirect(`/app/${firstWorkspace.slug}`);
  }

  redirect("/onboarding");
}
