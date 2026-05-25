import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { meetings, meetingAttachments, workspaceMembers } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

async function fetchOgMetadata(url: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Tutarea/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    const metadata: Record<string, string> = {};

    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
      || html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) metadata.title = titleMatch[1].trim();

    const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (descMatch?.[1]) metadata.description = descMatch[1].trim();

    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (imageMatch?.[1]) metadata.image = imageMatch[1].trim();

    const siteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
    if (siteMatch?.[1]) metadata.siteName = siteMatch[1].trim();

    return metadata;
  } catch {
    return {};
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, id),
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attachments = await db.query.meetingAttachments.findMany({
    where: eq(meetingAttachments.meetingId, id),
    orderBy: [asc(meetingAttachments.addedAt)],
  });

  return NextResponse.json({ attachments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, id),
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, meeting.workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    agendaItemId?: string;
    sourceType: string;
    sourceRefId?: string;
    externalUrl?: string;
    title: string;
    thumbnailUrl?: string;
    preReadRequired?: boolean;
  };

  if (!body.sourceType || !body.title) {
    return NextResponse.json({ error: "sourceType and title are required" }, { status: 400 });
  }

  let ogMetadata: Record<string, string> = {};
  let resolvedTitle = body.title;
  let thumbnailUrl = body.thumbnailUrl ?? null;

  if (body.sourceType === "external_link" && body.externalUrl) {
    ogMetadata = await fetchOgMetadata(body.externalUrl);
    if (!body.title && ogMetadata.title) resolvedTitle = ogMetadata.title;
    if (!thumbnailUrl && ogMetadata.image) thumbnailUrl = ogMetadata.image;
  }

  const [attachment] = await db
    .insert(meetingAttachments)
    .values({
      meetingId: id,
      agendaItemId: body.agendaItemId ?? null,
      sourceType: body.sourceType,
      sourceRefId: body.sourceRefId ?? null,
      externalUrl: body.externalUrl ?? null,
      title: resolvedTitle,
      thumbnailUrl,
      ogMetadataJsonb: ogMetadata,
      preReadRequired: body.preReadRequired ?? false,
      addedBy: user.id,
    })
    .returning();

  return NextResponse.json({ attachment }, { status: 201 });
}
