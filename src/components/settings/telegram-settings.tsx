"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  MessageCircle,
  Link2,
  Link2Off,
  Copy,
  CheckCircle2,
  Loader2,
  Mic,
  Zap,
} from "lucide-react";
import { spring } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { profiles } from "@/db/schema";

type Profile = InferSelectModel<typeof profiles>;

type Props = {
  profile: Profile | null;
  userId: string;
  workspaceSlug: string;
};

export default function TelegramSettings({ profile }: Props) {
  const [loading, setLoading] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isLinked = !!profile?.telegramChatId;
  const botUsername = process.env["NEXT_PUBLIC_TELEGRAM_BOT_USERNAME"] ?? "tutareabot";

  const generateLinkCode = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/link-code", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Error al generar código");
      const body = (await res.json()) as { code: string };
      setLinkCode(body.code);
    } catch {
      toast.error("Error al generar código de vinculación");
    } finally {
      setLoading(false);
    }
  };

  const unlink = async () => {
    try {
      const res = await fetch("/api/telegram/unlink", { method: "POST" });
      if (!res.ok) throw new Error("Error al desvincular");
      toast.success("Telegram desvinculado");
      window.location.reload();
    } catch {
      toast.error("Error al desvincular Telegram");
    }
  };

  const copyLink = () => {
    if (!linkCode) return;
    const url = `https://t.me/${botUsername}?start=link_${linkCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Enlace copiado");
  };

  const deepLink = linkCode
    ? `https://t.me/${botUsername}?start=link_${linkCode}`
    : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-info" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tighter">Telegram</h1>
            <p className="text-text-muted text-sm">
              Captura tareas con voz o texto desde tu chat.
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="mt-8">
          {isLinked ? (
            <div className="p-5 rounded-xl border border-success/30 bg-success/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div>
                    <p className="font-medium text-sm">Cuenta vinculada</p>
                    <p className="text-xs text-text-muted">
                      @{profile.telegramUsername ?? "usuario"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={unlink}
                  className="flex items-center gap-1.5 text-sm text-danger hover:text-danger/80 transition-colors px-3 py-1.5 rounded-lg border border-danger/20 hover:bg-danger/5"
                >
                  <Link2Off className="w-3.5 h-3.5" />
                  Desvincular
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl border border-border bg-surface space-y-4">
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Link2 className="w-4 h-4" />
                <span>Telegram no vinculado</span>
              </div>

              {!linkCode ? (
                <motion.button
                  onClick={generateLinkCode}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-fg rounded-xl font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
                  whileTap={{ scale: 0.97 }}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  Vincular Telegram
                </motion.button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring}
                  className="space-y-3"
                >
                  <p className="text-sm font-medium">
                    Tu código de vinculación:
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg border border-border font-mono text-xl tracking-widest">
                    <span className="flex-1 text-center">{linkCode}</span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Válido por 10 minutos. Abre el bot y envía{" "}
                    <code className="bg-surface-2 px-1 rounded">/start link_{linkCode}</code>
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={deepLink ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent text-accent-fg rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Abrir en Telegram
                    </a>
                    <button
                      onClick={copyLink}
                      className="px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-surface-2 transition-colors flex items-center gap-2"
                    >
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-8 space-y-4">
          <h2 className="font-semibold text-sm text-text-muted uppercase tracking-wider">
            Qué puedes hacer
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {telegramFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const telegramFeatures = [
  {
    icon: Mic,
    title: "Notas de voz → tareas",
    desc: "Envía un audio en español. La IA transcribe y extrae título, responsable, fecha y prioridad.",
  },
  {
    icon: MessageCircle,
    title: "Texto libre → tareas",
    desc: "\"Recordar a Juan revisar el contrato para mañana, urgente\" → tarea creada automáticamente.",
  },
  {
    icon: Zap,
    title: "Comandos rápidos",
    desc: "/today, /inbox, /tasks — gestiona tu trabajo sin abrir el navegador.",
  },
];
