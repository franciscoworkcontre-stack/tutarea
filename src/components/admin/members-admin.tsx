"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  UserPlus,
  Search,
  MoreHorizontal,
  Mail,
  Clock,
  Shield,
  User,
} from "lucide-react";
import { formatDate, getInitials, spring } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { workspaces, workspaceMembers, profiles, invitations } from "@/db/schema";
import InviteModal from "./invite-modal";

type Workspace = InferSelectModel<typeof workspaces>;
type WorkspaceMember = InferSelectModel<typeof workspaceMembers>;
type Profile = InferSelectModel<typeof profiles>;
type Invitation = InferSelectModel<typeof invitations>;

type MemberWithProfile = WorkspaceMember & { profile: Profile | null };

type Props = {
  workspace: Workspace;
  members: MemberWithProfile[];
  pendingInvitations: Invitation[];
  currentUserId: string;
  currentRole: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  admin: "Admin",
  member: "Miembro",
  viewer: "Observador",
  guest: "Invitado",
};

export default function MembersAdmin({
  workspace,
  members,
  pendingInvitations,
  currentUserId,
  currentRole,
}: Props) {
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [localMembers, setLocalMembers] = useState(members);

  const filtered = localMembers.filter((m) => {
    const name = m.profile?.fullName ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const updateRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Error al actualizar rol");
      setLocalMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, role: newRole as WorkspaceMember["role"] } : m
        )
      );
      toast.success("Rol actualizado");
    } catch {
      toast.error("Error al actualizar rol");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tighter">Equipo</h1>
          <p className="text-text-muted text-sm mt-0.5">
            {localMembers.length} miembro{localMembers.length !== 1 ? "s" : ""} en {workspace.name}
          </p>
        </div>
        <motion.button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-accent-fg rounded-xl font-medium text-sm hover:bg-accent/90 transition-colors min-h-[44px] self-start sm:self-auto"
          whileTap={{ scale: 0.97 }}
        >
          <UserPlus className="w-4 h-4" />
          Invitar miembros
        </motion.button>
      </motion.div>

      {/* Search & filters */}
      <motion.div
        className="flex items-center gap-3 mb-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar miembro..."
            className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
      </motion.div>

      {/* Members table */}
      <motion.div
        className="rounded-xl border border-border overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center px-4 py-3 bg-surface border-b border-border text-xs font-medium text-text-muted uppercase tracking-wider gap-4">
          <div />
          <div>Miembro</div>
          <div>Rol</div>
          <div className="hidden sm:block">Unido</div>
          <div />
        </div>

        {filtered.map((member, i) => (
          <motion.div
            key={member.id}
            className="grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center px-4 py-3.5 border-b border-border last:border-0 hover:bg-surface/50 transition-colors gap-4 min-h-[44px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04, duration: 0.2 }}
          >
            <div
              className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium text-sm flex-shrink-0"
            >
              {getInitials(member.profile?.fullName)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {member.profile?.fullName ?? "Sin nombre"}
                {member.userId === currentUserId && (
                  <span className="ml-2 text-xs text-text-subtle">(tú)</span>
                )}
              </p>
            </div>
            <div>
              {(member.role as string) === "owner" ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent font-medium flex items-center gap-1 w-fit">
                  <Shield className="w-3 h-3" />
                  {ROLE_LABELS[member.role]}
                </span>
              ) : (
                <select
                  value={member.role}
                  onChange={(e) => updateRole(member.id, e.target.value)}
                  disabled={member.userId === currentUserId || currentRole === "admin" && member.role === "owner"}
                  className="text-xs bg-surface-2 border border-border rounded-lg px-2 py-1.5 outline-none focus:border-accent disabled:opacity-50"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Miembro</option>
                  <option value="viewer">Observador</option>
                  <option value="guest">Invitado</option>
                </select>
              )}
            </div>
            <div className="hidden sm:block text-xs text-text-subtle">
              {formatDate(member.joinedAt)}
            </div>
            <div>
              {member.userId !== currentUserId && member.role !== "owner" && (
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-text-subtle hover:text-text hover:bg-surface-2 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-text-subtle">
            No se encontraron miembros
          </div>
        )}
      </motion.div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted" />
            Invitaciones pendientes ({pendingInvitations.length})
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 min-h-[44px]"
              >
                <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-text-subtle" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-text-subtle">
                    Expira {formatDate(inv.expiresAt)}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-surface-2 border border-border text-text-muted capitalize flex-shrink-0">
                  {ROLE_LABELS[inv.role] ?? inv.role}
                </span>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="text-xs text-text-muted hover:text-text transition-colors min-h-[44px] px-1">
                    Reenviar
                  </button>
                  <button className="text-xs text-danger hover:text-danger/80 transition-colors min-h-[44px] px-1">
                    Revocar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {inviteOpen && (
          <InviteModal
            workspaceId={workspace.id}
            onClose={() => setInviteOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
