import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { portfolios, portfolioProjects, workspaces, workspaceMembers } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import PortfolioList from "@/components/portfolios/portfolio-list";

type Props = {
  params: Promise<{ workspace: string }>;
};

type PortfolioSummary = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  projectCount: number;
};

export default async function PortfoliosPage({ params }: Props) {
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

  const portfolioRows = await db.select().from(portfolios).where(eq(portfolios.workspaceId, workspace.id)).orderBy(desc(portfolios.createdAt));
  const portfolioIds = portfolioRows.map(p => p.id);
  const allPortfolioProjects = portfolioIds.length > 0
    ? await db.select().from(portfolioProjects).where(inArray(portfolioProjects.portfolioId, portfolioIds))
    : [];
  const rows = portfolioRows.map(p => ({
    ...p,
    portfolioProjects: allPortfolioProjects.filter(pp => pp.portfolioId === p.id),
  }));

  const portfolioSummaries: PortfolioSummary[] = rows.map((p) => ({
    id: p.id,
    workspaceId: p.workspaceId,
    name: p.name,
    description: p.description,
    color: p.color,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    projectCount: p.portfolioProjects.length,
  }));

  // Serialize dates to strings for client component
  const serialized = portfolioSummaries.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <PortfolioList
      initialPortfolios={serialized}
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
    />
  );
}
