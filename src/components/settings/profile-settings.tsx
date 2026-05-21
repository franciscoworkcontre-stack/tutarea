"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { profiles } from "@/db/schema";

type Profile = InferSelectModel<typeof profiles>;

const schema = z.object({
  fullName: z.string().min(2),
  timezone: z.string(),
  locale: z.string(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  profile: Profile | null;
  userEmail: string;
  workspaceSlug: string;
};

export default function ProfileSettings({ profile, userEmail }: Props) {
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: profile?.fullName ?? "",
      timezone: profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: profile?.locale ?? "es-CL",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Perfil actualizado");
    } catch {
      toast.error("Error al guardar perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tighter mb-1">Mi perfil</h1>
        <p className="text-text-muted text-sm mb-8">
          Cómo te ve el equipo en tutarea.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="p-6 rounded-xl border border-border bg-surface space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Nombre completo
              </label>
              <input
                {...register("fullName")}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              {errors.fullName && (
                <p className="text-xs text-danger mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                value={userEmail}
                disabled
                className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-lg text-sm text-text-muted cursor-not-allowed"
              />
              <p className="text-xs text-text-subtle mt-1">
                El email no se puede cambiar desde aquí.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Zona horaria</label>
              <input
                {...register("timezone")}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Idioma</label>
              <select
                {...register("locale")}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="es-CL">Español (Chile)</option>
                <option value="es-MX">Español (México)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading || !isDirty}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent text-accent-fg rounded-xl font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar cambios
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
