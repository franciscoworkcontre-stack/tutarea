import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { mindmaps, mindmapNodes, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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

function buildMarkdown(
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
      const line = `${indent}- ${node.label}`;
      const subtree = buildMarkdown(nodes, node.id, depth + 1);
      return subtree ? `${line}\n${subtree}` : line;
    })
    .join("\n");
}

function buildOpmlOutlines(
  nodes: NodeRecord[],
  parentId: string | null,
  indentLevel: number
): string {
  const children = nodes
    .filter((n) => n.parentNodeId === parentId)
    .sort((a, b) => a.orderInParent - b.orderInParent);

  return children
    .map((node) => {
      const indent = "  ".repeat(indentLevel);
      const escaped = node.label.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const subtree = buildOpmlOutlines(nodes, node.id, indentLevel + 1);
      if (subtree) {
        return `${indent}<outline text="${escaped}">\n${subtree}\n${indent}</outline>`;
      }
      return `${indent}<outline text="${escaped}"/>`;
    })
    .join("\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const access = await getMindmapAndVerifyAccess(id, user.id);
  if ("error" in access) return access.error;
  const { mindmap } = access;

  const format = request.nextUrl.searchParams.get("format");
  if (!format || (format !== "markdown" && format !== "opml")) {
    return NextResponse.json(
      { error: "Invalid format. Use 'markdown' or 'opml'" },
      { status: 400 }
    );
  }

  const nodes = await db.query.mindmapNodes.findMany({
    where: eq(mindmapNodes.mindmapId, id),
    orderBy: [mindmapNodes.orderInParent],
  });

  const safeTitle = mindmap.title.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "mindmap";

  if (format === "markdown") {
    const rootNodes = nodes
      .filter((n) => n.parentNodeId === null)
      .sort((a, b) => a.orderInParent - b.orderInParent);

    const lines: string[] = [`# ${mindmap.title}`, ""];

    for (const root of rootNodes) {
      lines.push(`- ${root.label}`);
      const subtree = buildMarkdown(nodes, root.id, 1);
      if (subtree) lines.push(subtree);
    }

    const content = lines.join("\n");

    return new Response(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}.md"`,
      },
    });
  }

  // OPML format
  const escapedTitle = mindmap.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const outlines = buildOpmlOutlines(nodes, null, 2);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>${escapedTitle}</title></head>
  <body>
${outlines}
  </body>
</opml>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle}.opml"`,
    },
  });
}
