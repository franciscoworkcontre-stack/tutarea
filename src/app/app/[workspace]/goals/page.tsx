import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { goals, keyResults, workspaces, workspaceMembers, profiles, projects } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import GoalsList from "@/components/goals/goals-list";
import type { InferSelectModel } from "drizzle-orm";

// Serialized versions (dates as strings) for Client Component boundary
type SerializedKR = Omit<InferSelectModel<typeof keyResults>, "dueDate" | "createdAt" | "updatedAt"> & {
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type SerializedGoal = Omit<
  InferSelectModel<typeof goals>,
  "startDate" | "dueDate" | "createdAt" | "updatedAt"
> & {
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  keyResults: SerializedKR[];
};

type SerializedProfile = Omit<
  InferSelectModel<typeof profiles>,
  "telegramLinkedAt" | "telegramLinkCodeExpiresAt" | "createdAt" | "updatedAt"
> & {
  telegramLinkedAt: string | null;
  telegramLinkCodeExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SerializedMember = Omit<
  InferSelectModel<typeof workspaceMembers>,
  "joinedAt" | "createdAt" | "updatedAt"
> & {
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  profile: SerializedProfile | null;
};

type SerializedProject = Omit<
  InferSelectModel<typeof projects>,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function GoalsPage({ params }: Props) {
  const { workspace: slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  if (!workspace) redirect("/app");

  const [membership] = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, workspace.id),
    eq(workspaceMembers.userId, user.id)
  )).limit(1);
  if (!membership) redirect("/app");

  // Fetch goals with key results
  const goalsRaw = await db.select().from(goals).where(eq(goals.workspaceId, workspace.id)).orderBy(desc(goals.createdAt));
  const goalIds = goalsRaw.map(g => g.id);
  const allKeyResults = goalIds.length > 0
    ? await db.select().from(keyResults).where(inArray(keyResults.goalId, goalIds))
    : [];
  const goalsWithKRs = goalsRaw.map(g => ({
    ...g,
    keyResults: allKeyResults.filter(kr => kr.goalId === g.id),
  }));

  // Fetch workspace members
  const members = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspace.id));

  // Fetch profiles for all members
  const allProfileIds = members.map((m) => m.userId);
  const allProfiles: (InferSelectModel<typeof profiles> | undefined)[] =
    allProfileIds.length > 0
      ? await db.select().from(profiles).where(inArray(profiles.id, allProfileIds)).then(rows =>
          allProfileIds.map(id => rows.find(p => p.id === id))
        )
      : [];

  const membersWithProfiles = members.map((m, i) => ({
    ...m,
    profile: allProfiles[i] ?? null,
  }));

  // Fetch workspace projects
  const workspaceProjects = await db.select().from(projects).where(and(
    eq(projects.workspaceId, workspace.id),
    eq(projects.status, "active")
  ));

  // Serialize: convert Date → ISO string for Next.js Client Component boundary
  const serializedGoals: SerializedGoal[] = goalsWithKRs.map((g) => ({
    ...g,
    startDate: g.startDate ? g.startDate.toISOString() : null,
    dueDate: g.dueDate ? g.dueDate.toISOString() : null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    keyResults: g.keyResults.map((kr) => ({
      ...kr,
      dueDate: kr.dueDate ? kr.dueDate.toISOString() : null,
      createdAt: kr.createdAt.toISOString(),
      updatedAt: kr.updatedAt.toISOString(),
    })),
  }));

  const serializedMembers: SerializedMember[] = membersWithProfiles.map((m) => ({
    ...m,
    joinedAt: m.joinedAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    profile: m.profile
      ? {
          ...m.profile,
          telegramLinkedAt: m.profile.telegramLinkedAt
            ? m.profile.telegramLinkedAt.toISOString()
            : null,
          telegramLinkCodeExpiresAt: m.profile.telegramLinkCodeExpiresAt
            ? m.profile.telegramLinkCodeExpiresAt.toISOString()
            : null,
          createdAt: m.profile.createdAt.toISOString(),
          updatedAt: m.profile.updatedAt.toISOString(),
        }
      : null,
  }));

  const serializedProjects: SerializedProject[] = workspaceProjects.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border flex-shrink-0">
        <h1 className="text-xl font-semibold text-text">Objetivos</h1>
        <p className="text-sm text-text-muted mt-0.5">
          OKRs y objetivos del workspace
        </p>
      </div>

      <GoalsList
        workspaceId={workspace.id}
        initialGoals={serializedGoals as unknown as Parameters<typeof GoalsList>[0]["initialGoals"]}
        members={serializedMembers as unknown as Parameters<typeof GoalsList>[0]["members"]}
        projects={serializedProjects as unknown as Parameters<typeof GoalsList>[0]["projects"]}
      />
    </div>
  );
}
