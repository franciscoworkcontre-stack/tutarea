"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldType =
  | "short_text"
  | "long_text"
  | "select"
  | "multi_select"
  | "date"
  | "number"
  | "checkbox"
  | "email";

type FormField = {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
};

type Props = {
  formId: string;
  title: string;
  description?: string | null;
  fields: FormField[];
};

export default function FormRenderer({ formId, title, description, fields }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");

  const setValue = (id: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required) {
        const val = values[field.id];
        const isEmpty =
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          newErrors[field.id] = "Este campo es obligatorio";
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/forms/${formId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: values,
          submitterName: submitterName.trim() || undefined,
          submitterEmail: submitterEmail.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Error al enviar");
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al enviar el formulario");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-text mb-2">¡Enviado con éxito!</h2>
          <p className="text-text-muted">
            Tu respuesta ha sido recibida. Gracias por completar el formulario.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-8 mb-6">
          <h1 className="text-2xl font-bold text-text mb-2">{title}</h1>
          {description && (
            <p className="text-text-muted text-sm">{description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Submitter info */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-4">
            <p className="text-xs font-semibold text-text-subtle uppercase tracking-wider">
              Información del remitente (opcional)
            </p>
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Nombre
              </label>
              <input
                type="text"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-3 py-2.5 text-sm bg-surface-2 border border-border rounded-lg outline-none focus:border-accent text-text placeholder:text-text-subtle"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-3 py-2.5 text-sm bg-surface-2 border border-border rounded-lg outline-none focus:border-accent text-text placeholder:text-text-subtle"
              />
            </div>
          </div>

          {/* Form fields */}
          {fields.map((field) => (
            <div
              key={field.id}
              className="bg-surface rounded-2xl border border-border shadow-sm p-6"
            >
              <label className="block text-sm font-medium text-text mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FieldInput
                field={field}
                value={values[field.id]}
                onChange={(val) => setValue(field.id, val)}
              />
              {errors[field.id] && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{errors[field.id]}</span>
                </div>
              )}
            </div>
          ))}

          {submitError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Enviando…" : "Enviar respuesta"}
          </button>
        </form>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const inputClass =
    "w-full px-3 py-2.5 text-sm bg-surface-2 border border-border rounded-lg outline-none focus:border-accent text-text placeholder:text-text-subtle";

  switch (field.type) {
    case "short_text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
          className={inputClass}
        />
      );

    case "long_text":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
          rows={4}
          className={cn(inputClass, "resize-none")}
        />
      );

    case "email":
      return (
        <input
          type="email"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? "tu@email.com"}
          className={inputClass}
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder={field.placeholder ?? ""}
          className={inputClass}
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );

    case "select":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Selecciona una opción</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "multi_select":
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => {
            const selected = Array.isArray(value) ? (value as string[]) : [];
            const checked = selected.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selected, opt]);
                    } else {
                      onChange(selected.filter((v) => v !== opt));
                    }
                  }}
                  className="w-4 h-4 rounded border-border text-accent"
                />
                <span className="text-sm text-text">{opt}</span>
              </label>
            );
          })}
        </div>
      );

    case "checkbox":
      return (
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-border text-accent"
          />
          <span className="text-sm text-text">
            {field.placeholder ?? field.label}
          </span>
        </label>
      );

    default:
      return null;
  }
}
