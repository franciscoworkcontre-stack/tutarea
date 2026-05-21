import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { workspaces, workspaceMembers, auditLog } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import AuditLogView from "@/components/admin/audit-log-view";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function AuditLogPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, slug),
  });
  if (!workspace) redirect("/app");

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspace.id),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    redirect(`/app/${slug}`);
  }

  const logs = await db.query.auditLog.findMany({
    where: eq(auditLog.workspaceId, workspace.id),
    orderBy: [desc(auditLog.createdAt)],
    limit: 100,
  });

  return <AuditLogView logs={logs} />;
}
