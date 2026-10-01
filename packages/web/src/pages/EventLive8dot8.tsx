// /8dot8 — kiosk dashboard for the Fundación Summer booth at 8.8 Unreal.
// Public, no login. Reads ONLY the aggregate doc event_live/8dot8.
// Designed on a fixed 1920x1080 stage, scaled to fit any viewport.

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MARTINA_INITIAL_MATRIX,
  OASIS_PHASES_IN_ORDER,
  OASIS_PHASE_LABELS,
  type OasisPhase,
} from "@salvador/shared";
import { AnimatedNumber } from "../components/event8dot8/AnimatedNumber.js";
import { QrCode } from "../components/event8dot8/QrCode.js";
import { useDemoEventLive, useEventLive } from "../components/event8dot8/useEventLive.js";

const STAGE_W = 1920;
const STAGE_H = 1080;
const ACTIVE_NOW_MS = 3 * 60_000;
const CURSOR_HIDE_MS = 3000;

const APP_URL =
  (import.meta.env["VITE_PUBLIC_APP_URL"] as string | undefined) ?? "https://summer-chatbot-dev.web.app";
const QR_URL = `${APP_URL.replace(/\/$/, "")}/martina?src=8dot8`;

const C = {
  bg: "#0F1226",
  panel: "#181C36",
  border: "#2A3060",
  text: "#FFFBF5",
  muted: "#A9B0D6",
  blue: "#92ADEF",
  teal: "#8DD4DA",
  pink: "#F4C4DC",
  yellow: "#FDE49C",
  peach: "#ECC389",
} as const;

const PHASE_COLOR: Record<OasisPhase, string> = {
  OBSERVA: C.blue,
  ACOGE: C.teal,
  SILENCIO: C.pink,
  ILUMINA: C.yellow,
  SOSTEN: C.peach,
};

type DriverKey = "intensidadEmocional" | "apertura" | "confianzaEnLaAyuda";
const DRIVERS: ReadonlyArray<{ key: DriverKey; label: string; hint: string; color: string }> = [
  {
    key: "intensidadEmocional",
    label: "Intensidad emocional",
    hint: "Baja cuando Martina se siente escuchada.",
    color: C.peach,
  },
  {
    key: "apertura",
    label: "Apertura",
    hint: "Sube cuando Martina siente que puede contar lo que le pasa.",
    color: C.teal,
  },
  {
    key: "confianzaEnLaAyuda",
    label: "Confianza en la ayuda",
    hint: "Sube cuando Martina cree que pedir ayuda vale la pena.",
    color: C.blue,
  },
];

const FONT_TITLE = "font-['Anton'] uppercase tracking-wide";
const FONT_MONO = "font-['JetBrains_Mono']";

function useStageScale(): number {
  const calc = (): number => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const [scale, setScale] = useState(calc);
  useEffect(() => {
    const onResize = (): void => setScale(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useIdleCursor(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const onMove = (): void => {
      setHidden(false);
      if (t !== null) clearTimeout(t);
      t = setTimeout(() => setHidden(true), CURSOR_HIDE_MS);
    };
    onMove();
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (t !== null) clearTimeout(t);
    };
  }, []);
  return hidden;
}

function Panel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section
      className={`flex flex-col rounded-[24px] border px-8 py-6 ${className}`}
      style={{ background: C.panel, borderColor: C.border }}
    >
      <h2 className={`${FONT_TITLE} text-[30px] leading-none`}>{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, accent, mono }: { label: string; value: number; accent: string; mono: string }) {
  return (
    <div
      className="flex flex-1 flex-col justify-between rounded-[24px] border px-7 py-5"
      style={{ background: C.panel, borderColor: C.border }}
    >
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: accent }} />
        <span className="text-[19px] font-semibold" style={{ color: C.muted }}>
          {label}
        </span>
      </div>
      <div className={`${FONT_TITLE} text-[84px] leading-none`} style={{ color: accent }}>
        <AnimatedNumber value={value} />
      </div>
      <div className={`${FONT_MONO} text-[13px]`} style={{ color: C.muted }}>
        {mono}
      </div>
    </div>
  );
}

function MartinaVideo() {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[28px] border shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
      style={{ borderColor: C.border, background: C.panel }}
    >
      {failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-10 text-center">
          <img src="/avatar-martina-v3.png" alt="" className="h-48 w-48 rounded-full object-cover" />
          <p className={`${FONT_TITLE} text-[44px] leading-tight`} style={{ color: C.pink }}>
            Martina
          </p>
          <p className="text-[22px]" style={{ color: C.muted }}>
            “Profe, ¿tiene un minuto? Necesito hablar con usted...”
          </p>
        </div>
      ) : (
        <video
          className="h-full w-full object-cover"
          src="/8dot8/martina.mp4"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function EventLive8dot8() {
  const [searchParams] = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const live = useEventLive(!demo);
  const demoData = useDemoEventLive(demo);
  const data = demo ? demoData : live.data;
  const reconnecting = !demo && live.reconnecting;

  const scale = useStageScale();
  const now = useNow(1000);
  const cursorHidden = useIdleCursor();

  const activeNow = data.recentActivity.filter((ms) => now - ms <= ACTIVE_NOW_MS).length;
  const clock = new Date(now).toLocaleTimeString("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className={`fixed inset-0 select-none overflow-hidden ${cursorHidden ? "cursor-none" : ""}`}
      style={{ background: C.bg }}
    >
      <div
        className="absolute left-1/2 top-1/2 flex flex-col font-sans"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          color: C.text,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {/* Top area */}
        <div className="flex min-h-0 flex-1 gap-8 px-10 pb-8 pt-9">
          <div className="h-full w-[520px] shrink-0">
            <MartinaVideo />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {/* Header */}
            <header className="flex items-start justify-between">
              <div>
                <h1 className={`${FONT_TITLE} text-[64px] leading-none`}>
                  Martina <span style={{ color: C.teal }}>//</span> Live
                </h1>
                <p className={`${FONT_MONO} mt-3 text-[17px]`} style={{ color: C.muted }}>
                  <span style={{ color: C.teal }}>summer@8dot8:~$</span> ./martina --escucha --metodo=OASIS
                  <span className="ml-1 inline-block h-[18px] w-[10px] animate-pulse align-middle" style={{ background: C.teal }} />
                </p>
              </div>
              <div className="flex items-center gap-5">
                {demo && (
                  <span
                    className={`${FONT_MONO} rounded-md border px-2 py-1 text-[13px]`}
                    style={{ borderColor: C.yellow, color: C.yellow }}
                  >
                    DEMO
                  </span>
                )}
                {reconnecting && (
                  <span className={`${FONT_MONO} text-[14px]`} style={{ color: C.muted }}>
                    reconectando…
                  </span>
                )}
                <span
                  className={`${FONT_MONO} flex items-center gap-2 rounded-full border px-4 py-2 text-[16px] font-bold`}
                  style={{ borderColor: C.pink, color: C.pink }}
                >
                  <span className="h-3 w-3 animate-pulse rounded-full" style={{ background: C.pink }} />
                  EN VIVO
                </span>
                <span className={`${FONT_MONO} text-[30px] tabular-nums`}>{clock}</span>
              </div>
            </header>

            {/* KPIs */}
            <div className="flex h-[200px] gap-6">
              <Kpi label="Sesiones en el evento" value={data.sessions} accent={C.blue} mono="> sesiones --src=8dot8" />
              <Kpi label="Conversando ahora" value={activeNow} accent={C.teal} mono="> activos --ultimos=3min" />
              <Kpi
                label="Minutos de escucha"
                value={Math.round(data.listenSeconds / 60)}
                accent={C.yellow}
                mono="> sum(tiempo_de_escucha)"
              />
              <Kpi label="Conductas OASIS detectadas" value={data.oasisTags} accent={C.pink} mono="> count(conductas)" />
            </div>

            {/* Panels */}
            <div className="flex min-h-0 flex-1 gap-6">
              <Panel title="Logro por fase OASIS" className="flex-1">
                <p className={`${FONT_MONO} mt-2 text-[14px]`} style={{ color: C.muted }}>
                  % de conversaciones donde apareció al menos una conducta de la fase
                </p>
                <div className="mt-4 flex flex-1 flex-col justify-around">
                  {OASIS_PHASES_IN_ORDER.map((phase) => {
                    const pct = data.phaseSessionPct[phase] ?? 0;
                    const color = PHASE_COLOR[phase];
                    return (
                      <div key={phase} className="flex items-center gap-5">
                        <span className={`${FONT_TITLE} w-10 text-[46px] leading-none`} style={{ color }}>
                          {phase.charAt(0)}
                        </span>
                        <span className="w-[120px] text-[20px] font-semibold">{OASIS_PHASE_LABELS[phase]}</span>
                        <div className="h-5 flex-1 overflow-hidden rounded-full" style={{ background: C.border }}>
                          <div
                            className="h-full rounded-full transition-[width] duration-1000 ease-out"
                            style={{ width: `${pct}%`, background: color }}
                          />
                        </div>
                        <span className={`${FONT_TITLE} w-[90px] text-right text-[34px] leading-none`}>
                          <AnimatedNumber value={pct} />%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="Matriz emocional" className="flex-1">
                <p className={`${FONT_MONO} mt-2 text-[14px]`} style={{ color: C.muted }}>
                  inicio de Martina <span style={{ color: C.text }}>vs</span> promedio al cerrar
                  {data.matrixFinalAvg !== null && ` · ${data.matrixFinalAvg.n} conversaciones`}
                </p>
                <div className="mt-4 flex flex-1 flex-col justify-around">
                  {DRIVERS.map((d) => {
                    const initial = MARTINA_INITIAL_MATRIX[d.key];
                    const final = data.matrixFinalAvg?.[d.key] ?? null;
                    return (
                      <div key={d.key} className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[21px] font-semibold">{d.label}</span>
                          <span className={`${FONT_MONO} text-[18px]`} style={{ color: C.muted }}>
                            {initial} →{" "}
                            <span className="font-bold" style={{ color: d.color }}>
                              {final === null ? "—" : <AnimatedNumber value={final} decimals={1} />}
                            </span>
                          </span>
                        </div>
                        <div className="h-[6px] overflow-hidden rounded-full" style={{ background: C.border }}>
                          <div className="h-full rounded-full" style={{ width: `${initial * 10}%`, background: C.muted }} />
                        </div>
                        <div className="h-4 overflow-hidden rounded-full" style={{ background: C.border }}>
                          <div
                            className="h-full rounded-full transition-[width] duration-1000 ease-out"
                            style={{ width: `${(final ?? 0) * 10}%`, background: d.color }}
                          />
                        </div>
                        <span className="text-[16px]" style={{ color: C.muted }}>
                          {d.hint}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          </div>
        </div>

        {/* Bottom band */}
        <div className="flex h-[300px] shrink-0 items-center gap-12 px-12" style={{ background: "#FFFBF5", color: C.bg }}>
          <QrCode url={QR_URL} size={256} />
          <div className="relative rounded-[28px] border-4 px-9 py-6" style={{ borderColor: C.bg, background: "#FFFFFF" }}>
            <p className="text-[30px] font-bold leading-snug">“Profe, ¿tiene un minuto? Necesito hablar con usted...”</p>
            <span
              className="absolute -left-[22px] top-1/2 h-0 w-0 -translate-y-1/2 border-y-[16px] border-r-[20px] border-y-transparent"
              style={{ borderRightColor: C.bg }}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <p className={`${FONT_TITLE} text-[64px] leading-none`}>Escanea y conversa con Martina</p>
            <p className="text-[22px] font-medium" style={{ color: "#3A3F5C" }}>
              Un motor conversacional con IA que entrena a docentes en contención emocional · #yoelijosalvar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
