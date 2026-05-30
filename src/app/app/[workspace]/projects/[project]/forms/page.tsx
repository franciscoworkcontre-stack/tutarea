import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { forms, projects, workspaceMembers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import FormsList from "@/components/forms/forms-list";

type Props = {
  params: Promise<{ workspace: string; project: string }>;
};

export default async function FormsPage({ params }: Props) {
  const { workspace: workspaceSlug, project: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) redirect(`/app/${workspaceSlug}/projects`);

  const [member] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, project.workspaceId),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);

  if (!member) redirect(`/app/${workspaceSlug}`);

  const projectForms = await db.select().from(forms).where(eq(forms.projectId, projectId)).orderBy(desc(forms.createdAt));

  return (
    <div className="h-full flex flex-col">
      <FormsList
        projectId={projectId}
        initialForms={projectForms}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
