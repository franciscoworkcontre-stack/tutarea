"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Zap,
  MessageCircle,
  LayoutGrid,
  CheckCircle2,
} from "lucide-react";
import { spring, easeOut } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-accent-fg text-xs font-bold">T</span>
            </div>
            <span className="font-semibold tracking-tighter">tutarea</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 bg-accent text-accent-fg rounded-lg hover:bg-accent/90 transition-colors font-medium"
            >
              Comenzar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface text-xs text-text-muted mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
              Ahora con bot de Telegram en Español
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tightest text-text mb-6 leading-[1.05]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}
          >
            Gestión de proyectos
            <br />
            <span className="font-serif font-normal italic text-text-muted">
              que realmente usarás.
            </span>
          </motion.h1>

          <motion.p
            className="text-lg text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: easeOut }}
          >
            La velocidad y el diseño de Linear, la flexibilidad de Monday, y la
            posibilidad de capturar tareas con un audio de Telegram. Para equipos
            LATAM que merecen mejores herramientas.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: easeOut }}
          >
            <Link
              href="/signup"
              className="group flex items-center gap-2 px-6 py-3 bg-accent text-accent-fg rounded-xl font-medium hover:bg-accent/90 transition-all hover:shadow-2"
            >
              Crear workspace gratis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 border border-border text-text rounded-xl font-medium hover:bg-surface transition-colors"
            >
              Ver demo
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <h2 className="text-3xl font-semibold tracking-tighter mb-3">
              Todo lo que tu equipo necesita
            </h2>
            <p className="text-text-muted">
              Sin el bloat. Sin la complejidad innecesaria.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-xl border border-border bg-surface hover:border-border-strong transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: easeOut }}
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Telegram highlight */}
      <section className="py-24 px-6 bg-surface border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium mb-6">
              <MessageCircle className="w-3.5 h-3.5" />
              Diferenciador #1
            </div>
            <h2 className="text-3xl font-semibold tracking-tighter mb-4 leading-tight">
              Captura tareas con
              <br />
              <span className="font-serif font-normal italic text-text-muted">
                una nota de voz.
              </span>
            </h2>
            <p className="text-text-muted leading-relaxed mb-6">
              Envía un audio a tu bot de Telegram. La IA transcribe, entiende el
              contexto, extrae el responsable, la fecha y la prioridad, y crea la
              tarea automáticamente. En Español chileno y mexicano.
            </p>
            <ul className="space-y-3">
              {telegramFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-text-muted">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <div className="rounded-2xl border border-border bg-background p-4 shadow-3">
              <div className="space-y-3">
                <TelegramMessage
                  isBot={false}
                  text="🎙 [Audio 0:12] recordar a juan revisar el contrato para mañana urgente"
                />
                <TelegramMessage
                  isBot
                  text="✅ Tarea creada: **Revisar el contrato**"
                  subtext="📅 Mañana · 🔴 Urgente · 👤 Juan García · Proyecto: Legal"
                />
                <div className="flex gap-2 justify-end">
                  {["✏️ Editar", "📅 Fecha", "🗑 Descartar"].map((btn) => (
                    <button
                      key={btn}
                      className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-surface transition-colors"
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <h2 className="text-4xl font-semibold tracking-tighter mb-4">
              Empieza hoy, gratis.
            </h2>
            <p className="text-text-muted mb-8">
              Sin tarjeta de crédito. Sin trucos. Tu primer workspace listo en
              menos de 2 minutos.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-fg rounded-xl font-medium hover:bg-accent/90 transition-all text-base hover:shadow-2"
            >
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-text-subtle">
          <span>© 2025 tutarea. Hecho con ♥ en LATAM.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-text transition-colors">
              Privacidad
            </Link>
            <Link href="/terms" className="hover:text-text transition-colors">
              Términos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TelegramMessage({
  isBot,
  text,
  subtext,
}: {
  isBot: boolean;
  text: string;
  subtext?: string;
}) {
  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
          isBot
            ? "bg-surface-2 text-text"
            : "bg-accent text-accent-fg"
        }`}
      >
        <p>{text}</p>
        {subtext && (
          <p className="text-xs mt-1 opacity-70">{subtext}</p>
        )}
      </div>
    </div>
  );
}

const features = [
  {
    icon: Zap,
    title: "Velocidad de Linear",
    description:
      "Shortcuts de teclado para todo. Crea, asigna y mueve tareas sin tocar el mouse. El workflow más rápido del mercado.",
  },
  {
    icon: LayoutGrid,
    title: "Vistas flexibles",
    description:
      "Board, tabla, timeline, calendario y dashboard por proyecto. Cada equipo ve su trabajo como más le acomoda.",
  },
  {
    icon: MessageCircle,
    title: "Telegram nativo",
    description:
      "Vincula tu cuenta y envía audios o textos al bot. La IA convierte tus mensajes en tareas con todos los campos correctos.",
  },
];

const telegramFeatures = [
  "Transcripción de voz a texto con Whisper AI, optimizado para español",
  "Extracción automática de responsable, fecha, prioridad y proyecto",
  "Notificaciones de tareas asignadas, menciones y deadlines",
  "Comandos /today, /inbox y /tasks para gestionar desde el chat",
];
