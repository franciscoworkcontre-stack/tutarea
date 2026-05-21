import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaces, workspaceMembers, profiles, invitations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import MembersAdmin from "@/components/admin/members-admin";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function MembersPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, slug),
  });

  if (!workspace) redirect("/app");

  const currentMember = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspace.id),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!currentMember || (currentMember.role !== "owner" && currentMember.role !== "admin")) {
    redirect(`/app/${slug}`);
  }

  const members = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.workspaceId, workspace.id),
  });

  const memberProfiles = await Promise.all(
    members.map((m) =>
      db.query.profiles.findFirst({ where: eq(profiles.id, m.userId) })
    )
  );

  const pendingInvitations = await db.query.invitations.findMany({
    where: and(
      eq(invitations.workspaceId, workspace.id),
      // Only pending (not accepted)
    ),
  });

  const membersWithProfiles = members.map((m, i) => ({
    ...m,
    profile: memberProfiles[i] ?? null,
  }));

  return (
    <MembersAdmin
      workspace={workspace}
      members={membersWithProfiles}
      pendingInvitations={pendingInvitations}
      currentUserId={user.id}
      currentRole={currentMember.role}
    />
  );
}
