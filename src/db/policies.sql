-- Row Level Security Policies for tutarea
-- Run this after the initial migration

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_label_pivot ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is workspace member
CREATE OR REPLACE FUNCTION is_workspace_member(workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = $1
    AND workspace_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: check if user has write role in workspace
CREATE OR REPLACE FUNCTION has_workspace_write_role(workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = $1
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.role IN ('owner', 'admin', 'member')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- WORKSPACES
CREATE POLICY "Members can view their workspaces"
  ON workspaces FOR SELECT
  USING (is_workspace_member(id));

CREATE POLICY "Owners can update workspace"
  ON workspaces FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspaces.id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- WORKSPACE MEMBERS
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Admins can insert workspace members"
  ON workspace_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update workspace members"
  ON workspace_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete workspace members"
  ON workspace_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

-- Allow users to insert themselves during onboarding
CREATE POLICY "Users can join via invitation"
  ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- PROFILES
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- PROJECTS
CREATE POLICY "Members can view workspace projects"
  ON projects FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Members with write role can create projects"
  ON projects FOR INSERT
  WITH CHECK (has_workspace_write_role(workspace_id));

CREATE POLICY "Members with write role can update projects"
  ON projects FOR UPDATE
  USING (has_workspace_write_role(workspace_id));

-- TASK STATUSES
CREATE POLICY "Members can view task statuses"
  ON task_statuses FOR SELECT
  USING (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects WHERE projects.id = task_statuses.project_id
      AND is_workspace_member(projects.workspace_id)
    ))
    OR
    (workspace_id IS NOT NULL AND is_workspace_member(workspace_id))
  );

-- TASKS
CREATE POLICY "Members can view workspace tasks"
  ON tasks FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Members with write role can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (has_workspace_write_role(workspace_id));

CREATE POLICY "Members with write role can update tasks"
  ON tasks FOR UPDATE
  USING (has_workspace_write_role(workspace_id));

-- TASK COMMENTS
CREATE POLICY "Members can view comments"
  ON task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks WHERE tasks.id = task_comments.task_id
      AND is_workspace_member(tasks.workspace_id)
    )
  );

CREATE POLICY "Members can create comments"
  ON task_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks WHERE tasks.id = task_comments.task_id
      AND is_workspace_member(tasks.workspace_id)
    )
  );

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- TELEGRAM INBOX
CREATE POLICY "Users can view own telegram inbox"
  ON telegram_inbox FOR SELECT
  USING (user_id = auth.uid());

-- AUDIT LOG
CREATE POLICY "Admins can view audit log"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = audit_log.workspace_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Service role bypass (for server-side operations)
-- The service role key bypasses RLS by default in Supabase
