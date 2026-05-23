"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, MessageCircle } from "lucide-react";
import { spring } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type State = "checking" | "linking" | "success" | "error" | "needs-login";

export default function TelegramAuthPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>("checking");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("No se encontró el token. Escríbele al bot de nuevo.");
      return;
    }

    async function run() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setState("needs-login");
        return;
      }

      setState("linking");
      try {
        const res = await fetch("/api/telegram/link-via-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json() as { ok?: boolean; error?: string };
        if (!res.ok) {
          setErrorMsg(data.error ?? "Error inesperado");
          setState("error");
        } else {
          setState("success");
        }
      } catch {
        setErrorMsg("Error de conexión. Intenta de nuevo.");
        setState("error");
      }
    }

    void run();
  }, [token]);

  const handleLogin = () => {
    router.push(`/login?next=/auth/telegram?token=${encodeURIComponent(token ?? "")}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 text-center shadow-lg"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-accent-fg text-sm font-bold">T</span>
          </div>
          <span className="font-semibold tracking-tighter text-lg">tutarea</span>
        </div>

        {state === "checking" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-4" />
            <p className="text-text-muted text-sm">Verificando...</p>
          </motion.div>
        )}

        {state === "linking" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-4" />
            <h2 className="font-semibold mb-1">Vinculando cuenta</h2>
            <p className="text-text-muted text-sm">Un momento...</p>
          </motion.div>
        )}

        {state === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
          >
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h2 className="font-semibold text-lg mb-2">¡Cuenta vinculada!</h2>
            <p className="text-text-muted text-sm mb-6">
              Ya puedes enviar mensajes al bot de Telegram para crear tareas en tu workspace.
            </p>
            <div className="flex items-center gap-2 bg-surface-2 rounded-lg p-3 text-sm text-text-muted">
              <MessageCircle className="w-4 h-4 shrink-0 text-accent" />
              <span>Vuelve a Telegram y escribe tu primera tarea.</span>
            </div>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
          >
            <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-danger" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Algo salió mal</h2>
            <p className="text-text-muted text-sm mb-6">{errorMsg}</p>
            <a
              href="https://t.me/tutareabot"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Volver al bot
            </a>
          </motion.div>
        )}

        {state === "needs-login" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
          >
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-accent" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Vincula tu Telegram</h2>
            <p className="text-text-muted text-sm mb-6">
              Inicia sesión en tutarea para conectar tu cuenta de Telegram y crear tareas directo desde el chat.
            </p>
            <button
              onClick={handleLogin}
              className="w-full py-2.5 bg-accent text-accent-fg rounded-lg font-medium text-sm hover:bg-accent/90 transition-colors"
            >
              Iniciar sesión
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
