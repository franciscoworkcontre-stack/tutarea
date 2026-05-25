import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

async function getMindmapAndVerifyAccess(id: string, userId: string) {
  const mindmap = await db.query.mindmaps.findFirst({
    where: eq(mindmaps.id, id),
  });
  if (!mindmap) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, mindmap.workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });
  if (!member) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { mindmap, member };
}

type NodeRecord = typeof mindmapNodes.$inferSelect;

function buildTreeText(
  nodes: NodeRecord[],
  parentId: string | null,
  depth: number
): string {
  const children = nodes
    .filter((n) => n.parentNodeId === parentId)
    .sort((a, b) => a.orderInParent - b.orderInParent);

  return children
    .map((node) => {
      const indent = "  ".repeat(depth);
      const subtree = buildTreeText(nodes, node.id, depth + 1);
      return subtree
        ? `${indent}[${node.id}] ${node.label}\n${subtree}`
        : `${indent}[${node.id}] ${node.label}`;
    })
    .join("\n");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const access = await getMindmapAndVerifyAccess(id, user.id);
  if ("error" in access) return access.error;
  const { mindmap } = access;

  const nodes = await db.query.mindmapNodes.findMany({
    where: eq(mindmapNodes.mindmapId, id),
    orderBy: [mindmapNodes.orderInParent],
  });

  if (nodes.length === 0) {
    return NextResponse.json({ error: "Mindmap has no nodes" }, { status: 422 });
  }

  const treeText = `Mindmap: ${mindmap.title}\n${buildTreeText(nodes, null, 0)}`;

  const prompt = `Analyze this mindmap and suggest how to convert it into a project plan. Identify which nodes should be: epics (large features), tasks (actionable items), or subtasks. Return JSON: { epics: [{ label: string, nodeId: string, tasks: [{ label: string, nodeId: string, subtasks: [{ label: string, nodeId: string }] }] }] }

${treeText}

Only return the JSON.`;

  const anthropic = new Anthropic();

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const firstBlock = message.content[0];
  const rawText = firstBlock?.type === "text" ? firstBlock.text.trim() : "{}";

  // Extract JSON from the response (handle potential markdown code fences)
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ??
    rawText.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch?.[1] ? jsonMatch[1].trim() : rawText;

  let plan: unknown;
  try {
    plan = JSON.parse(jsonText);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON", raw: rawText },
      { status: 502 }
    );
  }

  return NextResponse.json({ plan });
}
