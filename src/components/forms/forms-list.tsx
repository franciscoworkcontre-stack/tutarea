"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus,
  Link2,
  Pencil,
  Eye,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ClipboardList,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InferSelectModel } from "drizzle-orm";
import type { forms } from "@/db/schema";
import FormBuilder from "./form-builder";
import SubmissionsView from "./submissions-view";

type Form = InferSelectModel<typeof forms>;

type View = "list" | "builder" | "submissions";

type Props = {
  projectId: string;
  initialForms: Form[];
  workspaceSlug: string;
};

export default function FormsList({ projectId, initialForms, workspaceSlug }: Props) {
  const [formsList, setFormsList] = useState<Form[]>(initialForms);
  const [view, setView] = useState<View>("list");
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [viewingSubmissionsFormId, setViewingSubmissionsFormId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const editingForm = formsList.find((f) => f.id === editingFormId) ?? null;
  const submissionsForm = formsList.find((f) => f.id === viewingSubmissionsFormId) ?? null;

  const handleCopyLink = useCallback(
    (form: Form) => {
      const url = `${window.location.origin}/f/${form.slug}`;
      void navigator.clipboard.writeText(url).then(() => {
        setCopiedId(form.id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    },
    []
  );

  const handleToggleActive = useCallback(async (form: Form) => {
    const response = await fetch(`/api/forms/${form.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !form.isActive }),
    });
    if (response.ok) {
      const data = (await response.json()) as { form: Form };
      setFormsList((prev) =>
        prev.map((f) => (f.id === form.id ? data.form : f))
      );
    }
  }, []);

  const handleDelete = useCallback(async (formId: string) => {
    if (!window.confirm("¿Eliminar este formulario? No se puede deshacer.")) return;
    const response = await fetch(`/api/forms/${formId}`, { method: "DELETE" });
    if (response.ok) {
      setFormsList((prev) => prev.filter((f) => f.id !== formId));
    }
  }, []);

  const handleSaved = useCallback(
    async (savedFormId: string) => {
      const response = await fetch(`/api/forms/${savedFormId}`);
      if (response.ok) {
        const data = (await response.json()) as { form: Form };
        setFormsList((prev) => {
          const exists = prev.some((f) => f.id === savedFormId);
          if (exists) return prev.map((f) => (f.id === savedFormId ? data.form : f));
          return [data.form, ...prev];
        });
      }
      setView("list");
      setEditingFormId(null);
    },
    []
  );

  if (view === "builder") {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <button
            onClick={() => {
              setView("list");
              setEditingFormId(null);
            }}
            className="text-sm text-text-subtle hover:text-text transition-colors"
          >
            ← Volver
          </button>
          <span className="text-text-subtle">/</span>
          <span className="text-sm font-medium text-text">
            {editingForm ? "Editar formulario" : "Nuevo formulario"}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <FormBuilder
            formId={editingFormId ?? undefined}
            projectId={projectId}
            initialTitle={editingForm?.title ?? ""}
            initialDescription={editingForm?.description ?? ""}
            initialFields={
              (editingForm?.fieldsJsonb as Array<{
                id: string;
                type: "short_text" | "long_text" | "select" | "multi_select" | "date" | "number" | "checkbox" | "email";
                label: string;
                required: boolean;
                options?: string[];
                placeholder?: string;
              }>) ?? []
            }
            onSaved={handleSaved}
            onCancel={() => {
              setView("list");
              setEditingFormId(null);
            }}
          />
        </div>
      </div>
    );
  }

  if (view === "submissions" && submissionsForm) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <button
            onClick={() => {
              setView("list");
              setViewingSubmissionsFormId(null);
            }}
            className="text-sm text-text-subtle hover:text-text transition-colors"
          >
            ← Volver
          </button>
          <span className="text-text-subtle">/</span>
          <span className="text-sm font-medium text-text">
            Respuestas: {submissionsForm.title}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <SubmissionsView
            formId={submissionsForm.id}
            formFields={
              (submissionsForm.fieldsJsonb as Array<{
                id: string;
                type: string;
                label: string;
                required: boolean;
              }>) ?? []
            }
            workspaceSlug={workspaceSlug}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-text-muted" />
          <h1 className="text-lg font-semibold text-text">Formularios</h1>
          <span className="text-sm text-text-subtle">({formsList.length})</span>
        </div>
        <button
          onClick={() => {
            setEditingFormId(null);
            setView("builder");
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo formulario
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {formsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <ClipboardList className="w-12 h-12 text-text-subtle mb-4 opacity-40" />
            <h3 className="text-lg font-semibold text-text mb-2">Sin formularios</h3>
            <p className="text-text-muted text-sm mb-6 max-w-xs">
              Crea un formulario público para recibir solicitudes, bugs o cualquier
              tipo de intake de tu equipo o usuarios.
            </p>
            <button
              onClick={() => setView("builder")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear primer formulario
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {formsList.map((form) => (
              <div
                key={form.id}
                className="bg-surface border border-border rounded-xl p-5 hover:border-border-strong transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-text truncate">{form.title}</h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                          form.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-surface-2 text-text-subtle"
                        )}
                      >
                        {form.isActive ? "Activo" : "Inactivo"}
                      </span>
                      {form.isPublic && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex-shrink-0">
                          Público
                        </span>
                      )}
                    </div>
                    {form.description && (
                      <p className="text-sm text-text-muted mb-2 line-clamp-1">
                        {form.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-text-subtle">
                      <span>{form.submissionCount} respuestas</span>
                      <span>
                        {format(new Date(form.createdAt), "d MMM yyyy", { locale: es })}
                      </span>
                      <span>/f/{form.slug}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleCopyLink(form)}
                      title="Copiar enlace"
                      className={cn(
                        "p-2 rounded-lg text-text-subtle transition-colors",
                        copiedId === form.id
                          ? "text-green-600 bg-green-50"
                          : "hover:bg-surface-2 hover:text-text"
                      )}
                    >
                      {copiedId === form.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingFormId(form.id);
                        setView("builder");
                      }}
                      title="Editar"
                      className="p-2 rounded-lg text-text-subtle hover:bg-surface-2 hover:text-text transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setViewingSubmissionsFormId(form.id);
                        setView("submissions");
                      }}
                      title="Ver respuestas"
                      className="p-2 rounded-lg text-text-subtle hover:bg-surface-2 hover:text-text transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void handleToggleActive(form)}
                      title={form.isActive ? "Desactivar" : "Activar"}
                      className="p-2 rounded-lg text-text-subtle hover:bg-surface-2 hover:text-text transition-colors"
                    >
                      {form.isActive ? (
                        <ToggleRight className="w-4 h-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => void handleDelete(form.id)}
                      title="Eliminar"
                      className="p-2 rounded-lg text-text-subtle hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
