import { Metadata } from "next";
import SignupForm from "@/components/auth/signup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-accent-fg text-sm font-bold">T</span>
              </div>
              <span className="font-semibold tracking-tighter text-lg">tutarea</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tighter mb-1">
              Crea tu cuenta
            </h1>
            <p className="text-text-muted text-sm">
              Gratis para siempre en el plan básico.
            </p>
          </div>
          <SignupForm />
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-surface border-l border-border items-center justify-center p-12">
        <div className="max-w-sm">
          <p className="font-serif text-2xl text-text-muted italic leading-relaxed mb-6">
            &ldquo;Captura la primera tarea con C, o envíale un audio a tu bot.&rdquo;
          </p>
          <p className="text-sm text-text-subtle">tutarea — gestión de proyectos para equipos ágiles</p>
        </div>
      </div>
    </div>
  );
}
