import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { invitations, workspaces, workspaceMembers } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import InviteAccept from "@/components/auth/invite-accept";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.token, token),
      isNull(invitations.acceptedAt),
      gt(invitations.expiresAt, new Date())
    ),
  });

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Invitación inválida</h1>
          <p className="text-text-muted">
            Este enlace ha expirado o ya fue usado.
          </p>
        </div>
      </div>
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, invitation.workspaceId),
  });

  return (
    <InviteAccept
      invitation={invitation}
      workspace={workspace ?? null}
      currentUser={user}
    />
  );
}
