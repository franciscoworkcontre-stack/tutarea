"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { spring } from "@/lib/utils";
import { X, Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
  color: z.string().default("#f57522"),
});

type FormValues = z.infer<typeof schema>;

const COLORS = [
  "#f57522", "#3b82f6", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444",
];

type Props = {
  workspaceId: string;
  workspaceSlug: string;
  onClose: () => void;
};

export default function NewProjectDialog({ workspaceId, workspaceSlug, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { color: "#f57522" },
  });

  const color = watch("color");

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, workspaceId }),
      });
      if (!res.ok) throw new Error("Error al crear proyecto");
      const body = (await res.json()) as { project: { id: string } };
      toast.success(`Proyecto "${data.name}" creado`);
      router.push(`/app/${workspaceSlug}/projects/${body.project.id}/board`);
      router.refresh();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
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
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={spring}
      >
        <div className="bg-surface border border-border rounded-2xl shadow-3 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Nuevo proyecto</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-subtle hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Nombre del proyecto
              </label>
              <input
                {...register("name")}
                placeholder="Marketing Q1"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-danger mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Descripción (opcional)
              </label>
              <textarea
                {...register("description")}
                placeholder="¿En qué trabaja este proyecto?"
                rows={2}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue("color", c)}
                    className={`w-7 h-7 rounded-lg transition-all ${
                      color === c
                        ? "ring-2 ring-offset-2 ring-offset-surface ring-text scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
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
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                whileTap={{ scale: 0.97 }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Crear proyecto"
                )}
              </motion.button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}
