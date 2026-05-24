"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { generateSlug } from "@/lib/utils";
import { spring, easeOut } from "@/lib/utils";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, MessageCircle } from "lucide-react";

type Props = { user: User };

const profileSchema = z.object({
  fullName: z.string().min(2, "Nombre requerido"),
  timezone: z.string(),
  locale: z.string(),
});

const workspaceSchema = z.object({
  workspaceName: z.string().min(2, "Mínimo 2 caracteres"),
  workspaceSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
});

type ProfileValues = z.infer<typeof profileSchema>;
type WorkspaceValues = z.infer<typeof workspaceSchema>;

const steps = [
  { id: "profile", title: "Tu perfil", subtitle: "¿Cómo te llamamos?" },
  { id: "workspace", title: "Tu workspace", subtitle: "¿Dónde trabajas?" },
  { id: "telegram", title: "Telegram", subtitle: "El canal diferenciador." },
];

export default function OnboardingWizard({ user }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState(1);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName:
        (user.user_metadata?.["full_name"] as string | undefined) ?? "",
      timezone: "UTC",
      locale: "es-CL",
    },
  });

  useEffect(() => {
    profileForm.setValue("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workspaceForm = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
  });

  const watchWorkspaceName = workspaceForm.watch("workspaceName");

  const handleProfileNext = async (data: ProfileValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar perfil");
      setDirection(1);
      setStep(1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceNext = async (data: WorkspaceValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Error al crear workspace");
      }
      const body = (await res.json()) as { slug: string };
      setDirection(1);
      setStep(2);
      // Store slug for final redirect
      sessionStorage.setItem("onboarding_workspace_slug", body.slug);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    const slug = sessionStorage.getItem("onboarding_workspace_slug") ?? "";
    window.location.href = slug ? `/app/${slug}` : "/app";
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? -40 : 40,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-accent-fg text-sm font-bold">T</span>
          </div>
          <span className="font-semibold tracking-tighter text-lg">tutarea</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <motion.div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  i < step
                    ? "bg-success text-white"
                    : i === step
                    ? "bg-accent text-accent-fg"
                    : "bg-surface-2 text-text-subtle border border-border"
                }`}
                animate={{ scale: i === step ? 1.1 : 1 }}
                transition={spring}
              >
                {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </motion.div>
              {i < steps.length - 1 && (
                <div
                  className={`h-px w-8 transition-colors ${
                    i < step ? "bg-success" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: easeOut }}
          >
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tighter mb-1">
                {steps[step]?.title}
              </h1>
              <p className="text-text-muted text-sm">{steps[step]?.subtitle}</p>
            </div>

            {step === 0 && (
              <form
                onSubmit={profileForm.handleSubmit(handleProfileNext)}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Tu nombre
                  </label>
                  <input
                    {...profileForm.register("fullName")}
                    placeholder="Francisco Contreras"
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Zona horaria
                  </label>
                  <input
                    {...profileForm.register("timezone")}
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent text-text-muted"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Idioma
                  </label>
                  <select
                    {...profileForm.register("locale")}
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="es-CL">Español (Chile)</option>
                    <option value="es-MX">Español (México)</option>
                    <option value="en-US">English (US)</option>
                  </select>
                </div>
                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-accent text-accent-fg rounded-lg font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.97 }}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Continuar <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>
            )}

            {step === 1 && (
              <form
                onSubmit={workspaceForm.handleSubmit(handleWorkspaceNext)}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Nombre del workspace
                  </label>
                  <input
                    {...workspaceForm.register("workspaceName", {
                      onChange: (e) => {
                        workspaceForm.setValue(
                          "workspaceSlug",
                          generateSlug(e.target.value as string)
                        );
                      },
                    })}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    URL del workspace
                  </label>
                  <div className="flex items-center gap-0">
                    <span className="px-3 py-2.5 bg-surface-2 border border-r-0 border-border rounded-l-lg text-sm text-text-muted">
                      tutarea.com/
                    </span>
                    <input
                      {...workspaceForm.register("workspaceSlug")}
                      placeholder="acme-corp"
                      className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    />
                  </div>
                  {workspaceForm.formState.errors.workspaceSlug && (
                    <p className="text-xs text-danger mt-1">
                      {workspaceForm.formState.errors.workspaceSlug.message}
                    </p>
                  )}
                  {watchWorkspaceName && (
                    <p className="text-xs text-text-subtle mt-1">
                      tutarea.com/{generateSlug(watchWorkspaceName)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(-1);
                      setStep(0);
                    }}
                    className="py-2.5 px-4 border border-border rounded-lg text-sm hover:bg-surface transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-accent text-accent-fg rounded-lg font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.97 }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Crear workspace <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="p-5 rounded-xl border border-border bg-surface">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Bot de Telegram</p>
                      <p className="text-xs text-text-muted">
                        Captura tareas con voz y texto
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-text-muted mb-4">
                    Configura el bot más tarde desde{" "}
                    <strong>Configuración → Telegram</strong>. Podrás enviar
                    audios en español y la IA los convierte en tareas
                    automáticamente.
                  </p>
                  <p className="text-xs text-text-subtle">
                    También puedes hacerlo ahora si ya tienes Telegram.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(-1);
                      setStep(1);
                    }}
                    className="py-2.5 px-4 border border-border rounded-lg text-sm hover:bg-surface transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <motion.button
                    type="button"
                    onClick={finish}
                    className="flex-1 py-2.5 bg-accent text-accent-fg rounded-lg font-medium text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.97 }}
                  >
                    Entrar al workspace <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
