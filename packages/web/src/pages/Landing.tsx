// Public landing page. Front door for the pilot: presents the project,
// credits the funder (GORE Fondo Comunidad Activa 2025), and surfaces the
// four platform entries. No auth required. Destination pages keep their own
// guards — anonymous demo sessions continue via /martina.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { logout } from "../lib/auth.js";
import { AppIcon } from "../components/AppIcon.js";

// TODO(edmundo): confirm official wording and logo usage rules with Fundación
// Summer + GORE before the pilot goes public.
const FUNDER_CREDIT = {
  fundedByLine:
    "Este proyecto es financiado por el Fondo Comunidad Activa 2025 del Gobierno Regional Metropolitano de Santiago.",
  projectCode: "IL-00363-25",
  projectName: "Taller OASIS con Piloto de Entrenamiento Chatbot",
} as const;

// Drop SVG/PNG files into packages/web/public/brand/ and set `src` here to
// replace the name-plate placeholders.
interface BrandAsset {
  key: string;
  name: string;
  src: string | null;
}
const BRAND_ASSETS: readonly BrandAsset[] = [
  { key: "gore", name: "GORE · Comunidad Activa", src: null },
  { key: "summer", name: "Fundación Summer", src: null },
  { key: "oasis", name: "Metodología OASIS", src: null },
] as const;

interface OasisStep {
  letter: string;
  title: string;
  description: string;
  accent: string;
}
const OASIS_STEPS: readonly OasisStep[] = [
  {
    letter: "O",
    title: "Observa",
    description: "Fíjate en las señales antes de reaccionar.",
    accent: "bg-summer-blue/15 text-summer-blue",
  },
  {
    letter: "A",
    title: "Acoge",
    description: "Valida lo que la persona está sintiendo, sin juzgar.",
    accent: "bg-summer-teal/20 text-summer-teal",
  },
  {
    letter: "S",
    title: "Silencio",
    description: "Sostén pausas activas para que la otra persona hable.",
    accent: "bg-summer-yellow/40 text-stone-700",
  },
  {
    letter: "I",
    title: "Ilumina",
    description: "Ayuda a nombrar lo que ocurre y a explorar salidas.",
    accent: "bg-summer-pink/30 text-summer-pink",
  },
  {
    letter: "S",
    title: "Sostén",
    description: "Conecta con red de apoyo y acuerda un siguiente paso.",
    accent: "bg-summer-peach/40 text-stone-700",
  },
] as const;

interface AccessCard {
  href: string;
  title: string;
  description: string;
  cta: string;
  variant: "primary" | "teal" | "peach" | "yellow";
  team: boolean;
  imageSrc?: string;
  imageAlt?: string;
  emoji?: string;
}
const ACCESS_CARDS: readonly AccessCard[] = [
  {
    href: "/martina",
    title: "Sesión con Martina",
    description: "Practica una contención real en un entorno simulado y seguro.",
    cta: "Comenzar",
    variant: "primary",
    team: false,
    imageSrc: "/avatar-martina-v3.png",
    imageAlt: "Martina, personaje de simulación",
  },
  {
    href: "/mentor",
    title: "Mentor",
    description: "Consulta conceptos y resuelve dudas sobre la metodología OASIS.",
    cta: "Ir a Mentor",
    variant: "teal",
    team: false,
    imageSrc: "/avatar-mentor.jpg",
    imageAlt: "Mentor Summer ChatBot",
  },
  {
    href: "/lab",
    title: "Lab · Prompt Puro",
    description: "Entorno de calibración para el equipo: interactúa con el motor sin escenario.",
    cta: "Abrir Lab",
    variant: "peach",
    team: true,
    emoji: "🧪",
  },
  {
    href: "/admin/analytics",
    title: "Analítica",
    description:
      "Indicadores agregados del piloto: permanencia, barreras de seguridad, matriz emocional y logros.",
    cta: "Ver analítica",
    variant: "yellow",
    team: true,
    emoji: "📊",
  },
] as const;

const VARIANT_TO_BUTTON: Record<AccessCard["variant"], string> = {
  primary: "bg-summer-blue hover:bg-blue-400 text-white",
  teal: "bg-summer-teal hover:bg-teal-400 text-white",
  peach: "bg-summer-peach hover:bg-orange-300 text-stone-800",
  yellow: "bg-summer-yellow hover:bg-yellow-300 text-stone-800",
};

const VARIANT_TO_ACCENT: Record<AccessCard["variant"], string> = {
  primary: "bg-summer-blue/10",
  teal: "bg-summer-teal/15",
  peach: "bg-summer-peach/25",
  yellow: "bg-summer-yellow/40",
};

function LandingHeader({ userEmail, onLogout, loggingOut }: {
  userEmail: string | null;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="px-6 py-4 flex items-center justify-between border-b border-summer-blue/20 bg-white shadow-sm relative z-10">
      <Link
        to="/"
        className="flex items-center gap-3 rounded-2xl -mx-1 px-1 py-1 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-summer-blue/50 transition-opacity"
        aria-label="Ir a la portada de Summer ChatBot"
      >
        <AppIcon size="sm" />
        <div className="hidden sm:block">
          <span className="font-title uppercase tracking-wide text-summer-blue text-sm block">Summer ChatBot</span>
          <span className="font-secondary text-xs text-stone-500 font-semibold">Conviértete en un OASIS.</span>
        </div>
        <div className="sm:hidden">
          <span className="font-title uppercase tracking-wide text-summer-blue text-sm">Summer ChatBot</span>
        </div>
      </Link>

      {userEmail === null ? (
        <Link
          to="/login"
          className="text-sm font-secondary font-semibold text-stone-600 hover:text-summer-blue transition-colors"
        >
          Iniciar sesión
        </Link>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="text-sm font-secondary font-semibold text-stone-500 hover:text-summer-blue truncate max-w-[180px] flex items-center gap-1 transition-colors"
          >
            <span className="truncate">{userEmail}</span>
            <span className="text-stone-300">▾</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-md py-1 min-w-[160px] z-10">
              <Link
                to="/inicio"
                className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                onClick={() => setMenuOpen(false)}
              >
                Ir a mi inicio
              </Link>
              <button
                type="button"
                onClick={onLogout}
                disabled={loggingOut}
                className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {loggingOut ? "Cerrando..." : "Cerrar sesión"}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function HeroSection() {
  return (
    <section className="px-6 py-10 sm:py-16 max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">
        <div className="space-y-5 order-2 md:order-1">
          <p className="font-secondary text-xs sm:text-sm text-summer-blue font-bold uppercase tracking-widest">
            Fundación Summer · Metodología OASIS
          </p>
          <h1 className="font-title uppercase tracking-wide text-stone-800 text-4xl sm:text-5xl md:text-6xl leading-[1.05]">
            Entrena la conversación que puede salvar una vida
          </h1>
          <p className="font-secondary text-base sm:text-lg text-stone-700 leading-relaxed">
            Summer ChatBot es un espacio seguro de práctica en primeros auxilios
            emocionales. Conversa con Martina, una estudiante de 16 años creada
            para simular una situación real, y recibe retroalimentación basada
            en la metodología OASIS.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/martina"
              className="inline-flex items-center justify-center gap-2 bg-summer-blue hover:bg-blue-400 text-white rounded-full px-8 py-4 font-secondary text-sm font-bold tracking-wide shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              Entrenar con Martina
              <span aria-hidden="true">→</span>
            </Link>
            <a
              href="#que-es-oasis"
              className="inline-flex items-center justify-center gap-2 bg-white border border-stone-200 hover:border-summer-blue/50 text-stone-700 rounded-full px-8 py-4 font-secondary text-sm font-bold tracking-wide shadow-sm hover:shadow-md transition-all"
            >
              Conocer el proyecto
            </a>
          </div>
        </div>

        <div className="order-1 md:order-2 flex justify-center md:justify-end">
          <div className="relative w-full max-w-sm">
            <div className="absolute -inset-4 bg-summer-pink/25 rounded-[3rem] rotate-3" aria-hidden="true" />
            <div className="absolute -inset-2 bg-summer-peach/30 rounded-[3rem] -rotate-2" aria-hidden="true" />
            <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden bg-summer-pink/20 border border-white shadow-md">
              <img
                src="/avatar-martina-v3.png"
                alt="Martina, personaje de simulación del Modo Coach"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OasisSection() {
  return (
    <section id="que-es-oasis" className="px-6 py-14 sm:py-20 bg-white/60">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="font-secondary text-xs sm:text-sm text-summer-teal font-bold uppercase tracking-widest">
            Qué es OASIS
          </p>
          <h2 className="font-title uppercase tracking-wide text-stone-800 text-3xl sm:text-4xl leading-tight">
            Cinco pasos para acompañar a alguien en crisis
          </h2>
          <p className="font-secondary text-base text-stone-700 leading-relaxed">
            OASIS es la metodología de Fundación Summer para acompañar a una
            persona en crisis emocional. Cinco pasos simples que cualquier
            persona puede aprender.
          </p>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {OASIS_STEPS.map((step, idx) => (
            <li
              key={`${step.letter}-${idx}`}
              className="bg-white border border-stone-100 rounded-3xl p-5 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-title uppercase text-2xl mb-3 ${step.accent}`}
                aria-hidden="true"
              >
                {step.letter}
              </div>
              <p className="font-title uppercase tracking-wide text-stone-800 text-lg">{step.title}</p>
              <p className="font-secondary text-sm text-stone-600 mt-1 leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      n: "1",
      title: "Elige un espacio",
      body: "Comienza con Martina para practicar una contención, o conversa con el Mentor si quieres repasar conceptos.",
    },
    {
      n: "2",
      title: "Conversa",
      body: "Escribe con calma. Es una simulación con barreras de seguridad: si el sistema detecta una crisis real, pausa la sesión y ofrece recursos de ayuda.",
    },
    {
      n: "3",
      title: "Aprende de tu práctica",
      body: "Al cerrar la sesión recibes un reporte con las competencias que demostraste y las oportunidades para seguir mejorando.",
    },
  ] as const;

  return (
    <section className="px-6 py-14 sm:py-20">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="font-secondary text-xs sm:text-sm text-summer-peach font-bold uppercase tracking-widest">
            Cómo funciona
          </p>
          <h2 className="font-title uppercase tracking-wide text-stone-800 text-3xl sm:text-4xl leading-tight">
            Tres pasos para tu primera práctica
          </h2>
          <p className="font-secondary text-sm text-stone-600 leading-relaxed">
            Durante el piloto, las sesiones son anónimas y no se comparten datos
            personales.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <li
              key={s.n}
              className="bg-white border border-stone-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-summer-blue text-white font-title text-lg flex items-center justify-center shadow-sm" aria-hidden="true">
                {s.n}
              </div>
              <p className="font-title uppercase tracking-wide text-stone-800 text-xl mt-4">{s.title}</p>
              <p className="font-secondary text-sm text-stone-600 mt-2 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AccessCardsSection() {
  const [primary, ...rest] = ACCESS_CARDS;
  return (
    <section id="accesos" className="px-6 py-14 sm:py-20 bg-white/60">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="font-secondary text-xs sm:text-sm text-summer-blue font-bold uppercase tracking-widest">
            Accesos
          </p>
          <h2 className="font-title uppercase tracking-wide text-stone-800 text-3xl sm:text-4xl leading-tight">
            Qué puedes hacer aquí
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {primary !== undefined && <AccessCardItem card={primary} dominant />}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {rest.map((c) => (
              <AccessCardItem key={c.href} card={c} dominant={false} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AccessCardItem({ card, dominant }: { card: AccessCard; dominant: boolean }) {
  const accent = VARIANT_TO_ACCENT[card.variant];
  const button = VARIANT_TO_BUTTON[card.variant];
  return (
    <Link
      to={card.href}
      className={`group flex ${dominant ? "flex-col md:flex-row" : "flex-col"} gap-5 md:gap-6 bg-white border border-stone-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all`}
    >
      <div
        className={`${accent} ${dominant ? "w-full md:w-48 md:h-48 aspect-square md:aspect-auto" : "w-20 h-20"} rounded-3xl overflow-hidden flex-shrink-0 flex items-center justify-center`}
        aria-hidden="true"
      >
        {card.imageSrc !== undefined ? (
          <img
            src={card.imageSrc}
            alt={card.imageAlt ?? ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <span className="text-4xl">{card.emoji}</span>
        )}
      </div>
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className={`font-title uppercase tracking-wide text-stone-800 ${dominant ? "text-2xl sm:text-3xl" : "text-xl"}`}>
            {card.title}
          </h3>
          {card.team && (
            <span className="inline-block text-[10px] font-secondary font-bold uppercase tracking-widest bg-stone-100 text-stone-600 rounded-full px-2.5 py-0.5">
              Equipo
            </span>
          )}
        </div>
        <p className="font-secondary text-sm text-stone-700 leading-relaxed">{card.description}</p>
        <span
          className={`self-start inline-flex items-center gap-2 mt-auto rounded-full ${button} px-6 py-3 font-secondary text-sm font-bold tracking-wide shadow-sm group-hover:shadow-md transition-all`}
        >
          {card.cta}
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

function FunderCreditSection() {
  return (
    <section className="px-6 py-14 sm:py-20 bg-summer-blue/10 border-y border-summer-blue/20">
      <div className="max-w-5xl mx-auto w-full space-y-8 text-center">
        <div className="space-y-3">
          <p className="font-secondary text-xs sm:text-sm text-summer-blue font-bold uppercase tracking-widest">
            Financiamiento
          </p>
          <p className="font-secondary text-base sm:text-lg text-stone-800 leading-relaxed max-w-3xl mx-auto">
            {FUNDER_CREDIT.fundedByLine}
          </p>
          <p className="font-secondary text-sm text-stone-600">
            {FUNDER_CREDIT.projectName} · <span className="font-mono">{FUNDER_CREDIT.projectCode}</span>
          </p>
        </div>

        <ul className="flex flex-wrap justify-center gap-4">
          {BRAND_ASSETS.map((asset) => (
            <li key={asset.key}>
              {asset.src !== null ? (
                <img
                  src={asset.src}
                  alt={asset.name}
                  className="h-16 w-auto max-w-[220px] object-contain rounded-2xl bg-white p-3 border border-stone-100 shadow-sm"
                />
              ) : (
                <div
                  className="h-16 min-w-[180px] px-6 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center font-secondary text-xs sm:text-sm font-bold uppercase tracking-widest text-stone-500"
                  aria-label={`Placeholder de logo: ${asset.name}`}
                >
                  {asset.name}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="px-6 py-10 bg-white border-t border-stone-100">
      <div className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm font-secondary text-stone-600">
        <div className="space-y-1">
          <p className="font-bold text-stone-800">Fundación Summer · #yoelijosalvar</p>
          <p className="text-xs text-stone-500">© {year} · Piloto financiado por GORE Comunidad Activa 2025.</p>
        </div>
        <div className="flex flex-col sm:items-end gap-1">
          <Link to="/login" className="text-summer-blue hover:text-blue-400 font-semibold transition-colors">
            Iniciar sesión
          </Link>
          <p className="text-xs text-stone-500">
            Recursos de ayuda: <span className="font-bold">*4141 (Salud Responde, Chile)</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    document.title = "Summer ChatBot · Martina — Entrenamiento en primeros auxilios emocionales";
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const userEmail = loading ? null : (user?.email ?? user?.displayName ?? null);

  return (
    <main className="min-h-screen flex flex-col bg-warm-bg">
      <LandingHeader
        userEmail={userEmail}
        onLogout={() => void handleLogout()}
        loggingOut={loggingOut}
      />
      <HeroSection />
      <OasisSection />
      <HowItWorksSection />
      <AccessCardsSection />
      <FunderCreditSection />
      <LandingFooter />
    </main>
  );
}
