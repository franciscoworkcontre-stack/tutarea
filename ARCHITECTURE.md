# tutarea — Architecture Blueprint: Mindmaps & Meetings (Complete)

> Generated: 2026-05-25  
> Stack: Next.js 15 App Router · Drizzle ORM · Supabase PostgreSQL · TailwindCSS  
> This document guides 6 parallel dev agents to implement the full specs with zero phasing.

---

## 0. Current State Audit

### What already exists (DO NOT delete, extend or replace):

**Schema already in `src/db/schema.ts`:**
- `mindmaps` table — basic fields only (id, projectId, workspaceId, title, description, status, createdBy, timestamps)
- `mindmapNodes` table — id, mindmapId, parentNodeId, label, content, color, positionX, positionY, nodeOrder, linkedTaskId
- `meetings` table — id, projectId, workspaceId, title, objective, status, scheduledAt, durationMin, timezone, location, meetingUrl, briefingMd, recapMd, ownerId, createdBy, timestamps
- `meetingAttendees` table — id, meetingId, userId, role, rsvp
- `meetingAgendaItems` table — id, meetingId, parentItemId, title, ownerId, durationMin, itemType, notesMd, orderIdx
- Enums: `mindmapStatusEnum`, `meetingStatusEnum`, `attendeeRoleEnum`, `attendeeRsvpEnum`, `agendaItemTypeEnum`

**APIs already in place (extend, do not duplicate):**
- `GET/POST /api/mindmaps`
- `GET/PUT/DELETE /api/mindmaps/[id]`
- `GET/POST /api/mindmaps/[id]/nodes`
- `GET/PUT/DELETE /api/mindmaps/[id]/nodes/[nodeId]`
- `GET/POST /api/meetings`
- `GET/PUT/DELETE /api/meetings/[id]`
- `GET/POST /api/meetings/[id]/attendees`
- `GET/PUT/DELETE /api/meetings/[id]/attendees/[attendeeId]`
- `GET/POST /api/meetings/[id]/agenda`
- `GET/PUT/DELETE /api/meetings/[id]/agenda/[agendaId]`

**Components already in place (REPLACE, not extend):**
- `src/components/mindmaps/mindmap-canvas.tsx` — custom SVG canvas, NO React Flow, needs full replacement
- `src/components/mindmaps/mindmap-node.tsx` — basic node, needs replacement
- `src/components/mindmaps/mindmap-list.tsx` — basic list
- `src/components/mindmaps/mindmap-sidebar.tsx` — basic sidebar
- `src/components/meetings/meeting-detail.tsx` — partial, missing Live/Recap modes
- `src/components/meetings/agenda-editor.tsx` — partial, missing DnD reorder and Live timer
- `src/components/meetings/attendee-manager.tsx` — partial, missing role warnings
- `src/components/meetings/meeting-card.tsx` — basic
- `src/components/meetings/meeting-list.tsx` — basic

**Packages already installed (do NOT re-install):**
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`
- `@tiptap/react`, `@tiptap/starter-kit`, and all TipTap extensions listed in package.json
- `framer-motion`, `zustand`, `@anthropic-ai/sdk`, `@tanstack/react-query`
- `lucide-react`, `date-fns`, `sonner`, `cmdk`, `zod`, `react-hook-form`

---

## 1. DB Schema — New Tables and Modifications

### 1.1 New Enums (add to `src/db/schema.ts`)

```sql
-- Mindmap layout modes
CREATE TYPE mindmap_layout AS ENUM ('radial', 'tree_h', 'tree_v');

-- Mindmap node shape
CREATE TYPE mindmap_node_shape AS ENUM ('rect', 'circle', 'diamond');

-- Mindmap edge style
CREATE TYPE mindmap_edge_style AS ENUM ('solid', 'dashed', 'dotted');

-- Mindmap theme
CREATE TYPE mindmap_theme AS ENUM ('light', 'dark', 'blueprint', 'sepia');

-- Meeting types
CREATE TYPE meeting_type AS ENUM (
  'one_on_one', 'team_sync', 'decision', 'brainstorm',
  'review', 'retro', 'kickoff', 'custom'
);

-- Meeting attachment origin
CREATE TYPE meeting_attachment_type AS ENUM ('mindmap', 'external_link', 'task', 'meeting_doc');

-- Pre-read status
CREATE TYPE pre_read_status AS ENUM ('not_started', 'in_progress', 'completed');

-- Attendee informed_after (spec requires it as a role value)
-- NOTE: Extend existing attendee_role enum to add 'informed_after'
-- Run: ALTER TYPE attendee_role ADD VALUE 'informed_after';
```

### 1.2 Modified Tables

#### `mindmaps` — ADD columns:
```sql
ALTER TABLE mindmaps ADD COLUMN layout mindmap_layout NOT NULL DEFAULT 'radial';
ALTER TABLE mindmaps ADD COLUMN theme mindmap_theme NOT NULL DEFAULT 'light';
ALTER TABLE mindmaps ADD COLUMN viewport_x real NOT NULL DEFAULT 0;
ALTER TABLE mindmaps ADD COLUMN viewport_y real NOT NULL DEFAULT 0;
ALTER TABLE mindmaps ADD COLUMN viewport_zoom real NOT NULL DEFAULT 1;
```

#### `mindmap_nodes` — ADD columns:
```sql
ALTER TABLE mindmap_nodes ADD COLUMN shape mindmap_node_shape NOT NULL DEFAULT 'rect';
ALTER TABLE mindmap_nodes ADD COLUMN border_color text;
ALTER TABLE mindmap_nodes ADD COLUMN icon text;           -- lucide icon name, nullable
ALTER TABLE mindmap_nodes ADD COLUMN collapsed boolean NOT NULL DEFAULT false;
ALTER TABLE mindmap_nodes ADD COLUMN manual_position boolean NOT NULL DEFAULT false; -- true = user overrode auto-layout
ALTER TABLE mindmap_nodes ADD COLUMN linked_task_status text; -- cached task status badge
```

#### `meetings` — ADD columns:
```sql
ALTER TABLE meetings ADD COLUMN meeting_type meeting_type NOT NULL DEFAULT 'team_sync';
ALTER TABLE meetings ADD COLUMN dri_id uuid REFERENCES profiles(id);  -- DRI required for 'scheduled'
ALTER TABLE meetings ADD COLUMN recurring_parent_id uuid REFERENCES meetings(id);
ALTER TABLE meetings ADD COLUMN pre_questions jsonb DEFAULT '[]';   -- array of {id, question, answers: {userId, answer}[]}
ALTER TABLE meetings ADD COLUMN context_block jsonb;                -- {lastMeetingId, openActionItems: taskId[]}
ALTER TABLE meetings ADD COLUMN live_started_at timestamptz;
ALTER TABLE meetings ADD COLUMN live_ended_at timestamptz;
ALTER TABLE meetings ADD COLUMN decisions_count integer NOT NULL DEFAULT 0;
ALTER TABLE meetings ADD COLUMN action_items_count integer NOT NULL DEFAULT 0;
```

### 1.3 New Tables

#### `mindmap_edges`
```sql
CREATE TABLE mindmap_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mindmap_id uuid NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
  color text NOT NULL DEFAULT '#94a3b8',
  thickness integer NOT NULL DEFAULT 2,           -- px
  style mindmap_edge_style NOT NULL DEFAULT 'solid',
  curve text NOT NULL DEFAULT 'bezier',           -- 'bezier' | 'straight' | 'step'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_node_id, target_node_id)
);
CREATE INDEX mindmap_edges_mindmap_id_idx ON mindmap_edges(mindmap_id);
```

#### `mindmap_node_comments`
```sql
CREATE TABLE mindmap_node_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
  mindmap_id uuid NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mindmap_node_comments_node_id_idx ON mindmap_node_comments(node_id);
```

#### `mindmap_versions`
```sql
CREATE TABLE mindmap_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mindmap_id uuid NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,        -- {nodes: MindmapNode[], edges: MindmapEdge[]}
  created_by uuid NOT NULL,
  label text,                     -- optional user-provided label
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mindmap_versions_mindmap_id_idx ON mindmap_versions(mindmap_id);
```

#### `meeting_attachments`
```sql
CREATE TABLE meeting_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  attachment_type meeting_attachment_type NOT NULL DEFAULT 'external_link',
  title text NOT NULL,
  url text,                       -- for external_link
  mindmap_id uuid REFERENCES mindmaps(id) ON DELETE SET NULL,   -- for mindmap type
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,         -- for task type
  ref_meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL, -- for meeting_doc type
  og_title text,                  -- oEmbed/OG metadata cache
  og_description text,
  og_image text,
  og_provider text,
  added_by uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_attachments_meeting_id_idx ON meeting_attachments(meeting_id);
```

#### `meeting_notes`
```sql
CREATE TABLE meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
  note_type text NOT NULL DEFAULT 'note',   -- 'note' | 'decision' | 'action'
  body_tiptap jsonb,              -- TipTap JSON doc
  body_md text,                   -- markdown mirror for export/search
  author_id uuid NOT NULL,
  assigned_to uuid,               -- for action type: assignee
  due_date timestamptz,           -- for action type
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,  -- materialized task link
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_notes_meeting_id_idx ON meeting_notes(meeting_id);
CREATE INDEX meeting_notes_agenda_item_id_idx ON meeting_notes(agenda_item_id);
```

#### `meeting_pre_read_tracking`
```sql
CREATE TABLE meeting_pre_read_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES meeting_attendees(id) ON DELETE CASCADE,
  attachment_id uuid REFERENCES meeting_attachments(id) ON DELETE CASCADE,
  status pre_read_status NOT NULL DEFAULT 'not_started',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attendee_id, attachment_id)
);
```

#### `meeting_agenda_timings` (Live mode per-item stopwatch)
```sql
CREATE TABLE meeting_agenda_timings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid NOT NULL REFERENCES meeting_agenda_items(id) ON DELETE CASCADE,
  started_at timestamptz,
  ended_at timestamptz,
  elapsed_seconds integer,
  UNIQUE(meeting_id, agenda_item_id)
);
```

### 1.4 Drizzle ORM Additions (add to `src/db/schema.ts`)

```typescript
// New enums
export const mindmapLayoutEnum = pgEnum("mindmap_layout", ["radial", "tree_h", "tree_v"]);
export const mindmapNodeShapeEnum = pgEnum("mindmap_node_shape", ["rect", "circle", "diamond"]);
export const mindmapEdgeStyleEnum = pgEnum("mindmap_edge_style", ["solid", "dashed", "dotted"]);
export const mindmapThemeEnum = pgEnum("mindmap_theme", ["light", "dark", "blueprint", "sepia"]);
export const meetingTypeEnum = pgEnum("meeting_type", [
  "one_on_one", "team_sync", "decision", "brainstorm", "review", "retro", "kickoff", "custom"
]);
export const meetingAttachmentTypeEnum = pgEnum("meeting_attachment_type", [
  "mindmap", "external_link", "task", "meeting_doc"
]);
export const preReadStatusEnum = pgEnum("pre_read_status", ["not_started", "in_progress", "completed"]);

// New tables: mindmapEdges, mindmapNodeComments, mindmapVersions,
// meetingAttachments, meetingNotes, meetingPreReadTracking, meetingAgendaTimings

// Modified mindmaps table: add layout, theme, viewportX, viewportY, viewportZoom
// Modified mindmapNodes table: add shape, borderColor, icon, collapsed, manualPosition, linkedTaskStatus
// Modified meetings table: add meetingType, driId, recurringParentId, preQuestions,
//   contextBlock, liveStartedAt, liveEndedAt, decisionsCount, actionItemsCount
// Modified meetingAttendees: attendee_role enum needs 'informed_after' value
```

---

## 2. APIs — Complete Endpoint List

### 2.1 Mindmaps APIs

All existing endpoints are kept. New/extended ones below:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mindmaps?projectId=&workspaceId=` | List mindmaps (existing, keep) |
| POST | `/api/mindmaps` | Create mindmap (existing, keep) |
| GET | `/api/mindmaps/[id]` | Get mindmap with nodes+edges (extend to include edges) |
| PUT | `/api/mindmaps/[id]` | Update mindmap metadata (extend: layout, theme, viewport) |
| DELETE | `/api/mindmaps/[id]` | Delete mindmap (existing, keep) |
| GET | `/api/mindmaps/[id]/nodes` | List all nodes (existing, keep) |
| POST | `/api/mindmaps/[id]/nodes` | Create node (extend: shape, icon, borderColor) |
| GET | `/api/mindmaps/[id]/nodes/[nodeId]` | Get single node (existing, keep) |
| PUT | `/api/mindmaps/[id]/nodes/[nodeId]` | Update node (extend: shape, icon, collapsed, manualPosition, borderColor) |
| DELETE | `/api/mindmaps/[id]/nodes/[nodeId]` | Delete node + descendants (existing, keep) |
| POST | `/api/mindmaps/[id]/nodes/bulk` | Bulk update positions (array of {id, positionX, positionY}) for auto-layout save |
| GET | `/api/mindmaps/[id]/edges` | List all edges for the mindmap |
| POST | `/api/mindmaps/[id]/edges` | Create a custom edge (non-hierarchy) |
| PUT | `/api/mindmaps/[id]/edges/[edgeId]` | Update edge style (color, thickness, style, curve) |
| DELETE | `/api/mindmaps/[id]/edges/[edgeId]` | Delete custom edge |
| GET | `/api/mindmaps/[id]/comments` | List all node comments for a mindmap |
| POST | `/api/mindmaps/[id]/nodes/[nodeId]/comments` | Add comment to node |
| PUT | `/api/mindmaps/[id]/nodes/[nodeId]/comments/[commentId]` | Edit or resolve comment |
| DELETE | `/api/mindmaps/[id]/nodes/[nodeId]/comments/[commentId]` | Delete comment |
| GET | `/api/mindmaps/[id]/versions` | List version history snapshots |
| POST | `/api/mindmaps/[id]/versions` | Save a named version snapshot |
| GET | `/api/mindmaps/[id]/versions/[versionId]` | Get a specific version snapshot |
| POST | `/api/mindmaps/[id]/versions/[versionId]/restore` | Restore mindmap to a snapshot |
| POST | `/api/mindmaps/[id]/export` | Export as PNG/SVG/Markdown/OPML (body: {format}) |
| POST | `/api/mindmaps/[id]/ai/expand` | AI: expand node with children suggestions (streaming) |
| POST | `/api/mindmaps/[id]/ai/summarize` | AI: summarize a branch as text |
| POST | `/api/mindmaps/[id]/ai/reorganize` | AI: suggest layout reorganization |
| POST | `/api/mindmaps/[id]/ai/brainstorm` | AI: brainstorm mode — stream ideas as new nodes |
| POST | `/api/mindmaps/[id]/ai/convert-to-plan` | AI: convert full mindmap to task plan |

### 2.2 Meetings APIs

All existing endpoints are kept. New ones below:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meetings?projectId=&workspaceId=&type=&status=` | List meetings with optional filters (extend existing) |
| POST | `/api/meetings` | Create meeting (extend: meetingType, driId) |
| GET | `/api/meetings/[id]` | Get meeting full detail (extend: include attachments, notes, timings) |
| PUT | `/api/meetings/[id]` | Update meeting fields (extend: meetingType, driId, preQuestions, contextBlock) |
| DELETE | `/api/meetings/[id]` | Delete meeting (existing, keep) |
| GET | `/api/meetings/[id]/attendees` | List attendees (existing, keep) |
| POST | `/api/meetings/[id]/attendees` | Add attendee (existing, keep) |
| PUT | `/api/meetings/[id]/attendees/[attendeeId]` | Update attendee role/rsvp (existing, keep) |
| DELETE | `/api/meetings/[id]/attendees/[attendeeId]` | Remove attendee (existing, keep) |
| POST | `/api/meetings/[id]/attendees/[attendeeId]/rsvp` | RSVP response (accepted/declined/tentative) |
| GET | `/api/meetings/[id]/agenda` | List agenda items (existing, keep) |
| POST | `/api/meetings/[id]/agenda` | Create agenda item (existing, keep) |
| PUT | `/api/meetings/[id]/agenda/[agendaId]` | Update agenda item (existing, keep) |
| DELETE | `/api/meetings/[id]/agenda/[agendaId]` | Delete agenda item (existing, keep) |
| PUT | `/api/meetings/[id]/agenda/reorder` | Bulk reorder agenda items (body: [{id, orderIdx}]) |
| GET | `/api/meetings/[id]/attachments` | List meeting attachments |
| POST | `/api/meetings/[id]/attachments` | Add attachment (mindmap/link/task/doc) |
| PUT | `/api/meetings/[id]/attachments/[attachmentId]` | Update attachment (title, position) |
| DELETE | `/api/meetings/[id]/attachments/[attachmentId]` | Remove attachment |
| POST | `/api/meetings/[id]/attachments/fetch-og` | Fetch oEmbed/OG metadata for external link |
| GET | `/api/meetings/[id]/notes` | List all notes/decisions/actions |
| POST | `/api/meetings/[id]/notes` | Create note (type: note/decision/action) |
| PUT | `/api/meetings/[id]/notes/[noteId]` | Update note body or mark resolved |
| DELETE | `/api/meetings/[id]/notes/[noteId]` | Delete note |
| POST | `/api/meetings/[id]/notes/[noteId]/materialize` | Convert action note → task in PM |
| GET | `/api/meetings/[id]/pre-reads` | Get pre-read tracking for current user |
| PUT | `/api/meetings/[id]/pre-reads/[trackingId]` | Update pre-read status |
| POST | `/api/meetings/[id]/live/start` | Start live mode (sets liveStartedAt, transitions to in_progress) |
| POST | `/api/meetings/[id]/live/end` | End live mode (sets liveEndedAt, transitions to completed) |
| POST | `/api/meetings/[id]/live/agenda/[agendaId]/start` | Start stopwatch for agenda item |
| POST | `/api/meetings/[id]/live/agenda/[agendaId]/stop` | Stop stopwatch for agenda item |
| GET | `/api/meetings/[id]/decisions` | List all decision notes for this meeting |
| GET | `/api/projects/[projectId]/decisions` | Decisions table for entire project |
| POST | `/api/meetings/[id]/ai/generate-agenda` | AI: generate agenda from objective+attendees |
| POST | `/api/meetings/[id]/ai/generate-briefing` | AI: generate briefing from context+agenda |
| POST | `/api/meetings/[id]/ai/suggest-attendees` | AI: suggest attendees based on context |
| POST | `/api/meetings/[id]/ai/summarize-attachments` | AI: summarize pre-read attachments |
| POST | `/api/meetings/[id]/ai/live-summarize` | AI: live streaming summarizer of notes |
| POST | `/api/meetings/[id]/ai/post-recap` | AI: generate post-meeting recap from notes |
| POST | `/api/meetings/[id]/ai/extract-actions` | AI: extract action items from notes |
| POST | `/api/meetings/[id]/distribute` | Send recap by email to all attendees (via Resend) |

---

## 3. React Components — Complete File List

### 3.1 Mindmaps Module

#### Store / State
| File | Responsibility |
|------|----------------|
| `src/store/mindmap-store.ts` | Zustand store: nodes, edges, selection, undo/redo stack (100 steps), layout mode, theme, multi-select set |

#### Lib / Utilities
| File | Responsibility |
|------|----------------|
| `src/lib/mindmaps/mindmap-utils.ts` | EXTEND: add layout algorithms (radial, tree-h, tree-v), edge helpers, clipboard ops |
| `src/lib/mindmaps/dagre-layout.ts` | NEW: dagre-based tree-h and tree-v layout computation |
| `src/lib/mindmaps/radial-layout.ts` | NEW: radial layout algorithm (root center, children on circle arcs) |
| `src/lib/mindmaps/mindmap-export.ts` | NEW: PNG (html-to-image), SVG, Markdown outline, OPML serializers |
| `src/lib/mindmaps/mindmap-shortcuts.ts` | NEW: keyboard shortcut registry and handler factory |

#### Canvas Core (replacing existing)
| File | Responsibility |
|------|----------------|
| `src/components/mindmaps/mindmap-canvas.tsx` | REPLACE: React Flow canvas with minimap, background, controls; connects to Zustand store |
| `src/components/mindmaps/mindmap-node.tsx` | REPLACE: React Flow custom node with shape variants (rect/circle/diamond), icon slot, collapse toggle, status badge, color fill |
| `src/components/mindmaps/mindmap-edge.tsx` | NEW: React Flow custom edge with style (solid/dashed/dotted), color, thickness controls |
| `src/components/mindmaps/mindmap-node-editor.tsx` | NEW: In-place TipTap inline editor for node label (bold/italic/code/link Markdown) |
| `src/components/mindmaps/mindmap-node-toolbar.tsx` | NEW: Floating toolbar on node select: add child, add sibling, delete, style, link task |
| `src/components/mindmaps/mindmap-minimap.tsx` | NEW: React Flow MiniMap wrapper with theme-aware colors |

#### Panels & Sidebar
| File | Responsibility |
|------|----------------|
| `src/components/mindmaps/mindmap-sidebar.tsx` | REPLACE: Node style panel (color, border, icon, shape), edge style panel, opens on selection |
| `src/components/mindmaps/mindmap-toolbar.tsx` | NEW: Top toolbar: layout switcher (radial/tree-h/tree-v), theme picker, zoom controls, fit-view, export menu, AI menu |
| `src/components/mindmaps/mindmap-command-palette.tsx` | NEW: Cmd+K command palette (cmdk): node actions, layout, AI, export |
| `src/components/mindmaps/mindmap-help.tsx` | NEW: ? hotkey help overlay listing all keyboard shortcuts |

#### PM Integration
| File | Responsibility |
|------|----------------|
| `src/components/mindmaps/mindmap-task-badge.tsx` | NEW: Badge on linked node showing task status pill; click opens task detail |
| `src/components/mindmaps/mindmap-task-linker.tsx` | NEW: Dropdown/search to link/unlink a node to an existing task |
| `src/components/mindmaps/mindmap-split-view.tsx` | NEW: Split-screen wrapper: left=canvas, right=tasks list panel with drag-to-canvas support |
| `src/components/mindmaps/mindmap-progress-rollup.tsx` | NEW: Progress bar on branch root node showing done/total tasks in subtree |

#### Collaboration
| File | Responsibility |
|------|----------------|
| `src/components/mindmaps/mindmap-comments.tsx` | NEW: Comment thread panel per node; shows all comments, resolve/delete actions |
| `src/components/mindmaps/mindmap-comment-dot.tsx` | NEW: Small comment indicator dot on node that has unresolved comments |
| `src/components/mindmaps/mindmap-version-history.tsx` | NEW: Sidebar panel listing saved versions; preview and restore buttons |
| `src/components/mindmaps/mindmap-live-cursors.tsx` | NEW: Yjs-based live cursor display (colored avatar pills tracking other users' viewport positions) |

#### AI Components
| File | Responsibility |
|------|----------------|
| `src/components/mindmaps/mindmap-ai-panel.tsx` | NEW: Floating AI panel: expand, summarize, reorganize, brainstorm, convert-to-plan with streaming output |
| `src/components/mindmaps/mindmap-brainstorm-overlay.tsx` | NEW: Brainstorm mode overlay: fullscreen streaming of AI-suggested nodes with accept/reject per suggestion |

#### List / Index
| File | Responsibility |
|------|----------------|
| `src/components/mindmaps/mindmap-list.tsx` | EXTEND: add sort, filter by status, thumbnail preview card |
| `src/components/mindmaps/mindmap-create-dialog.tsx` | NEW: Dialog to create new mindmap with title, description, initial layout choice |

#### Pages (App Router)
| File | Responsibility |
|------|----------------|
| `src/app/app/[workspace]/projects/[project]/mindmaps/page.tsx` | EXTEND: pass theme/layout to list, add create dialog |
| `src/app/app/[workspace]/projects/[project]/mindmaps/[mindmapId]/page.tsx` | REPLACE: wire React Flow canvas, pass edges, viewport state |

---

### 3.2 Meetings Module

#### Store / State
| File | Responsibility |
|------|----------------|
| `src/store/meeting-store.ts` | Zustand store: current meeting data, live mode state (activeItemId, elapsed, isRunning), notes buffer, UI mode (prep/live/recap) |

#### Lib / Utilities
| File | Responsibility |
|------|----------------|
| `src/lib/meetings/meeting-utils.ts` | EXTEND: add status transitions with DRI guard, decision-maker count warning helper, duration warning threshold |
| `src/lib/meetings/meeting-export.ts` | NEW: Markdown/email recap serializer, RSVP email template |

#### Core Meeting Detail (replacing existing)
| File | Responsibility |
|------|----------------|
| `src/components/meetings/meeting-detail.tsx` | REPLACE: Three-mode shell (Prep/Live/Recap) with mode switcher, integrates all sub-panels |
| `src/components/meetings/meeting-header.tsx` | NEW: Title, objective, type badge, status widget, DRI selector, scheduled datetime |
| `src/components/meetings/meeting-sidebar.tsx` | NEW: Right sidebar: status/DRI/type controls, date/time/duration, location/URL, attendee count summary |

#### Prep Mode
| File | Responsibility |
|------|----------------|
| `src/components/meetings/prep/meeting-prep-shell.tsx` | NEW: Prep mode layout: agenda + briefing + attachments tabs |
| `src/components/meetings/prep/agenda-editor.tsx` | REPLACE: Full drag-and-drop agenda editor (@dnd-kit/sortable), sub-items (1 level), type selector, duration input, owner picker, duration warning |
| `src/components/meetings/prep/briefing-editor.tsx` | NEW: TipTap block editor for briefing (replaces textarea); AI generate button |
| `src/components/meetings/prep/attachments-panel.tsx` | NEW: Attachment list with 3 origin types, OG preview cards, drag reorder |
| `src/components/meetings/prep/attachment-add-dialog.tsx` | NEW: Dialog: pick attachment type, search mindmaps/tasks/meetings or paste URL |
| `src/components/meetings/prep/attachment-og-preview.tsx` | NEW: OG/oEmbed preview card for external links |
| `src/components/meetings/prep/mindmap-embed-preview.tsx` | NEW: Read-only mini React Flow canvas for embedded mindmap previews |
| `src/components/meetings/prep/pre-read-checklist.tsx` | NEW: Per-attendee checklist of attachments with read status tracking |
| `src/components/meetings/prep/pre-questions-editor.tsx` | NEW: 1-3 pre-questions form; shows collected answers in brief |
| `src/components/meetings/prep/context-block.tsx` | NEW: Shows last recurring meeting link and open action items from previous meeting |

#### Attendees
| File | Responsibility |
|------|----------------|
| `src/components/meetings/attendee-manager.tsx` | REPLACE: Full attendee list with role badges (facilitator/scribe/decision-maker/contributor/optional/informed-after), RSVP status, warning if >8 decision-makers |
| `src/components/meetings/attendee-add-dialog.tsx` | NEW: Dialog to search workspace members and add with role |
| `src/components/meetings/rsvp-button.tsx` | NEW: RSVP response widget (accepted/declined/tentative) for current user |

#### Live Mode
| File | Responsibility |
|------|----------------|
| `src/components/meetings/live/meeting-live-shell.tsx` | NEW: Live mode fullscreen layout: header with meeting clock, active item, notes capture area |
| `src/components/meetings/live/live-agenda-runner.tsx` | NEW: Agenda items list in live mode; click to set active, per-item stopwatch, time overrun indicator |
| `src/components/meetings/live/live-item-timer.tsx` | NEW: Stopwatch per agenda item: elapsed/allocated display, start/pause/stop |
| `src/components/meetings/live/live-notes-capture.tsx` | NEW: Fast-capture panel: Cmd+D=decision, Cmd+A=action, Cmd+N=note shortcuts; TipTap mini editor per note |
| `src/components/meetings/live/live-decisions-bar.tsx` | NEW: Sticky sidebar: captured decisions and actions in current session |
| `src/components/meetings/live/live-ai-summarizer.tsx` | NEW: Real-time AI streaming summary panel that updates as notes are added |

#### Recap Mode
| File | Responsibility |
|------|----------------|
| `src/components/meetings/recap/meeting-recap-shell.tsx` | NEW: Recap mode layout: AI summary, notes review, action items, distribution controls |
| `src/components/meetings/recap/recap-editor.tsx` | NEW: TipTap editor for recap (replaces textarea), AI generate button |
| `src/components/meetings/recap/notes-review-panel.tsx` | NEW: Grouped view of all notes/decisions/actions captured during meeting |
| `src/components/meetings/recap/action-items-panel.tsx` | NEW: Action items list with materialize-to-task button per action |
| `src/components/meetings/recap/distribute-dialog.tsx` | NEW: Dialog to send recap by email; preview + confirm |

#### Decisions
| File | Responsibility |
|------|----------------|
| `src/components/meetings/decisions-table.tsx` | NEW: Full project-level decisions table showing all decisions from all meetings, filterable |

#### AI Components
| File | Responsibility |
|------|----------------|
| `src/components/meetings/meeting-ai-toolbar.tsx` | NEW: Contextual AI actions bar: generate agenda, generate briefing, suggest attendees, summarize attachments (shown in prep mode) |

#### List / Index
| File | Responsibility |
|------|----------------|
| `src/components/meetings/meeting-list.tsx` | REPLACE: Filter by type/status, calendar view toggle, meeting card with RSVP status |
| `src/components/meetings/meeting-card.tsx` | REPLACE: Card showing type badge, status, DRI, attendee count, RSVP pill, scheduled time |
| `src/components/meetings/meeting-create-dialog.tsx` | NEW: Dialog: title, type, DRI, scheduled date, duration, initial attendees |

#### Pages (App Router)
| File | Responsibility |
|------|----------------|
| `src/app/app/[workspace]/projects/[project]/meetings/page.tsx` | EXTEND: pass type/status filter, add create dialog |
| `src/app/app/[workspace]/projects/[project]/meetings/[meetingId]/page.tsx` | REPLACE: server component loads meeting + attachments + notes + timings; passes to MeetingDetail shell |
| `src/app/app/[workspace]/projects/[project]/decisions/page.tsx` | NEW: Project-level decisions table page |

---

## 4. Packages to Install

```bash
npm install \
  @xyflow/react \
  dagre \
  @types/dagre \
  elkjs \
  html-to-image \
  yjs \
  y-websocket \
  @y/react \
  @tiptap/extension-collaboration \
  @tiptap/extension-collaboration-cursor
```

### Package justifications:

| Package | Why |
|---------|-----|
| `@xyflow/react` | React Flow v12 — the canvas engine, replaces current manual SVG canvas |
| `dagre` + `@types/dagre` | Tree-h and tree-v auto-layout algorithm for React Flow |
| `elkjs` | Alternative layout engine for complex graphs (radial, force-directed); optional but spec-mentioned |
| `html-to-image` | PNG/SVG export of the React Flow canvas DOM node |
| `yjs` | CRDT engine for collaborative real-time cursors and conflict-free editing |
| `y-websocket` | WebSocket provider for Yjs — connects to a shared Yjs document per mindmap |
| `@y/react` | React hooks for Yjs awareness (cursor positions, user presence) |
| `@tiptap/extension-collaboration` | TipTap Yjs collaboration binding for shared document editing |
| `@tiptap/extension-collaboration-cursor` | Live cursor display in TipTap editors |

### Already installed, no action needed:
- `@dnd-kit/*` — used for agenda reordering
- `@tiptap/*` — used for briefing and live notes editors
- `@anthropic-ai/sdk` — used for all AI features
- `cmdk` — used for command palette
- `zustand` — used for canvas and meeting stores
- `framer-motion` — used for animations
- `resend` — used for email distribution

---

## 5. Dev Agent Work Division

---

### MM-Dev-1 — Backend Mindmaps

**Owns:** All DB schema additions for mindmaps + all API routes (new and extended).

**Files to create/modify:**

```
MODIFY  src/db/schema.ts
          — Add enums: mindmapLayoutEnum, mindmapNodeShapeEnum, mindmapEdgeStyleEnum, mindmapThemeEnum
          — Extend mindmaps table: layout, theme, viewportX, viewportY, viewportZoom
          — Extend mindmapNodes table: shape, borderColor, icon, collapsed, manualPosition, linkedTaskStatus
          — Create mindmapEdges table + relations
          — Create mindmapNodeComments table + relations
          — Create mindmapVersions table + relations

MODIFY  src/app/api/mindmaps/route.ts
          — Keep existing GET/POST, extend POST to accept layout, theme

MODIFY  src/app/api/mindmaps/[id]/route.ts
          — Extend GET to include edges alongside nodes
          — Extend PUT to accept layout, theme, viewport fields

MODIFY  src/app/api/mindmaps/[id]/nodes/route.ts
          — Extend POST to accept shape, icon, borderColor, manualPosition

MODIFY  src/app/api/mindmaps/[id]/nodes/[nodeId]/route.ts
          — Extend PUT to accept shape, icon, borderColor, collapsed, manualPosition

CREATE  src/app/api/mindmaps/[id]/nodes/bulk/route.ts
          — POST: batch update positionX/positionY for multiple nodes (auto-layout save)

CREATE  src/app/api/mindmaps/[id]/edges/route.ts
          — GET: list edges; POST: create edge

CREATE  src/app/api/mindmaps/[id]/edges/[edgeId]/route.ts
          — PUT: update edge style; DELETE: remove edge

CREATE  src/app/api/mindmaps/[id]/nodes/[nodeId]/comments/route.ts
          — GET: list comments; POST: add comment

CREATE  src/app/api/mindmaps/[id]/nodes/[nodeId]/comments/[commentId]/route.ts
          — PUT: edit/resolve comment; DELETE: remove comment

CREATE  src/app/api/mindmaps/[id]/versions/route.ts
          — GET: list versions; POST: save snapshot

CREATE  src/app/api/mindmaps/[id]/versions/[versionId]/route.ts
          — GET: get snapshot

CREATE  src/app/api/mindmaps/[id]/versions/[versionId]/restore/route.ts
          — POST: restore mindmap to snapshot (replaces nodes+edges)

CREATE  src/app/api/mindmaps/[id]/export/route.ts
          — POST: body {format: 'png'|'svg'|'md'|'opml'}; for md/opml returns text; png/svg are client-side

CREATE  src/app/api/mindmaps/[id]/ai/expand/route.ts
          — POST: {nodeId, context} → streaming text/event-stream of suggested child labels

CREATE  src/app/api/mindmaps/[id]/ai/summarize/route.ts
          — POST: {rootNodeId} → text summary of branch

CREATE  src/app/api/mindmaps/[id]/ai/reorganize/route.ts
          — POST: returns suggested new parent assignments as JSON

CREATE  src/app/api/mindmaps/[id]/ai/brainstorm/route.ts
          — POST: {topic} → streaming node suggestions

CREATE  src/app/api/mindmaps/[id]/ai/convert-to-plan/route.ts
          — POST: converts entire mindmap nodes to a structured task list

MODIFY  src/lib/mindmaps/mindmap-utils.ts
          — Add: getEdgesForNodes(), computeRadialLayout(), exportToMarkdown(), exportToOPML()
          — Types: MindmapEdge, MindmapNodeComment, MindmapVersion

CREATE  src/lib/mindmaps/dagre-layout.ts
          — computeTreeLayout(nodes, direction: 'LR'|'TB'): LayoutedNode[]

CREATE  src/lib/mindmaps/radial-layout.ts
          — computeRadialLayout(nodes): LayoutedNode[]

CREATE  src/lib/mindmaps/mindmap-export.ts
          — toMarkdownOutline(nodes): string
          — toOPML(nodes): string
          — (PNG/SVG export handled client-side via html-to-image)
```

**Migration file to create:**
```
CREATE  src/db/migrations/0002_mindmaps_full.sql
          — All ALTER TABLE and CREATE TABLE statements from Section 1
```

---

### MM-Dev-2 — Canvas Core (React Flow)

**Owns:** Complete replacement of the canvas, node, edge components; keyboard shortcuts; undo/redo store.

**Dependencies:** MM-Dev-1 must finish schema + bulk nodes endpoint first.

**Files to create/modify:**

```
CREATE  src/store/mindmap-store.ts
          — Zustand store: nodes[], edges[], selectedIds: Set<string>,
            editingId, undoStack[], redoStack[] (max 100), layoutMode, theme,
            viewport, multiSelectLasso, collapsedIds: Set<string>
          — Actions: setNodes, setEdges, selectNode, multiSelect, lassoSelect,
            startEdit, commitEdit, addNode, addSibling, deleteSelected, 
            collapseNode, expandNode, changeParent, undo, redo, setLayout,
            setTheme, setViewport, bulkUpdatePositions

CREATE  src/components/mindmaps/mindmap-canvas.tsx   [REPLACE EXISTING]
          — React Flow provider, custom node/edge types registration,
            Background, MiniMap, Controls, panel slots
          — Wire all keyboard shortcuts (Tab/Enter/Delete/Space/Cmd+Z/Cmd+Y/Cmd+K/?)
          — Pan/zoom sync with viewport store
          — Lasso selection (SelectionBox)
          — Drop zone for tasks dragged from split-view

CREATE  src/components/mindmaps/mindmap-node.tsx     [REPLACE EXISTING]
          — React Flow NodeProps handler
          — Renders shape variant: rect=rounded rect, circle=circle, diamond=rotate(45deg) rect
          — Icon slot (lucide dynamic import by name)
          — Color fill + border color
          — Collapse toggle button (shows child count badge when collapsed)
          — Task status badge (from linkedTaskStatus cache)
          — Comment indicator dot
          — Selected ring using React Flow selection class
          — Double-click → enters MindmapNodeEditor

CREATE  src/components/mindmaps/mindmap-edge.tsx
          — React Flow EdgeProps handler
          — Bezier/straight/step path variants
          — Solid/dashed/dotted stroke-dasharray
          — Color + thickness from edge data
          — Selected highlight

CREATE  src/components/mindmaps/mindmap-node-editor.tsx
          — TipTap inline editor constrained to single-line formatting
          — Extensions: Bold, Italic, Code, Link only
          — onBlur/Enter → commit to store + API

CREATE  src/components/mindmaps/mindmap-node-toolbar.tsx
          — React Flow NodeToolbar component
          — Buttons: Add child (Tab), Add sibling (Enter), Delete, Style panel trigger, Link task
          — Appears on node select

CREATE  src/components/mindmaps/mindmap-toolbar.tsx
          — Top bar: layout switcher (3 modes), theme picker (4 themes), zoom in/out, fit-view,
            export menu dropdown, AI menu dropdown, split-view toggle, history button
          — Uses Radix Select + DropdownMenu

CREATE  src/components/mindmaps/mindmap-minimap.tsx
          — React Flow MiniMap with nodeColor function reading node color from data
          — Theme-aware panel background

CREATE  src/components/mindmaps/mindmap-command-palette.tsx
          — cmdk Command+CommandList
          — Groups: Node Actions, Layout, AI Features, Export
          — Opens on Cmd+K, closes on Escape

CREATE  src/components/mindmaps/mindmap-help.tsx
          — Modal dialog listing all keyboard shortcuts in a two-column table
          — Opens on ? key when not editing

CREATE  src/lib/mindmaps/mindmap-shortcuts.ts
          — Shortcut map type + useEffect hook factory
          — Tab=addChild, Enter=addSibling, Delete/Backspace=deleteSelected,
            Space=startEdit, Cmd+Z=undo, Cmd+Y/Cmd+Shift+Z=redo,
            Cmd+K=openCommandPalette, ?=openHelp, Escape=deselect/closeEdit,
            Shift+click=multiSelect

MODIFY  src/app/app/[workspace]/projects/[project]/mindmaps/[mindmapId]/page.tsx
          — Fetch edges alongside nodes
          — Pass all data to new MindmapCanvas
          — Full-height layout (remove padding, use h-screen minus header)
```

---

### MM-Dev-3 — Advanced Mindmap Features

**Owns:** Layout engines, drag-to-reparent, multi-select bulk actions, collaboration, PM integration, AI panel, export, version history, comments.

**Dependencies:** MM-Dev-1 (API routes) + MM-Dev-2 (store + canvas) must be complete first.

**Files to create/modify:**

```
CREATE  src/lib/mindmaps/dagre-layout.ts
          — Uses dagre to compute x/y for all nodes given parent-child edges
          — Returns {id, x, y}[] — canvas then calls bulkUpdatePositions API

CREATE  src/lib/mindmaps/radial-layout.ts
          — Positions root at (0,0), first-level children on inner circle arc,
            deeper children on expanding arcs
          — Returns {id, x, y}[]

MODIFY  src/components/mindmaps/mindmap-canvas.tsx
          — Add onNodeDragStop handler: detect if dragged node is near another node
            (snap threshold 60px) → show "reparent" visual indicator → call changeParent action
          — Add SelectionBox drag for lasso multi-select
          — Add bulk action bar that appears when multiple nodes selected:
            (delete all, change color, collapse all)

CREATE  src/components/mindmaps/mindmap-sidebar.tsx  [REPLACE EXISTING]
          — Node style tab: color picker (12 presets + custom hex), border color picker,
            shape selector (rect/circle/diamond), icon picker (lucide search)
          — Edge style tab: color, thickness slider, style (solid/dashed/dotted), curve type
          — Appears as right panel when node or edge is selected
          — Debounced save to store + API on change

CREATE  src/components/mindmaps/mindmap-split-view.tsx
          — Left pane: mindmap canvas (flex-1)
          — Right pane: tasks list (resizable, min 280px) with DndContext
          — Tasks panel: filter by project, search, task card rows
          — Draggable task card → drop onto canvas node → links task to node

CREATE  src/components/mindmaps/mindmap-task-badge.tsx
          — Small pill overlay on node: status dot + abbreviated status text
          — Click opens Radix Popover with task title + link to task detail

CREATE  src/components/mindmaps/mindmap-task-linker.tsx
          — Radix Popover with task search combobox
          — On select: calls PUT /api/mindmaps/[id]/nodes/[nodeId] with linkedTaskId
          — Shows unlink option if already linked

CREATE  src/components/mindmaps/mindmap-progress-rollup.tsx
          — Reads all nodes in subtree, fetches their linked task statuses
          — Renders progress bar: done/total tasks
          — Positioned above branch root node using React Flow Panel

CREATE  src/components/mindmaps/mindmap-comments.tsx
          — Right panel tab: list of all node comments for the selected node
          — Comment thread: author avatar, body, timestamp, resolve button
          — Inline add comment form (textarea + submit)
          — Resolved comments shown collapsed

CREATE  src/components/mindmaps/mindmap-comment-dot.tsx
          — Tiny orange dot in top-right corner of nodes with unresolved comments
          — Rendered inside mindmap-node.tsx conditionally

CREATE  src/components/mindmaps/mindmap-version-history.tsx
          — Left panel tab: scrollable list of named snapshots
          — Each row: label (or auto "Snapshot #N"), timestamp, created-by avatar
          — Hover: preview button (shows read-only canvas overlay)
          — Restore button with confirmation dialog

CREATE  src/components/mindmaps/mindmap-live-cursors.tsx
          — Yjs awareness subscription
          — Renders colored avatar pills at other users' cursor positions
          — Uses CSS transform to convert viewport-space coords from awareness state

CREATE  src/components/mindmaps/mindmap-ai-panel.tsx
          — Floating panel (bottom-right, draggable)
          — Tabs: Expand, Summarize, Reorganize, Brainstorm, Convert to Plan
          — Each action calls respective AI API route
          — Streaming responses rendered with framer-motion typewriter effect
          — "Apply" button inserts AI suggestions as nodes

CREATE  src/components/mindmaps/mindmap-brainstorm-overlay.tsx
          — Full-screen semi-transparent overlay
          — Streams brainstorm ideas one-by-one as animated cards
          — Each card: Accept (adds as child node) or Dismiss

MODIFY  src/components/mindmaps/mindmap-list.tsx
          — Card view with thumbnail (static SVG of node count/structure)
          — Filter bar: status (draft/active/archived), sort (created/updated/title)
          — List/grid view toggle

CREATE  src/components/mindmaps/mindmap-create-dialog.tsx
          — Radix Dialog with form: title (required), description, layout preset (radial/tree-h/tree-v), theme
          — POST /api/mindmaps on submit, then redirect to editor
```

---

### MT-Dev-1 — Backend Meetings

**Owns:** All DB schema additions for meetings + all new API routes.

**Files to create/modify:**

```
MODIFY  src/db/schema.ts
          — Add enums: meetingTypeEnum, meetingAttachmentTypeEnum, preReadStatusEnum
          — Extend meetings table: meetingType, driId, recurringParentId, preQuestions,
            contextBlock, liveStartedAt, liveEndedAt, decisionsCount, actionItemsCount
          — Extend meetingAttendees: attendee_role enum add 'informed_after'
          — Create meetingAttachments table + relations
          — Create meetingNotes table + relations
          — Create meetingPreReadTracking table + relations
          — Create meetingAgendaTimings table + relations

MODIFY  src/app/api/meetings/route.ts
          — Extend GET: add type/status query filters
          — Extend POST: accept meetingType, driId

MODIFY  src/app/api/meetings/[id]/route.ts
          — Extend GET: include attachments + notes + timings in response
          — Extend PUT: accept meetingType, driId, preQuestions, contextBlock
          — Add DRI validation on status transition to 'scheduled' (driId required)

MODIFY  src/app/api/meetings/[id]/attendees/route.ts
          — Extend POST: accept 'informed_after' as valid role

CREATE  src/app/api/meetings/[id]/attendees/[attendeeId]/rsvp/route.ts
          — POST: {rsvp: 'accepted'|'declined'|'tentative'} — update own RSVP

CREATE  src/app/api/meetings/[id]/agenda/reorder/route.ts
          — PUT: [{id, orderIdx}] — bulk reorder, validates no duplicate indices

MODIFY  src/app/api/meetings/[id]/agenda/route.ts
          — Extend POST: support sub-items with parentItemId validation (max 1 level)

CREATE  src/app/api/meetings/[id]/attachments/route.ts
          — GET: list attachments; POST: create attachment (all 3 types)

CREATE  src/app/api/meetings/[id]/attachments/[attachmentId]/route.ts
          — PUT: update title, position; DELETE: remove

CREATE  src/app/api/meetings/[id]/attachments/fetch-og/route.ts
          — POST: {url} → fetch OG/oEmbed metadata, return og_title/description/image/provider

CREATE  src/app/api/meetings/[id]/notes/route.ts
          — GET: list notes with optional ?type= filter; POST: create note

CREATE  src/app/api/meetings/[id]/notes/[noteId]/route.ts
          — PUT: update body, resolved flag, assignedTo, dueDate; DELETE: remove

CREATE  src/app/api/meetings/[id]/notes/[noteId]/materialize/route.ts
          — POST: creates a Task in the project from the action note, sets taskId on note

CREATE  src/app/api/meetings/[id]/pre-reads/route.ts
          — GET: tracking rows for current user

CREATE  src/app/api/meetings/[id]/pre-reads/[trackingId]/route.ts
          — PUT: {status} update pre-read status

CREATE  src/app/api/meetings/[id]/live/start/route.ts
          — POST: set liveStartedAt=now(), transition status to in_progress if scheduled

CREATE  src/app/api/meetings/[id]/live/end/route.ts
          — POST: set liveEndedAt=now(), transition status to completed

CREATE  src/app/api/meetings/[id]/live/agenda/[agendaId]/start/route.ts
          — POST: upsert meetingAgendaTimings row, set started_at=now()

CREATE  src/app/api/meetings/[id]/live/agenda/[agendaId]/stop/route.ts
          — POST: set ended_at=now(), compute elapsed_seconds

CREATE  src/app/api/meetings/[id]/decisions/route.ts
          — GET: list notes where note_type='decision' for this meeting

CREATE  src/app/api/projects/[projectId]/decisions/route.ts
          — GET: all decision notes across all meetings in the project

CREATE  src/app/api/meetings/[id]/distribute/route.ts
          — POST: send recap email via Resend to all attendees with accepted/tentative RSVP

CREATE  src/app/api/meetings/[id]/ai/generate-agenda/route.ts
          — POST: {objective, attendees, context} → streaming agenda items

CREATE  src/app/api/meetings/[id]/ai/generate-briefing/route.ts
          — POST: {agendaItems, context, preQuestions} → streaming briefing markdown

CREATE  src/app/api/meetings/[id]/ai/suggest-attendees/route.ts
          — POST: {objective, existingAttendees} → JSON list of suggested userIds with roles

CREATE  src/app/api/meetings/[id]/ai/summarize-attachments/route.ts
          — POST: fetches attachment metadata, returns summary per attachment

CREATE  src/app/api/meetings/[id]/ai/live-summarize/route.ts
          — POST: {notes[]} → streaming running summary

CREATE  src/app/api/meetings/[id]/ai/post-recap/route.ts
          — POST: {notes[], decisions[], actions[]} → streaming recap markdown

CREATE  src/app/api/meetings/[id]/ai/extract-actions/route.ts
          — POST: {notes[]} → JSON array of extracted action items {title, assigneeSuggestion, dueDateSuggestion}

MODIFY  src/lib/meetings/meeting-utils.ts
          — Add: getMeetingTypeLabel(), getDecisionMakerCount() warning helper,
            getAgendaDurationWarning(items, meetingDurationMin),
            meetingTypeRequiresDRI()

CREATE  src/lib/meetings/meeting-export.ts
          — toRecapEmail(meeting, notes, decisions, actions): string (HTML)
          — toRecapMarkdown(meeting, notes): string
```

---

### MT-Dev-2 — Meetings Core UI

**Owns:** All core meeting components: header, sidebar, attendees, agenda (with DnD), briefing editor, and the three-mode shell.

**Dependencies:** MT-Dev-1 (API routes) must be available first.

**Files to create/modify:**

```
CREATE  src/store/meeting-store.ts
          — Zustand: currentMeeting, mode ('prep'|'live'|'recap'),
            activeAgendaItemId, liveStartedAt, elapsedSeconds,
            isTimerRunning, notesBuffer[], pendingNotes[]
          — Actions: setMode, setActiveItem, startTimer, stopTimer,
            tickTimer, addNote, updateNote, deleteNote, setMeeting

MODIFY  src/components/meetings/meeting-detail.tsx   [REPLACE ENTIRELY]
          — Three-mode shell: renders MeetingPrepShell/MeetingLiveShell/MeetingRecapShell
            based on store mode
          — Mode switcher tabs: Prep / Live / Recap
          — Live tab disabled until meeting in_progress or completed
          — Recap tab disabled until completed

CREATE  src/components/meetings/meeting-header.tsx
          — Title (inline editable), objective (inline editable)
          — Type badge (colored pill per type)
          — Status widget with transitions dropdown (DRI guard on→scheduled)
          — DRI selector (member search combobox)
          — "Start Meeting" button when scheduled

CREATE  src/components/meetings/meeting-sidebar.tsx
          — Meeting type selector
          — Status change widget (reuses from header but compact)
          — Scheduled date/time picker
          — Duration selector (15/30/45/60/90/120 min)
          — Location input
          — Meeting URL input + open link
          — Attendee count summary + RSVP breakdown (X accepted, Y declined, Z pending)

MODIFY  src/components/meetings/attendee-manager.tsx   [REPLACE ENTIRELY]
          — Full attendee list with avatar + name + role badge + RSVP status
          — Role badge color-coded: facilitator=blue, scribe=purple,
            decision_maker=orange, contributor=gray, optional=slate, informed_after=muted
          — Warning banner if decision_maker count > 8
          — Remove button per attendee (with self-remove guard)
          — "Add attendee" button opens AttendeeAddDialog

CREATE  src/components/meetings/attendee-add-dialog.tsx
          — Radix Dialog with member search (combobox)
          — Role selector defaulting to contributor
          — Bulk add: can add multiple before closing

CREATE  src/components/meetings/rsvp-button.tsx
          — Three-state button: accepted/declined/tentative
          — Only visible/active for current user's own attendee row
          — Calls POST /api/meetings/[id]/attendees/[attendeeId]/rsvp

CREATE  src/components/meetings/prep/meeting-prep-shell.tsx
          — Layout: left main area (agenda editor / briefing editor / attachments — tabbed)
          — Right sidebar: meeting-sidebar.tsx
          — AI toolbar strip at top

MODIFY  src/components/meetings/prep/agenda-editor.tsx   [REPLACE ENTIRELY]
          — DndContext + SortableContext (@dnd-kit/sortable) on top-level items
          — Each item: drag handle, type icon+select, title (inline edit), duration (number input),
            owner picker, add-sub-item button, delete button
          — Sub-items shown indented under parent; also sortable within parent
          — Duration warning banner: if sum(topLevel durations) > meeting.durationMin
          — Total duration footer
          — Keyboard: Enter on item title = add next item, Tab = add sub-item, Escape = cancel

CREATE  src/components/meetings/prep/briefing-editor.tsx
          — TipTap editor with starter-kit + placeholder + link
          — Toolbar: bold, italic, h1/h2, bullet list, link
          — "Generate with AI" button → calls generate-briefing API → streams into editor
          — Auto-save debounce 800ms to PUT /api/meetings/[id]

CREATE  src/components/meetings/prep/attachments-panel.tsx
          — List of attachments in card grid
          — Each card shows: type icon, title, OG preview (for links), status badges
          — Pre-read checklist toggle per attachment (for current user)
          — Drag to reorder (DndContext + SortableContext)
          — "Add attachment" button opens AttachmentAddDialog

CREATE  src/components/meetings/prep/attachment-add-dialog.tsx
          — Three tabs: Mindmap (search project mindmaps), External Link (URL input + fetch OG),
            PM Docs (search tasks, other meetings)
          — Preview of OG metadata before confirming
          — POST /api/meetings/[id]/attachments on confirm

CREATE  src/components/meetings/prep/attachment-og-preview.tsx
          — Card: OG image, provider badge, title, description truncated
          — External link opens in new tab

CREATE  src/components/meetings/prep/mindmap-embed-preview.tsx
          — Reads mindmap nodes from API
          — Renders miniature read-only React Flow canvas (no interaction)
          — Fit-to-container on mount

CREATE  src/components/meetings/prep/pre-read-checklist.tsx
          — Per-attachment checklist per attendee (visible to current user for own status)
          — Shows name + current status with toggle buttons
          — Overview: "X of Y attendees have read all materials"

CREATE  src/components/meetings/prep/pre-questions-editor.tsx
          — Up to 3 question inputs (add/remove rows)
          — Each question shows collected answers inline (attendee name + answer text)
          — Saved to meeting.preQuestions jsonb via PUT /api/meetings/[id]

CREATE  src/components/meetings/prep/context-block.tsx
          — Shows link to "Previous meeting" (from recurringParentId or manual last meeting)
          — Shows list of open action items from previous meeting (fetches meeting notes)
          — Expandable/collapsible

MODIFY  src/components/meetings/meeting-list.tsx   [REPLACE ENTIRELY]
          — Filter bar: type multi-select, status multi-select, date range
          — List view (default): meeting-card rows with status color-coded left border
          — Grid view toggle
          — Empty states per filter combination
          — Pagination or virtual scroll for large lists

MODIFY  src/components/meetings/meeting-card.tsx   [REPLACE ENTIRELY]
          — Type badge (colored pill)
          — Status badge
          — Title + objective (truncated)
          — DRI avatar + name
          — Attendee count + RSVP summary chips
          — Scheduled time display
          — Note/decision/action counts (from cached counters)
          — Click → navigates to meeting detail

CREATE  src/components/meetings/meeting-create-dialog.tsx
          — Form: title, meeting type, DRI, scheduled datetime, duration, timezone
          — Optional: add initial attendees
          — POST /api/meetings then redirect to meeting detail

CREATE  src/components/meetings/meeting-ai-toolbar.tsx
          — Horizontal strip of AI action buttons (visible in Prep mode)
          — Generate Agenda, Generate Briefing, Suggest Attendees, Summarize Attachments
          — Each button opens a confirmation/streaming result panel inline

MODIFY  src/app/app/[workspace]/projects/[project]/meetings/page.tsx
          — Add MeetingCreateDialog, type/status filters, connect to new components

MODIFY  src/app/app/[workspace]/projects/[project]/meetings/[meetingId]/page.tsx
          — Load meeting with full relations: attendees, agendaItems, attachments, notes, timings
          — Pass all to updated MeetingDetail
```

---

### MT-Dev-3 — Meetings Advanced (Live Mode, Recap, Decisions, AI)

**Owns:** Live mode all components, Recap mode all components, project-level decisions table, AI streaming features, email distribution, mobile notes.

**Dependencies:** MT-Dev-1 (API routes) + MT-Dev-2 (shell + store) must be complete.

**Files to create/modify:**

```
CREATE  src/components/meetings/live/meeting-live-shell.tsx
          — Full-height layout with optional fullscreen (F key toggle)
          — Top strip: meeting title, elapsed time since liveStartedAt, End Meeting button
          — Main area: LiveAgendaRunner (left, 35%) + LiveNotesCapture (right, 65%)
          — Bottom strip: LiveDecisionsBar (collapsed by default, expandable)

CREATE  src/components/meetings/live/live-agenda-runner.tsx
          — Ordered agenda items list
          — Active item highlighted with green left border + timer
          — Click item → sets as active (store.setActiveItem)
          — Item row: position index, type icon, title, planned duration, elapsed/overrun indicator
          — Sub-items shown indented, togglable

CREATE  src/components/meetings/live/live-item-timer.tsx
          — Per-item stopwatch: mm:ss display
          — Progress ring (SVG circle) filling to plannedDurationMin
          — Color: green < 80%, yellow 80-100%, red > 100%
          — Start/Pause/Stop buttons → call live/agenda/[id]/start and stop APIs
          — On stop: elapsed time saved to meetingAgendaTimings

CREATE  src/components/meetings/live/live-notes-capture.tsx
          — Context-aware: always associated with the active agenda item
          — Quick capture bar at top: three mode buttons (Note/Decision/Action)
            or keyboard Cmd+N / Cmd+D / Cmd+A to switch type
          — TipTap editor (single block per note, Enter to commit + open new)
          — Action type: extra fields: assignee (member picker), due date
          — Committed notes appear below as note chips
          — POST /api/meetings/[id]/notes on commit

CREATE  src/components/meetings/live/live-decisions-bar.tsx
          — Expandable panel at bottom of live shell
          — Shows decisions and actions captured so far in the meeting
          — Decisions: quoted text with decision badge
          — Actions: text + assignee chip + due date
          — Export to recap button

CREATE  src/components/meetings/live/live-ai-summarizer.tsx
          — Toggle panel on the right side of live shell
          — "Summarize so far" button → calls ai/live-summarize with all notes so far
          — Streams result in styled blockquote; each click regenerates
          — Auto-refresh option (every 10 min with new notes)

CREATE  src/components/meetings/recap/meeting-recap-shell.tsx
          — Layout: recap editor (left, 60%) + action items panel + distribution (right, 40%)
          — Top: "Generate Recap with AI" button → calls ai/post-recap → streams into editor

CREATE  src/components/meetings/recap/recap-editor.tsx
          — TipTap block editor (replaces textarea)
          — Same extensions as briefing-editor
          — AI generate button (streaming)
          — Auto-save debounce 800ms to PUT /api/meetings/[id]

CREATE  src/components/meetings/recap/notes-review-panel.tsx
          — Grouped by agenda item: expandable sections
          — Within each section: Note chips (gray), Decision chips (green), Action chips (blue)
          — Edit inline, delete, reclassify type

CREATE  src/components/meetings/recap/action-items-panel.tsx
          — List of all notes where note_type='action'
          — Each: assignee avatar, title, due date, "Create Task" button
          — Create Task → POST /api/meetings/[id]/notes/[id]/materialize → shows task badge
          — Materialized actions show linked task pill (clickable)

CREATE  src/components/meetings/recap/distribute-dialog.tsx
          — Dialog: shows recipient list (accepted+tentative attendees)
          — Preview of recap email (HTML render of recapMd)
          — Confirm → POST /api/meetings/[id]/distribute
          — Success: shows sent confirmation with timestamp

CREATE  src/components/meetings/decisions-table.tsx
          — Table: Date | Meeting | Decision Text | Made By | Status
          — Filter: date range, meeting type
          — Link to source meeting
          — Used in project-level decisions page

CREATE  src/app/app/[workspace]/projects/[project]/decisions/page.tsx
          — Server component: fetches all decisions via GET /api/projects/[projectId]/decisions
          — Renders DecisionsTable
          — Breadcrumb navigation

-- Mobile support (read-only + RSVP + pre-reads):

CREATE  src/components/meetings/mobile/meeting-mobile-view.tsx
          — Detects mobile viewport (useMediaQuery hook or CSS)
          — Shows: meeting header, attendees (own RSVP), agenda (read-only), attachments list
          — Pre-read status toggle per attachment (own status only)
          — RSVP widget prominently at top
          — Notes shown read-only if meeting completed

-- AI panel for post-meeting:

MODIFY  src/components/meetings/meeting-ai-toolbar.tsx
          — In Recap mode: show AI Extract Actions button
          — Extract Actions → calls ai/extract-actions → pre-populates action-items-panel
```

---

## 6. Inter-Agent Dependency Graph

```
MM-Dev-1  ──────────────────────────────────►  MM-Dev-2
(Schema + APIs)                                 (Canvas Core)
     │                                                │
     │                                                ▼
     │                                          MM-Dev-3
     └──────────────────────────────────────►  (Advanced Features)

MT-Dev-1  ──────────────────────────────────►  MT-Dev-2
(Schema + APIs)                                 (Core UI)
     │                                                │
     │                                                ▼
     │                                          MT-Dev-3
     └──────────────────────────────────────►  (Live/Recap/AI)
```

**Critical path rules:**
1. MM-Dev-1 and MT-Dev-1 can start immediately and run in parallel.
2. MM-Dev-2 can start only after MM-Dev-1 completes the bulk-nodes endpoint and schema extensions.
3. MM-Dev-3 can start only after MM-Dev-2 has the Zustand store and canvas ready.
4. MT-Dev-2 can start only after MT-Dev-1 completes notes, attachments, live endpoints.
5. MT-Dev-3 can start only after MT-Dev-2 has the meeting-store, shell, and agenda-editor ready.

**Shared files — coordinate before editing:**
- `src/db/schema.ts` — MM-Dev-1 and MT-Dev-1 both modify this. They should run separate migration files and merge schema additions without conflict (different tables/enums).
- `src/lib/meetings/meeting-utils.ts` — MT-Dev-1 extends types; MT-Dev-2 imports them. MT-Dev-1 must export the new types first.
- `src/lib/mindmaps/mindmap-utils.ts` — MM-Dev-1 extends types; MM-Dev-2/3 import. Same rule.

---

## 7. Key Implementation Constraints

### React Flow setup (MM-Dev-2)
- Use `@xyflow/react` v12 (not the older `reactflow` package).
- Node types must be registered with `nodeTypes` prop: `{ mindmapNode: MindmapNodeComponent }`.
- Edge types registered with `edgeTypes` prop: `{ mindmapEdge: MindmapEdgeComponent }`.
- Use `useNodesState` / `useEdgesState` hooks initialized from Zustand store.
- Sync React Flow internal state back to Zustand on `onNodesChange` / `onEdgesChange`.
- `fitView` on mount using `useReactFlow().fitView()` inside `<ReactFlowProvider>`.

### Yjs / Real-time cursors (MM-Dev-3)
- Create a Yjs WebSocket server or use Supabase Realtime as an alternative transport.
- If no WS server available, use Supabase Realtime Broadcast channel per mindmapId for cursor positions only (simpler, no full CRDT needed for MVP collaboration).
- Yjs TipTap integration is only needed for briefing/notes editors if multi-user simultaneous editing is required. For V1, use standard TipTap with last-write-wins (debounced save).

### TipTap editors (MT-Dev-2, MT-Dev-3)
- Briefing editor and Recap editor use full TipTap starter-kit.
- Live notes capture uses a lightweight TipTap with only Paragraph + Bold + Italic + Link.
- All TipTap editors store both `body_tiptap` (JSON) and `body_md` (markdown via `generateHTML` + custom serializer) for search and export.

### AI Streaming (MM-Dev-1, MT-Dev-1)
- All AI routes use `@anthropic-ai/sdk` with `stream: true` and return `text/event-stream`.
- Client-side: use `ReadableStream` + `TextDecoder` to consume the stream.
- All AI routes require workspace membership check before calling Anthropic.
- Rate limiting: add a simple token counter check before streaming (can be a TODO comment stub for now).

### DRI guard on meeting status transition (MT-Dev-1)
- In `PUT /api/meetings/[id]` when status changes to `scheduled`:
  - Check `driId` is not null.
  - If null, return `422 { error: "DRI required to schedule a meeting" }`.
- This guard must also be reflected in the frontend status dropdown (MT-Dev-2): disable the `→ scheduled` transition if `meeting.driId` is null, show tooltip explaining why.

### Decision-maker count warning (MT-Dev-2)
- In `attendee-manager.tsx`: count attendees where role === 'decision_maker'.
- If count > 8: show amber warning banner: "Meetings with more than 8 decision-makers tend to be less effective."
- This is a UI-only warning, not a server-side block.

### Export — PNG/SVG (MM-Dev-3)
- PNG/SVG export is client-side only using `html-to-image` on the React Flow container div.
- The `/api/mindmaps/[id]/export` endpoint handles only Markdown and OPML (text formats).
- PNG: `toPng(canvasElement, { backgroundColor: '#fff' })` → triggers download.
- SVG: `toSvg(canvasElement)` → triggers download.

### Mobile (MT-Dev-3)
- Use Tailwind `md:` breakpoints; below `md` shows mobile layout.
- No separate route; same `/meetings/[meetingId]` page detects viewport in the MeetingDetail component.
- Live mode is desktop-only; mobile shows a "Switch to desktop for Live mode" banner.

---

## 8. File Tree Summary (new/modified files only)

```
src/
├── db/
│   ├── schema.ts                                          [MODIFY — both MM-Dev-1 and MT-Dev-1]
│   └── migrations/
│       ├── 0002_mindmaps_full.sql                         [CREATE — MM-Dev-1]
│       └── 0003_meetings_full.sql                         [CREATE — MT-Dev-1]
├── store/
│   ├── mindmap-store.ts                                   [CREATE — MM-Dev-2]
│   └── meeting-store.ts                                   [CREATE — MT-Dev-2]
├── lib/
│   ├── mindmaps/
│   │   ├── mindmap-utils.ts                               [MODIFY — MM-Dev-1]
│   │   ├── dagre-layout.ts                                [CREATE — MM-Dev-1/3]
│   │   ├── radial-layout.ts                               [CREATE — MM-Dev-1/3]
│   │   ├── mindmap-export.ts                              [CREATE — MM-Dev-1]
│   │   └── mindmap-shortcuts.ts                           [CREATE — MM-Dev-2]
│   └── meetings/
│       ├── meeting-utils.ts                               [MODIFY — MT-Dev-1]
│       └── meeting-export.ts                              [CREATE — MT-Dev-1]
├── app/
│   └── api/
│       ├── mindmaps/
│       │   ├── route.ts                                   [MODIFY — MM-Dev-1]
│       │   └── [id]/
│       │       ├── route.ts                               [MODIFY — MM-Dev-1]
│       │       ├── nodes/
│       │       │   ├── route.ts                           [MODIFY — MM-Dev-1]
│       │       │   ├── bulk/route.ts                      [CREATE — MM-Dev-1]
│       │       │   └── [nodeId]/
│       │       │       ├── route.ts                       [MODIFY — MM-Dev-1]
│       │       │       └── comments/
│       │       │           ├── route.ts                   [CREATE — MM-Dev-1]
│       │       │           └── [commentId]/route.ts       [CREATE — MM-Dev-1]
│       │       ├── edges/
│       │       │   ├── route.ts                           [CREATE — MM-Dev-1]
│       │       │   └── [edgeId]/route.ts                  [CREATE — MM-Dev-1]
│       │       ├── versions/
│       │       │   ├── route.ts                           [CREATE — MM-Dev-1]
│       │       │   └── [versionId]/
│       │       │       ├── route.ts                       [CREATE — MM-Dev-1]
│       │       │       └── restore/route.ts               [CREATE — MM-Dev-1]
│       │       ├── export/route.ts                        [CREATE — MM-Dev-1]
│       │       ├── comments/route.ts                      [CREATE — MM-Dev-1]
│       │       └── ai/
│       │           ├── expand/route.ts                    [CREATE — MM-Dev-1]
│       │           ├── summarize/route.ts                 [CREATE — MM-Dev-1]
│       │           ├── reorganize/route.ts                [CREATE — MM-Dev-1]
│       │           ├── brainstorm/route.ts                [CREATE — MM-Dev-1]
│       │           └── convert-to-plan/route.ts           [CREATE — MM-Dev-1]
│       ├── meetings/
│       │   ├── route.ts                                   [MODIFY — MT-Dev-1]
│       │   └── [id]/
│       │       ├── route.ts                               [MODIFY — MT-Dev-1]
│       │       ├── attendees/
│       │       │   ├── route.ts                           [MODIFY — MT-Dev-1]
│       │       │   └── [attendeeId]/
│       │       │       ├── route.ts                       [keep existing]
│       │       │       └── rsvp/route.ts                  [CREATE — MT-Dev-1]
│       │       ├── agenda/
│       │       │   ├── route.ts                           [MODIFY — MT-Dev-1]
│       │       │   ├── reorder/route.ts                   [CREATE — MT-Dev-1]
│       │       │   └── [agendaId]/route.ts                [keep existing]
│       │       ├── attachments/
│       │       │   ├── route.ts                           [CREATE — MT-Dev-1]
│       │       │   ├── [attachmentId]/route.ts            [CREATE — MT-Dev-1]
│       │       │   └── fetch-og/route.ts                  [CREATE — MT-Dev-1]
│       │       ├── notes/
│       │       │   ├── route.ts                           [CREATE — MT-Dev-1]
│       │       │   └── [noteId]/
│       │       │       ├── route.ts                       [CREATE — MT-Dev-1]
│       │       │       └── materialize/route.ts           [CREATE — MT-Dev-1]
│       │       ├── pre-reads/
│       │       │   ├── route.ts                           [CREATE — MT-Dev-1]
│       │       │   └── [trackingId]/route.ts              [CREATE — MT-Dev-1]
│       │       ├── live/
│       │       │   ├── start/route.ts                     [CREATE — MT-Dev-1]
│       │       │   ├── end/route.ts                       [CREATE — MT-Dev-1]
│       │       │   └── agenda/[agendaId]/
│       │       │       ├── start/route.ts                 [CREATE — MT-Dev-1]
│       │       │       └── stop/route.ts                  [CREATE — MT-Dev-1]
│       │       ├── decisions/route.ts                     [CREATE — MT-Dev-1]
│       │       ├── distribute/route.ts                    [CREATE — MT-Dev-1]
│       │       └── ai/
│       │           ├── generate-agenda/route.ts           [CREATE — MT-Dev-1]
│       │           ├── generate-briefing/route.ts         [CREATE — MT-Dev-1]
│       │           ├── suggest-attendees/route.ts         [CREATE — MT-Dev-1]
│       │           ├── summarize-attachments/route.ts     [CREATE — MT-Dev-1]
│       │           ├── live-summarize/route.ts            [CREATE — MT-Dev-1]
│       │           ├── post-recap/route.ts                [CREATE — MT-Dev-1]
│       │           └── extract-actions/route.ts           [CREATE — MT-Dev-1]
│       └── projects/[projectId]/decisions/route.ts        [CREATE — MT-Dev-1]
│
│   └── app/[workspace]/projects/[project]/
│       ├── mindmaps/
│       │   ├── page.tsx                                   [MODIFY — MM-Dev-3]
│       │   └── [mindmapId]/page.tsx                       [MODIFY — MM-Dev-2]
│       ├── meetings/
│       │   ├── page.tsx                                   [MODIFY — MT-Dev-2]
│       │   └── [meetingId]/page.tsx                       [MODIFY — MT-Dev-2]
│       └── decisions/page.tsx                             [CREATE — MT-Dev-3]
│
└── components/
    ├── mindmaps/
    │   ├── mindmap-canvas.tsx                             [REPLACE — MM-Dev-2]
    │   ├── mindmap-node.tsx                               [REPLACE — MM-Dev-2]
    │   ├── mindmap-edge.tsx                               [CREATE — MM-Dev-2]
    │   ├── mindmap-node-editor.tsx                        [CREATE — MM-Dev-2]
    │   ├── mindmap-node-toolbar.tsx                       [CREATE — MM-Dev-2]
    │   ├── mindmap-minimap.tsx                            [CREATE — MM-Dev-2]
    │   ├── mindmap-toolbar.tsx                            [CREATE — MM-Dev-2]
    │   ├── mindmap-command-palette.tsx                    [CREATE — MM-Dev-2]
    │   ├── mindmap-help.tsx                               [CREATE — MM-Dev-2]
    │   ├── mindmap-sidebar.tsx                            [REPLACE — MM-Dev-3]
    │   ├── mindmap-split-view.tsx                         [CREATE — MM-Dev-3]
    │   ├── mindmap-task-badge.tsx                         [CREATE — MM-Dev-3]
    │   ├── mindmap-task-linker.tsx                        [CREATE — MM-Dev-3]
    │   ├── mindmap-progress-rollup.tsx                    [CREATE — MM-Dev-3]
    │   ├── mindmap-comments.tsx                           [CREATE — MM-Dev-3]
    │   ├── mindmap-comment-dot.tsx                        [CREATE — MM-Dev-3]
    │   ├── mindmap-version-history.tsx                    [CREATE — MM-Dev-3]
    │   ├── mindmap-live-cursors.tsx                       [CREATE — MM-Dev-3]
    │   ├── mindmap-ai-panel.tsx                           [CREATE — MM-Dev-3]
    │   ├── mindmap-brainstorm-overlay.tsx                 [CREATE — MM-Dev-3]
    │   ├── mindmap-list.tsx                               [MODIFY — MM-Dev-3]
    │   └── mindmap-create-dialog.tsx                      [CREATE — MM-Dev-3]
    └── meetings/
        ├── meeting-detail.tsx                             [REPLACE — MT-Dev-2]
        ├── meeting-header.tsx                             [CREATE — MT-Dev-2]
        ├── meeting-sidebar.tsx                            [CREATE — MT-Dev-2]
        ├── meeting-create-dialog.tsx                      [CREATE — MT-Dev-2]
        ├── meeting-list.tsx                               [REPLACE — MT-Dev-2]
        ├── meeting-card.tsx                               [REPLACE — MT-Dev-2]
        ├── meeting-ai-toolbar.tsx                         [CREATE — MT-Dev-2/3]
        ├── attendee-manager.tsx                           [REPLACE — MT-Dev-2]
        ├── attendee-add-dialog.tsx                        [CREATE — MT-Dev-2]
        ├── rsvp-button.tsx                                [CREATE — MT-Dev-2]
        ├── decisions-table.tsx                            [CREATE — MT-Dev-3]
        ├── prep/
        │   ├── meeting-prep-shell.tsx                     [CREATE — MT-Dev-2]
        │   ├── agenda-editor.tsx                          [REPLACE — MT-Dev-2]
        │   ├── briefing-editor.tsx                        [CREATE — MT-Dev-2]
        │   ├── attachments-panel.tsx                      [CREATE — MT-Dev-2]
        │   ├── attachment-add-dialog.tsx                  [CREATE — MT-Dev-2]
        │   ├── attachment-og-preview.tsx                  [CREATE — MT-Dev-2]
        │   ├── mindmap-embed-preview.tsx                  [CREATE — MT-Dev-2]
        │   ├── pre-read-checklist.tsx                     [CREATE — MT-Dev-2]
        │   ├── pre-questions-editor.tsx                   [CREATE — MT-Dev-2]
        │   └── context-block.tsx                          [CREATE — MT-Dev-2]
        ├── live/
        │   ├── meeting-live-shell.tsx                     [CREATE — MT-Dev-3]
        │   ├── live-agenda-runner.tsx                     [CREATE — MT-Dev-3]
        │   ├── live-item-timer.tsx                        [CREATE — MT-Dev-3]
        │   ├── live-notes-capture.tsx                     [CREATE — MT-Dev-3]
        │   ├── live-decisions-bar.tsx                     [CREATE — MT-Dev-3]
        │   └── live-ai-summarizer.tsx                     [CREATE — MT-Dev-3]
        ├── recap/
        │   ├── meeting-recap-shell.tsx                    [CREATE — MT-Dev-3]
        │   ├── recap-editor.tsx                           [CREATE — MT-Dev-3]
        │   ├── notes-review-panel.tsx                     [CREATE — MT-Dev-3]
        │   ├── action-items-panel.tsx                     [CREATE — MT-Dev-3]
        │   └── distribute-dialog.tsx                      [CREATE — MT-Dev-3]
        └── mobile/
            └── meeting-mobile-view.tsx                    [CREATE — MT-Dev-3]
```

---

*Total new/modified files: ~100. All 6 agents can start MM-Dev-1 and MT-Dev-1 immediately. No phasing — deliver complete implementation per agent scope.*
