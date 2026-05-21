"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { spring } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import type { InferSelectModel } from "drizzle-orm";
import type { invitations, workspaces } from "@/db/schema";

type Invitation = InferSelectModel<typeof invitations>;
type Workspace = InferSelectModel<typeof workspaces>;

type Props = {
  invitation: Invitation;
  workspace: Workspace | null;
  currentUser: User | null;
};

export default function InviteAccept({ invitation, workspace, currentUser }: Props) {
  const [loading, setLoading] = useState(false);

  const accept = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invitations/${invitation.token}/accept`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Error al aceptar");
      const body = (await res.json()) as { workspaceSlug: string };
      toast.success(`¡Bienvenido a ${workspace?.name}!`);
      window.location.href = `/app/${body.workspaceSlug}`;
    } catch {
      toast.error("Error al aceptar la invitación");
    } finally {
      setLoading(false);
    }
  };

  const wrongUser = currentUser && currentUser.email !== invitation.email;

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring}
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-accent-fg text-sm font-bold">T</span>
          </div>
          <span className="font-semibold tracking-tighter text-lg">tutarea</span>
        </div>

        <div className="p-6 rounded-2xl border border-border bg-surface">
          <p className="text-xs text-text-subtle mb-1">Invitación a workspace</p>
          <h1 className="text-2xl font-semibold tracking-tighter mb-1">
            {workspace?.name}
          </h1>
          <p className="text-text-muted text-sm mb-6">
            Te han invitado como <strong>{invitation.role}</strong> a este workspace.
          </p>

          {wrongUser && (
            <div className="mb-4 p-3 rounded-lg bg-warn/10 border border-warn/20 text-sm">
              <p>
                Esta invitación es para <strong>{invitation.email}</strong>.
                Estás conectado como <strong>{currentUser.email}</strong>.
              </p>
            </div>
          )}

          {currentUser && !wrongUser ? (
            <motion.button
              onClick={accept}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-accent-fg rounded-xl font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              whileTap={{ scale: 0.97 }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Aceptar invitación <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          ) : (
            <a
              href={`/signup?invite=${invitation.token}&email=${encodeURIComponent(invitation.email)}`}
              className="flex items-center justify-center gap-2 py-3 bg-accent text-accent-fg rounded-xl font-medium hover:bg-accent/90 transition-colors w-full"
            >
              Crear cuenta y aceptar <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>
      </motion.div>
    </div>
  );
}
