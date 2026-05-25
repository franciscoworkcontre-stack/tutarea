"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  X,
  Save,
  ChevronRight,
  Type,
  AlignLeft,
  ChevronDown,
  CheckSquare,
  Calendar,
  Hash,
  AtSign,
  List,
} from "lucide-react";
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
  formId?: string;
  projectId: string;
  initialTitle?: string;
  initialDescription?: string;
  initialFields?: FormField[];
  onSaved?: (formId: string) => void;
  onCancel?: () => void;
};

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ElementType }[] = [
  { type: "short_text", label: "Texto corto", icon: Type },
  { type: "long_text", label: "Texto largo", icon: AlignLeft },
  { type: "email", label: "Email", icon: AtSign },
  { type: "number", label: "Número", icon: Hash },
  { type: "select", label: "Selección única", icon: ChevronDown },
  { type: "multi_select", label: "Selección múltiple", icon: List },
  { type: "date", label: "Fecha", icon: Calendar },
  { type: "checkbox", label: "Casilla", icon: CheckSquare },
];

function SortableField({
  field,
  isSelected,
  onSelect,
  onDelete,
}: {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const FieldIcon = FIELD_TYPES.find((f) => f.type === field.type)?.icon ?? Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
        isDragging ? "opacity-50" : "",
        isSelected
          ? "border-accent bg-accent/5"
          : "border-border bg-surface hover:border-border-strong"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <FieldIcon className="w-4 h-4 text-text-subtle flex-shrink-0" />
      <span className="flex-1 text-sm font-medium truncate">{field.label}</span>
      {field.required && (
        <span className="text-xs text-red-500 flex-shrink-0">*</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-subtle hover:text-red-500"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function FormBuilder({
  formId,
  projectId,
  initialTitle = "",
  initialDescription = "",
  initialFields = [],
  onSaved,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  const addField = useCallback((type: FieldType) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type,
      label: FIELD_TYPES.find((ft) => ft.type === type)?.label ?? "Campo",
      required: false,
      options: type === "select" || type === "multi_select" ? ["Opción 1"] : undefined,
      placeholder: "",
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  }, []);

  const updateField = useCallback((id: string, updates: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  const deleteField = useCallback(
    (id: string) => {
      setFields((prev) => prev.filter((f) => f.id !== id));
      if (selectedFieldId === id) setSelectedFieldId(null);
    },
    [selectedFieldId]
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((prev) => {
        const oldIndex = prev.findIndex((f) => f.id === active.id);
        const newIndex = prev.findIndex((f) => f.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("El título del formulario es obligatorio");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      let response: Response;
      if (formId) {
        response = await fetch(`/api/forms/${formId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, fieldsJsonb: fields }),
        });
      } else {
        response = await fetch(`/api/projects/${projectId}/forms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, fieldsJsonb: fields }),
        });
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Error al guardar");
      }

      const data = (await response.json()) as { form: { id: string } };
      onSaved?.(data.form.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: field types */}
      <div className="w-52 flex-shrink-0 border-r border-border bg-surface-2 p-3 overflow-y-auto">
        <p className="text-xs font-semibold text-text-subtle uppercase tracking-wider mb-2">
          Tipos de campo
        </p>
        <div className="space-y-1">
          {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => addField(type)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-text-muted hover:bg-surface hover:text-text transition-colors text-left"
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{label}</span>
              <Plus className="w-3 h-3 ml-auto opacity-40" />
            </button>
          ))}
        </div>
      </div>

      {/* Center panel: form preview */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del formulario"
                className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder:text-text-subtle text-text"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción (opcional)"
                rows={2}
                className="w-full text-sm bg-transparent border-none outline-none placeholder:text-text-subtle text-text-muted resize-none mt-1"
              />
            </div>

            {fields.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-xl p-10 text-center text-text-subtle">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Agrega campos desde el panel izquierdo</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <SortableField
                        key={field.id}
                        field={field}
                        isSelected={selectedFieldId === field.id}
                        onSelect={() => setSelectedFieldId(field.id)}
                        onDelete={() => deleteField(field.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex items-center justify-between gap-3">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 ml-auto">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Guardando…" : "Guardar formulario"}
            </button>
          </div>
        </div>
      </div>

      {/* Right panel: field config */}
      <div
        className={cn(
          "w-64 flex-shrink-0 border-l border-border bg-surface-2 overflow-y-auto transition-all",
          selectedField ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selectedField && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text">Configurar campo</p>
              <button
                onClick={() => setSelectedFieldId(null)}
                className="text-text-subtle hover:text-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-text-subtle mb-1">Etiqueta</label>
              <input
                type="text"
                value={selectedField.label}
                onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg outline-none focus:border-accent text-text"
              />
            </div>

            <div>
              <label className="block text-xs text-text-subtle mb-1">
                Texto de ayuda (placeholder)
              </label>
              <input
                type="text"
                value={selectedField.placeholder ?? ""}
                onChange={(e) =>
                  updateField(selectedField.id, { placeholder: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg outline-none focus:border-accent text-text"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-text">Obligatorio</label>
              <button
                onClick={() =>
                  updateField(selectedField.id, { required: !selectedField.required })
                }
                className={cn(
                  "w-10 h-5 rounded-full transition-colors relative",
                  selectedField.required ? "bg-accent" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                    selectedField.required ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>

            {(selectedField.type === "select" || selectedField.type === "multi_select") && (
              <div>
                <label className="block text-xs text-text-subtle mb-1">Opciones</label>
                <div className="space-y-1.5">
                  {(selectedField.options ?? []).map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...(selectedField.options ?? [])];
                          newOpts[idx] = e.target.value;
                          updateField(selectedField.id, { options: newOpts });
                        }}
                        className="flex-1 px-2 py-1.5 text-xs bg-surface border border-border rounded-lg outline-none focus:border-accent text-text"
                      />
                      <button
                        onClick={() => {
                          const newOpts = (selectedField.options ?? []).filter(
                            (_, i) => i !== idx
                          );
                          updateField(selectedField.id, { options: newOpts });
                        }}
                        className="text-text-subtle hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newOpts = [
                        ...(selectedField.options ?? []),
                        `Opción ${(selectedField.options?.length ?? 0) + 1}`,
                      ];
                      updateField(selectedField.id, { options: newOpts });
                    }}
                    className="flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    Agregar opción
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-xs text-text-subtle">
                <ChevronRight className="w-3 h-3" />
                <span>
                  Tipo:{" "}
                  <span className="font-medium">
                    {FIELD_TYPES.find((ft) => ft.type === selectedField.type)?.label}
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
