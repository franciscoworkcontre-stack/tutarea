import { notFound } from "next/navigation";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { eq } from "drizzle-orm";
import FormRenderer from "@/components/forms/form-renderer";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const form = await db.query.forms.findFirst({
    where: eq(forms.slug, slug),
  });

  if (!form) return { title: "Formulario no encontrado" };

  return {
    title: form.title,
    description: form.description ?? undefined,
  };
}

export default async function PublicFormPage({ params }: Props) {
  const { slug } = await params;

  const form = await db.query.forms.findFirst({
    where: eq(forms.slug, slug),
  });

  if (!form) notFound();

  if (!form.isPublic || !form.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-text mb-2">
            {!form.isActive ? "Formulario cerrado" : "Formulario privado"}
          </h1>
          <p className="text-text-muted">
            {!form.isActive
              ? "Este formulario ya no acepta respuestas."
              : "Este formulario no es accesible públicamente."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <FormRenderer
      formId={form.id}
      title={form.title}
      description={form.description}
      fields={
        (form.fieldsJsonb as Array<{
          id: string;
          type: "short_text" | "long_text" | "select" | "multi_select" | "date" | "number" | "checkbox" | "email";
          label: string;
          required: boolean;
          options?: string[];
          placeholder?: string;
        }>) ?? []
      }
    />
  );
}
