import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  jsonb,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "owner",
  "admin",
  "member",
  "viewer",
  "guest",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "archived",
]);

export const projectMemberRoleEnum = pgEnum("project_member_role", [
  "lead",
  "contributor",
  "viewer",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "no_priority",
  "low",
  "medium",
  "high",
  "urgent",
]);

export const taskStatusTypeEnum = pgEnum("task_status_type", [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
]);

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "user",
  "checkbox",
  "url",
]);

export const telegramMessageTypeEnum = pgEnum("telegram_message_type", [
  "text",
  "voice",
]);

export const telegramInboxStatusEnum = pgEnum("telegram_inbox_status", [
  "pending",
  "parsed",
  "converted",
  "failed",
  "dismissed",
]);

export const invitationRoleEnum = pgEnum("invitation_role", [
  "admin",
  "member",
  "viewer",
  "guest",
]);

// Workspaces
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  createdBy: uuid("created_by").notNull(),
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: workspaceMemberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    invitedBy: uuid("invited_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_user_idx").on(
      table.workspaceId,
      table.userId
    ),
  ]
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: invitationRoleEnum("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  invitedBy: uuid("invited_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Profiles
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  locale: text("locale").notNull().default("es-CL"),
  timezone: text("timezone").notNull().default("America/Santiago"),
  telegramChatId: text("telegram_chat_id").unique(),
  telegramUsername: text("telegram_username"),
  telegramLinkedAt: timestamp("telegram_linked_at", { withTimezone: true }),
  telegramLinkCode: text("telegram_link_code"),
  telegramLinkCodeExpiresAt: timestamp("telegram_link_code_expires_at", {
    withTimezone: true,
  }),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Projects
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  key: text("key").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color").notNull().default("#f57522"),
  status: projectStatusEnum("status").notNull().default("active"),
  leadId: uuid("lead_id"),
  createdBy: uuid("created_by").notNull(),
  position: real("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: projectMemberRoleEnum("role").notNull().default("contributor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_members_project_user_idx").on(
      table.projectId,
      table.userId
    ),
  ]
);

// Task Statuses
export const taskStatuses = pgTable("task_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#94a3b8"),
  type: taskStatusTypeEnum("type").notNull().default("todo"),
  position: real("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Task Labels
export const taskLabels = pgTable("task_labels", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#94a3b8"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Tasks
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentTaskId: uuid("parent_task_id"),
    key: text("key").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    statusId: uuid("status_id").references(() => taskStatuses.id),
    priority: taskPriorityEnum("priority").notNull().default("no_priority"),
    assigneeId: uuid("assignee_id"),
    reporterId: uuid("reporter_id"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    startDate: timestamp("start_date", { withTimezone: true }),
    estimateHours: real("estimate_hours"),
    position: text("position").notNull().default("a0"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_workspace_id_idx").on(table.workspaceId),
    index("tasks_assignee_id_idx").on(table.assigneeId),
    index("tasks_status_id_idx").on(table.statusId),
    uniqueIndex("tasks_key_project_idx").on(table.key, table.projectId),
  ]
);

export const taskLabelPivot = pgTable(
  "task_label_pivot",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => taskLabels.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("task_label_pivot_task_label_idx").on(
      table.taskId,
      table.labelId
    ),
  ]
);

export const taskWatchers = pgTable(
  "task_watchers",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    uniqueIndex("task_watchers_task_user_idx").on(table.taskId, table.userId),
  ]
);

export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: uuid("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskComments = pgTable("task_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull(),
  body: text("body").notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  parentCommentId: uuid("parent_comment_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskActivity = pgTable("task_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Custom Fields
export const customFields = pgTable("custom_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: customFieldTypeEnum("type").notNull().default("text"),
  config: jsonb("config"),
  position: real("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => customFields.id, { onDelete: "cascade" }),
    value: jsonb("value"),
  },
  (table) => [
    uniqueIndex("custom_field_values_task_field_idx").on(
      table.taskId,
      table.fieldId
    ),
  ]
);

// Notifications
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Telegram
export const telegramInbox = pgTable("telegram_inbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  messageId: text("message_id").notNull(),
  type: telegramMessageTypeEnum("type").notNull().default("text"),
  rawText: text("raw_text"),
  transcript: text("transcript"),
  audioUrl: text("audio_url"),
  parsed: jsonb("parsed"),
  taskId: uuid("task_id").references(() => tasks.id),
  status: telegramInboxStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Telegram Group Links
export const workspaceTelegramGroups = pgTable("workspace_telegram_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull().unique(),
  chatTitle: text("chat_title"),
  linkedBy: uuid("linked_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Audit Log
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id"),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
  invitations: many(invitations),
  notifications: many(notifications),
  auditLog: many(auditLog),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
  })
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  members: many(projectMembers),
  tasks: many(tasks),
  statuses: many(taskStatuses),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  workspace: one(workspaces, {
    fields: [tasks.workspaceId],
    references: [workspaces.id],
  }),
  status: one(taskStatuses, {
    fields: [tasks.statusId],
    references: [taskStatuses.id],
  }),
  comments: many(taskComments),
  attachments: many(taskAttachments),
  activity: many(taskActivity),
  labels: many(taskLabelPivot),
  subtasks: many(tasks, { relationName: "subtasks" }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
}));

// === MINDMAPS ===
export const mindmapStatusEnum = pgEnum("mindmap_status", ["draft", "active", "archived"]);
export const mindmapLayoutEnum = pgEnum("mindmap_layout", ["radial", "tree-h", "tree-v"]);
export const mindmapNodeShapeEnum = pgEnum("mindmap_node_shape", ["rounded", "circle", "diamond", "rect"]);
export const mindmapThemeEnum = pgEnum("mindmap_theme", ["light", "dark", "blueprint", "sepia"]);

export const mindmaps = pgTable("mindmaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: mindmapStatusEnum("status").notNull().default("draft"),
  layout: mindmapLayoutEnum("layout").notNull().default("radial"),
  theme: mindmapThemeEnum("theme").notNull().default("light"),
  settingsJsonb: jsonb("settings_jsonb").notNull().default({}),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mindmapNodes = pgTable("mindmap_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  mindmapId: uuid("mindmap_id").notNull().references(() => mindmaps.id, { onDelete: "cascade" }),
  parentNodeId: uuid("parent_node_id"),
  label: text("label").notNull(),
  content: text("content"),
  color: text("color").notNull().default("#94a3b8"),
  positionX: integer("position_x").notNull().default(0),
  positionY: integer("position_y").notNull().default(0),
  nodeOrder: integer("node_order").notNull().default(0),
  linkedTaskId: uuid("linked_task_id").references(() => tasks.id, { onDelete: "set null" }),
  styleJsonb: jsonb("style_jsonb").notNull().default({}),
  positionOverrideJsonb: jsonb("position_override_jsonb"),
  collapsedByJsonb: jsonb("collapsed_by_jsonb").notNull().default([]),
  orderInParent: integer("order_in_parent").notNull().default(0),
  metadataJsonb: jsonb("metadata_jsonb").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mindmapEdges = pgTable("mindmap_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  mindmapId: uuid("mindmap_id").notNull().references(() => mindmaps.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => mindmapNodes.id, { onDelete: "cascade" }),
  targetId: uuid("target_id").notNull().references(() => mindmapNodes.id, { onDelete: "cascade" }),
  isHierarchical: boolean("is_hierarchical").notNull().default(true),
  styleJsonb: jsonb("style_jsonb").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mindmapNodeComments = pgTable("mindmap_node_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  mindmapId: uuid("mindmap_id").notNull().references(() => mindmaps.id, { onDelete: "cascade" }),
  nodeId: uuid("node_id").notNull().references(() => mindmapNodes.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  content: text("content").notNull(),
  parentCommentId: uuid("parent_comment_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mindmapVersions = pgTable("mindmap_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  mindmapId: uuid("mindmap_id").notNull().references(() => mindmaps.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  snapshotJsonb: jsonb("snapshot_jsonb").notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mindmapsRelations = relations(mindmaps, ({ one, many }) => ({
  project: one(projects, { fields: [mindmaps.projectId], references: [projects.id] }),
  workspace: one(workspaces, { fields: [mindmaps.workspaceId], references: [workspaces.id] }),
  nodes: many(mindmapNodes),
  edges: many(mindmapEdges),
  versions: many(mindmapVersions),
}));

export const mindmapNodesRelations = relations(mindmapNodes, ({ one, many }) => ({
  mindmap: one(mindmaps, { fields: [mindmapNodes.mindmapId], references: [mindmaps.id] }),
  children: many(mindmapNodes, { relationName: "parent_children" }),
  parent: one(mindmapNodes, { fields: [mindmapNodes.parentNodeId], references: [mindmapNodes.id], relationName: "parent_children" }),
  linkedTask: one(tasks, { fields: [mindmapNodes.linkedTaskId], references: [tasks.id] }),
  comments: many(mindmapNodeComments),
  edgesAsSource: many(mindmapEdges, { relationName: "edges_source" }),
  edgesAsTarget: many(mindmapEdges, { relationName: "edges_target" }),
}));

export const mindmapEdgesRelations = relations(mindmapEdges, ({ one }) => ({
  mindmap: one(mindmaps, { fields: [mindmapEdges.mindmapId], references: [mindmaps.id] }),
  source: one(mindmapNodes, { fields: [mindmapEdges.sourceId], references: [mindmapNodes.id], relationName: "edges_source" }),
  target: one(mindmapNodes, { fields: [mindmapEdges.targetId], references: [mindmapNodes.id], relationName: "edges_target" }),
}));

export const mindmapNodeCommentsRelations = relations(mindmapNodeComments, ({ one }) => ({
  mindmap: one(mindmaps, { fields: [mindmapNodeComments.mindmapId], references: [mindmaps.id] }),
  node: one(mindmapNodes, { fields: [mindmapNodeComments.nodeId], references: [mindmapNodes.id] }),
}));

export const mindmapVersionsRelations = relations(mindmapVersions, ({ one }) => ({
  mindmap: one(mindmaps, { fields: [mindmapVersions.mindmapId], references: [mindmaps.id] }),
}));

// === MEETINGS ===
export const meetingStatusEnum = pgEnum("meeting_status", ["draft", "scheduled", "in_progress", "completed", "cancelled", "archived"]);
export const attendeeRoleEnum = pgEnum("attendee_role", ["facilitator", "scribe", "decision_maker", "contributor", "optional"]);
export const attendeeRsvpEnum = pgEnum("attendee_rsvp", ["pending", "accepted", "declined", "tentative"]);
export const agendaItemTypeEnum = pgEnum("agenda_item_type", ["discussion", "decision", "update", "brainstorm", "qa"]);
export const meetingTypeEnum = pgEnum("meeting_type", ["1-on-1", "team-sync", "decision", "brainstorm", "review", "retro", "kickoff", "custom"]);

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  objective: text("objective"),
  type: meetingTypeEnum("type").notNull().default("team-sync"),
  status: meetingStatusEnum("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  durationMin: integer("duration_min").notNull().default(60),
  timezone: text("timezone").notNull().default("America/Santiago"),
  location: text("location"),
  locationUrl: text("location_url"),
  meetingUrl: text("meeting_url"),
  briefingMd: text("briefing_md"),
  recapMd: text("recap_md"),
  settingsJsonb: jsonb("settings_jsonb").default({}),
  calendarEventId: text("calendar_event_id"),
  ownerId: uuid("owner_id").notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingAttendees = pgTable("meeting_attendees", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  role: attendeeRoleEnum("role").notNull().default("contributor"),
  rsvp: attendeeRsvpEnum("rsvp").notNull().default("pending"),
  preReadCompletionJsonb: jsonb("pre_read_completion_jsonb").default({}),
  informedAfter: boolean("informed_after").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingAgendaItems = pgTable("meeting_agenda_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  parentItemId: uuid("parent_item_id"),  // max 1 nivel de profundidad
  title: text("title").notNull(),
  ownerId: uuid("owner_id"),
  durationMin: integer("duration_min"),
  itemType: agendaItemTypeEnum("item_type").notNull().default("discussion"),
  notesMd: text("notes_md"),
  orderIdx: integer("order_idx").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingAttachments = pgTable("meeting_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  agendaItemId: uuid("agenda_item_id").references(() => meetingAgendaItems.id, { onDelete: "set null" }),
  sourceType: text("source_type").notNull(), // 'mindmap' | 'task' | 'meeting' | 'decision' | 'external_link'
  sourceRefId: uuid("source_ref_id"),
  externalUrl: text("external_url"),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  ogMetadataJsonb: jsonb("og_metadata_jsonb").default({}),
  preReadRequired: boolean("pre_read_required").notNull().default(false),
  aiSummaryMd: text("ai_summary_md"),
  addedBy: uuid("added_by").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingNotes = pgTable("meeting_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  agendaItemId: uuid("agenda_item_id").references(() => meetingAgendaItems.id, { onDelete: "set null" }),
  noteType: text("note_type").notNull(), // 'note' | 'decision' | 'action_item'
  contentMd: text("content_md").notNull(),
  authorId: uuid("author_id").notNull(),
  assigneeId: uuid("assignee_id"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  materializedTaskId: uuid("materialized_task_id").references(() => tasks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingPreQuestions = pgTable("meeting_pre_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  responsesJsonb: jsonb("responses_jsonb").default({}),
  orderIdx: integer("order_idx").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingDecisions = pgTable("meeting_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  meetingNoteId: uuid("meeting_note_id").references(() => meetingNotes.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  descriptionMd: text("description_md"),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  decidedBy: uuid("decided_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  project: one(projects, { fields: [meetings.projectId], references: [projects.id] }),
  workspace: one(workspaces, { fields: [meetings.workspaceId], references: [workspaces.id] }),
  attendees: many(meetingAttendees),
  agendaItems: many(meetingAgendaItems),
  attachments: many(meetingAttachments),
  notes: many(meetingNotes),
  preQuestions: many(meetingPreQuestions),
  decisions: many(meetingDecisions),
}));

export const meetingAttendeesRelations = relations(meetingAttendees, ({ one }) => ({
  meeting: one(meetings, { fields: [meetingAttendees.meetingId], references: [meetings.id] }),
}));

export const meetingAgendaItemsRelations = relations(meetingAgendaItems, ({ one, many }) => ({
  meeting: one(meetings, { fields: [meetingAgendaItems.meetingId], references: [meetings.id] }),
  children: many(meetingAgendaItems, { relationName: "agenda_parent_children" }),
  parent: one(meetingAgendaItems, { fields: [meetingAgendaItems.parentItemId], references: [meetingAgendaItems.id], relationName: "agenda_parent_children" }),
  attachments: many(meetingAttachments),
  notes: many(meetingNotes),
}));

export const meetingAttachmentsRelations = relations(meetingAttachments, ({ one }) => ({
  meeting: one(meetings, { fields: [meetingAttachments.meetingId], references: [meetings.id] }),
  agendaItem: one(meetingAgendaItems, { fields: [meetingAttachments.agendaItemId], references: [meetingAgendaItems.id] }),
}));

export const meetingNotesRelations = relations(meetingNotes, ({ one }) => ({
  meeting: one(meetings, { fields: [meetingNotes.meetingId], references: [meetings.id] }),
  agendaItem: one(meetingAgendaItems, { fields: [meetingNotes.agendaItemId], references: [meetingAgendaItems.id] }),
  materializedTask: one(tasks, { fields: [meetingNotes.materializedTaskId], references: [tasks.id] }),
}));

export const meetingPreQuestionsRelations = relations(meetingPreQuestions, ({ one }) => ({
  meeting: one(meetings, { fields: [meetingPreQuestions.meetingId], references: [meetings.id] }),
}));

export const meetingDecisionsRelations = relations(meetingDecisions, ({ one }) => ({
  project: one(projects, { fields: [meetingDecisions.projectId], references: [projects.id] }),
  workspace: one(workspaces, { fields: [meetingDecisions.workspaceId], references: [workspaces.id] }),
  meeting: one(meetings, { fields: [meetingDecisions.meetingId], references: [meetings.id] }),
  meetingNote: one(meetingNotes, { fields: [meetingDecisions.meetingNoteId], references: [meetingNotes.id] }),
}));
