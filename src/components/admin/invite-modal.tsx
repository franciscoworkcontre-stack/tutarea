"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X, Mail, Plus, Loader2 } from "lucide-react";
import { spring } from "@/lib/utils";

type Props = {
  workspaceId: string;
  onClose: () => void;
};

export default function InviteModal({ workspaceId, onClose }: Props) {
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [role, setRole] = useState("member");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const addEmail = () => {
    const newEmails = emailInput
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    setEmails((prev) => Array.from(new Set([...prev, ...newEmails])));
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleSubmit = async () => {
    if (emails.length === 0) {
      toast.error("Agrega al menos un email");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, role, message, workspaceId }),
      });
      if (!res.ok) throw new Error("Error al enviar invitaciones");
      const body = (await res.json()) as { count: number };
      toast.success(`${body.count} invitación${body.count !== 1 ? "es" : ""} enviada${body.count !== 1 ? "s" : ""}`);
      onClose();
    } catch {
      toast.error("Error al enviar invitaciones");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={spring}
      >
        <div className="bg-surface border border-border rounded-2xl shadow-3">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Invitar miembros</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-subtle hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Emails
              </label>
              <div className="min-h-20 p-3 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent transition-all">
                <div className="flex flex-wrap gap-2 mb-2">
                  {emails.map((email) => (
                    <span
                      key={email}
                      className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 text-accent text-xs rounded-full"
                    >
                      <Mail className="w-3 h-3" />
                      {email}
                      <button
                        onClick={() => removeEmail(email)}
                        className="hover:text-danger transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                  onBlur={addEmail}
                  placeholder={emails.length === 0 ? "email@empresa.com, otro@empresa.com..." : ""}
                  className="w-full text-sm bg-transparent outline-none placeholder:text-text-subtle"
                />
              </div>
              <p className="text-xs text-text-subtle mt-1">
                Pega múltiples emails separados por coma o Enter
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Rol
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="admin">Admin</option>
                <option value="member">Miembro</option>
                <option value="viewer">Observador</option>
                <option value="guest">Invitado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Mensaje (opcional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hola, te invito al workspace de Acme..."
                rows={2}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-surface-2 transition-colors"
              >
                Cancelar
              </button>
              <motion.button
                onClick={handleSubmit}
                disabled={loading || emails.length === 0}
                className="flex-1 py-2.5 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                whileTap={{ scale: 0.97 }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Enviar {emails.length > 0 && `(${emails.length})`}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
