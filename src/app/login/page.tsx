import { Metadata } from "next";
import LoginForm from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
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
              Bienvenido de vuelta
            </h1>
            <p className="text-text-muted text-sm">
              Inicia sesión en tu workspace.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-surface border-l border-border items-center justify-center p-12">
        <div className="max-w-sm text-center">
          <p className="font-serif text-3xl text-text-muted italic leading-relaxed">
            &ldquo;La herramienta que tu equipo realmente va a usar.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
