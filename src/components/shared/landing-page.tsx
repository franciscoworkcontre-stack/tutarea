"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { ArrowRight, Zap, Bot, Trophy, Star, Brain, Coffee, Rocket, Flame, Crown } from "lucide-react";
import { easeOut } from "@/lib/utils";

// ── Utils ──────────────────────────────────────────────────────────────────

function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return { count, ref };
}

// ── Components ──────────────────────────────────────────────────────────────

function Badge({ children, color = "purple" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${colors[color] ?? colors.purple}`}>
      {children}
    </span>
  );
}

function GlowBlob({ className }: { className: string }) {
  return (
    <div className={`absolute rounded-full blur-[120px] opacity-20 pointer-events-none ${className}`} />
  );
}

function StatCard({ value, suffix, label, emoji }: { value: number; suffix: string; label: string; emoji: string }) {
  const { count, ref } = useCounter(value);
  return (
    <motion.div
      className="text-center p-6 rounded-2xl border border-white/5 bg-white/[0.02]"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: easeOut }}
    >
      <div className="text-3xl mb-2">{emoji}</div>
      <div className="text-4xl font-bold text-white mb-1">
        <span ref={ref}>{count.toLocaleString()}</span>{suffix}
      </div>
      <p className="text-sm text-zinc-500">{label}</p>
    </motion.div>
  );
}

function TestimonialCard({ name, role, avatar, quote, emoji }: {
  name: string; role: string; avatar: string; quote: string; emoji: string;
}) {
  return (
    <motion.div
      className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: easeOut }}
    >
      <p className="text-sm text-zinc-300 leading-relaxed mb-4">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold text-white">
          {avatar}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{name} {emoji}</p>
          <p className="text-xs text-zinc-500">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}

function TelegramBubble({ isBot, text, delay = 0 }: { isBot: boolean; text: string; delay?: number }) {
  return (
    <motion.div
      className={`flex ${isBot ? "justify-start" : "justify-end"}`}
      initial={{ opacity: 0, x: isBot ? -10 : 10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay, ease: easeOut }}
    >
      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isBot
          ? "bg-zinc-800 text-zinc-100 rounded-tl-sm"
          : "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-tr-sm"
      }`}>
        {text}
      </div>
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden font-sans">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#080808]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-black">T</span>
            </div>
            <span className="font-bold tracking-tight text-white">tutarea</span>
            <span className="hidden sm:inline text-xs text-zinc-600 italic">· del mejor equipo del mundo probablemente</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Entrar
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              Unirse al equipo 🚀
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-28 px-6 overflow-hidden">
        <GlowBlob className="w-[600px] h-[600px] bg-purple-600 -top-32 -left-48" />
        <GlowBlob className="w-[400px] h-[400px] bg-blue-600 top-20 -right-32" />

        <div className="max-w-5xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-wrap justify-center gap-2 mb-8"
          >
            <Badge color="purple"><Crown className="w-3 h-3" /> El equipo más capo de LATAM™</Badge>
            <Badge color="green"><Brain className="w-3 h-3" /> Powered by IA (y cafeína)</Badge>
            <Badge color="yellow"><Star className="w-3 h-3" /> Auto-proclamado equipo del año</Badge>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              La huevada más
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              chida para el trabajo
            </span>
            <br />
            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              que tenemos nosotros.
            </span>
          </motion.h1>

          <motion.p
            className="text-lg text-zinc-400 max-w-2xl mx-auto mb-4 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Mientras otros equipos siguen mandando updates por WhatsApp y usando Excel
            como tablero de proyectos… <span className="text-white font-medium">nosotros le pusimos IA a todo, parce.</span>
          </motion.p>

          <motion.p
            className="text-sm text-zinc-600 max-w-xl mx-auto mb-10 italic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            ⚠️ Advertencia: usar esta herramienta puede causar una productividad extrema,
            comentarios de "qué bacán tu equipo" y una necesidad urgente de mandarte a vos mismo una tarea.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <Link
              href="/signup"
              className="group flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all hover:scale-[1.02] shadow-[0_0_30px_rgba(147,51,234,0.3)]"
            >
              Quiero entrar al equipo de los capos
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="px-7 py-3.5 border border-white/10 text-zinc-300 rounded-xl font-medium hover:bg-white/5 transition-colors"
            >
              Ya soy del equipo 🧑‍💻
            </Link>
          </motion.div>

          {/* Fake social proof */}
          <motion.div
            className="mt-12 flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex -space-x-2">
              {["L", "J", "A", "G"].map((initial, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-[#080808] bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white"
                >
                  {initial}
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              <span className="text-zinc-300 font-medium">Luz, Jose, Alex & Gael</span> ya están siendo más productivos que tú
            </p>
          </motion.div>
        </div>
      </section>

      {/* Awards */}
      <section className="py-16 px-6 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs text-zinc-600 uppercase tracking-widest mb-8">
            Premios y reconocimientos que nos auto-otorgamos con mucho orgullo
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-center">
            {awards.map((award, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-center gap-1.5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <span className="text-2xl">{award.emoji}</span>
                <p className="text-xs text-zinc-400 font-medium max-w-[120px] leading-tight">{award.name}</p>
                <p className="text-[10px] text-zinc-700">{award.org}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-black tracking-tighter mb-2">
              Los números no mienten
            </h2>
            <p className="text-zinc-500 text-sm">(o sí, pero igual se ven bien)</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value={99} suffix="%" label="de efectividad según nosotros mismos" emoji="📊" />
            <StatCard value={420} suffix="" label="tareas creadas por nota de voz desde el baño" emoji="🎙️" />
            <StatCard value={3} suffix="x" label="más productivos que el equipo de al lado" emoji="⚡" />
            <StatCard value={0} suffix="" label="reuniones que se pudieron haber sido un mensaje" emoji="🙏" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge color="blue" ><Rocket className="w-3 h-3" /> Features</Badge>
            <h2 className="text-4xl font-black tracking-tighter mt-4 mb-3">
              Todo lo que necesitas,
              <br />
              <span className="text-zinc-500 font-normal italic text-3xl">aunque ya sabemos que igual vas a usar Excel.</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="group p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: easeOut }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="font-bold text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-zinc-500 italic mb-3">{feature.subtitle}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Telegram demo */}
      <section className="py-24 px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <Badge color="green"><Bot className="w-3 h-3" /> Bot de Telegram</Badge>
            <h2 className="text-4xl font-black tracking-tighter mt-4 mb-4 leading-tight">
              Habla al bot
              <br />
              <span className="text-zinc-500 font-normal italic text-3xl">como si le hablaras al grupo del trabajo.</span>
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Manda un audio, un texto, lo que sea. El bot con IA entiende tu
              español chileno, mexicano o colombiano, y convierte tu
              <span className="text-white"> "weon recuerda decirle a Luz que revise lo del cliente"</span> en una
              tarea real con responsable, fecha y prioridad.
            </p>
            <div className="space-y-2">
              {botFeatures.map((f, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-2.5 text-sm"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <span className="text-base leading-none mt-0.5">{f.emoji}</span>
                  <span className="text-zinc-400">{f.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <div className="rounded-2xl border border-white/10 bg-[#111] p-4 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
              {/* Chat header */}
              <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-white/5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-sm">🤖</div>
                <div>
                  <p className="text-sm font-medium text-white">optimustask_bot</p>
                  <p className="text-xs text-zinc-500">en línea</p>
                </div>
              </div>
              <div className="space-y-2.5">
                <TelegramBubble isBot={false} text="🎙 [Audio 0:08] oe jose revisa el contrato del cliente nuevo pa mañana q es urgente" delay={0.1} />
                <TelegramBubble isBot text="👀 Escuché: &quot;Jose revisa el contrato del cliente nuevo para mañana que es urgente&quot;" delay={0.3} />
                <TelegramBubble isBot text={"✅ Tarea creada:\nRevisar contrato cliente nuevo\n🔴 Urgente · 📅 Mañana · 👤 Jose\n\n[Ver tarea →]"} delay={0.5} />
                <TelegramBubble isBot={false} text="/mis_tareas" delay={0.7} />
                <TelegramBubble isBot text={"📋 Tus tareas activas:\n\n1. 🔴 Revisar contrato cliente nuevo\n2. 🟡 Actualizar deck de ventas\n3. 🔵 Weekly del equipo"} delay={0.9} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge color="yellow"><Star className="w-3 h-3" /> Testimonios</Badge>
            <h2 className="text-3xl font-black tracking-tighter mt-4 mb-2">
              Lo que dice el equipo
            </h2>
            <p className="text-zinc-600 text-sm">(les pusimos un micrófono en el discord y anotamos todo)</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testimonials.map((t, i) => (
              <TestimonialCard key={i} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* "Por qué no deberías usarlo" */}
      <section className="py-20 px-6 border-t border-white/5 bg-red-950/10">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-black tracking-tighter mb-2">
              Por qué <span className="line-through text-zinc-600">no</span> deberías usar esto
            </h2>
            <p className="text-zinc-500 text-sm italic">honestidad radical, al estilo del equipo</p>
          </motion.div>

          <div className="space-y-3">
            {reasons.map((r, i) => (
              <motion.div
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02]"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
              >
                <span className="text-xl flex-shrink-0">{r.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-white line-through text-zinc-600">{r.bad}</p>
                  <p className="text-sm text-zinc-400 mt-0.5">{r.real}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6 border-t border-white/5 relative overflow-hidden">
        <GlowBlob className="w-[500px] h-[500px] bg-purple-700 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="max-w-2xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-5xl mb-6">🏆</div>
            <h2 className="text-5xl font-black tracking-tighter mb-4 leading-tight">
              ¿Vas a ser del equipo
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                o te quedas con Excel?
              </span>
            </h2>
            <p className="text-zinc-400 mb-3 text-lg">
              Gratis. Sin tarjeta. Sin trucos raros. Solo tú, tu equipo y la IA trabajando.
            </p>
            <p className="text-zinc-600 text-sm italic mb-10">
              (y si no te gusta, le dices al bot que borre todo y nadie se entera)
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(147,51,234,0.4)]"
            >
              Entrar al equipo de los capos
              <Flame className="w-5 h-5" />
            </Link>
            <p className="text-xs text-zinc-700 mt-4">
              Ya somos 4. Pronto seremos 5. El equipo crece. 🚀
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-black">T</span>
            </div>
            <span>© 2025 tutarea · Hecho con 💜 y mucho Claude AI en algún lugar de LATAM</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacidad</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Términos</Link>
            <Link href="/login" className="hover:text-zinc-400 transition-colors">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────

const awards = [
  { emoji: "🥇", name: "Mejor uso de IA para no hacer nada manual", org: "Premio LATAM Tech 2025" },
  { emoji: "🏆", name: "Equipo que más tareas crea desde el baño", org: "Telegram Bot Society" },
  { emoji: "⚡", name: "Los que más rápido responden los pings", org: "Discord Productivity Guild" },
  { emoji: "🧠", name: "Mayor densidad de capos por metro cuadrado", org: "Estudio inventado 2025" },
  { emoji: "🎙️", name: "Nota de voz más larga convertida en tarea", org: "Whisper AI Records" },
  { emoji: "☕", name: "Productividad proporcional al café consumido", org: "Asociación Cafetera LATAM" },
];

const features = [
  {
    icon: Zap,
    title: "Rápido como Linear",
    subtitle: "pero en español, weon",
    description: "Shortcuts para todo. Crea, mueve y asigna tareas sin soltar el teclado. Construido para los que le tienen alergia al mouse.",
  },
  {
    icon: Trophy,
    title: "Todo en un solo lugar",
    subtitle: "pa que no digas que no sabías",
    description: "Board, tabla, sprints, OKRs, dashboards, formularios y más. Sin abrir 7 tabs distintas. El todo en uno que Monday.com quería ser.",
  },
  {
    icon: Bot,
    title: "Bot de Telegram con IA",
    subtitle: "el mejor compañero de trabajo",
    description: "Habla en chileno, mexicano o colombiano. El bot te entiende, crea la tarea y te avisa cuando alguien más la toca. Magia, básicamente.",
  },
  {
    icon: Brain,
    title: "IA en todos lados",
    subtitle: "neta que sí, no es marketing",
    description: "Transcripción de voz, parseo de intención, sugerencias de asignación. Claude AI metido en cada rincón de la app para que tú pienses menos.",
  },
  {
    icon: Coffee,
    title: "Automaciones sin código",
    subtitle: "puro drag and drop, parce",
    description: "Cuando alguien cierra una tarea urgente, notifica al canal. Cuando vence un sprint, crea el siguiente. Tú defines las reglas, la IA las ejecuta.",
  },
  {
    icon: Rocket,
    title: "Sprints, OKRs y más",
    subtitle: "como empresa grande pero de los nuestros",
    description: "Todo lo de Monday y ClickUp que pagamos y nunca usamos, pero construido para equipos pequeños que se mueven rápido y no necesitan un manual.",
  },
];

const botFeatures = [
  { emoji: "🎙️", text: "/tarea Revisar propuesta del cliente → tarea creada al tiro" },
  { emoji: "🔴", text: "/urgente Fix el bug del checkout → prioridad máxima, asignado" },
  { emoji: "📋", text: "/mis_tareas → tu lista completa sin abrir la app" },
  { emoji: "🎧", text: "Nota de voz → Whisper transcribe → Claude entiende → tarea creada" },
  { emoji: "📁", text: "Si tienes varios proyectos, te pregunta dónde va. No adivina." },
];

const testimonials = [
  {
    name: "Luz",
    role: "La más organizada del equipo (por defecto)",
    avatar: "L",
    emoji: "✨",
    quote: "Antes mandaba el update por WhatsApp y nadie leía. Ahora mando una nota de voz al bot y la tarea aparece sola con mi nombre. El equipo ya no tiene excusas.",
  },
  {
    name: "Jose",
    role: "El que siempre tiene 47 tabs abiertas",
    avatar: "J",
    emoji: "🤯",
    quote: "Neta que pensé que era una de esas tools que usamos dos días y olvidamos. Pero el bot de Telegram es muy chido, ahora creo tareas desde el uber. Game changer.",
  },
  {
    name: "Alex",
    role: "El que pregunta '¿pa qué día era eso?'",
    avatar: "A",
    emoji: "📅",
    quote: "Antes se me olvidaban las cosas porque el grupo de WhatsApp era un caos. Ahora el bot me manda /vencidas y me da vergüenza. Me ha ayudado más el miedo que la organización.",
  },
  {
    name: "Gael",
    role: "El que 'ya casi termina' hace 3 días",
    avatar: "G",
    emoji: "🚧",
    quote: "Parce, esto es lo más bacán que hemos armado. Le digo al bot 'terminar el módulo de pagos urgente' y aparece en el board con mi nombre. Ya no me puedo hacer el loco.",
  },
];

const reasons = [
  {
    emoji: "😅",
    bad: "Es muy complicado de usar",
    real: "Si sabes usar WhatsApp, sabes usar esto. Y si no, le preguntas al bot.",
  },
  {
    emoji: "💸",
    bad: "Cuesta muy caro",
    real: "Cero pesos. $0 CLP, $0 MXN, $0 COP. Gratis. Completamente gratis. ¿Entendiste?",
  },
  {
    emoji: "🤖",
    bad: "La IA va a reemplazar nuestros trabajos",
    real: "La IA va a reemplazar el tiempo que pasabas buscando quién tenía la última versión del Excel.",
  },
  {
    emoji: "📱",
    bad: "No funciona en el teléfono",
    real: "Funciona en tu teléfono, en tu compu, en el Telegram del teléfono de tu jefe, y probablemente en tu Smart TV.",
  },
];
