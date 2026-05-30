import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaces, workspaceMembers, profiles, invitations } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import MembersAdmin from "@/components/admin/members-admin";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function MembersPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);

  if (!workspace) redirect("/app");

  const [currentMember] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, workspace.id),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!currentMember || (currentMember.role !== "owner" && currentMember.role !== "admin")) {
    redirect(`/app/${slug}`);
  }

  const members = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspace.id));

  const memberUserIds = members.map(m => m.userId);
  const memberProfileRows = memberUserIds.length > 0
    ? await db.select().from(profiles).where(inArray(profiles.id, memberUserIds))
    : [];
  const memberProfiles = members.map(m => memberProfileRows.find(p => p.id === m.userId));

  const pendingInvitations = await db.select().from(invitations).where(
    eq(invitations.workspaceId, workspace.id)
    // Only pending (not accepted)
  );

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
