import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

/* ─── types ─── */
type LineType = "cmd" | "info" | "warn" | "ok" | "fail";

interface TLine {
  type: LineType;
  text: string;
}

/* ─── data ─── */
const commands = [
  "rindo --sync --modo-honesto",
  "rindo --revisar-gastos --sin-juzgar",
  "rindo --analizar-finanzas --sin-llorar",
  "rindo --cargar-datos --con-fe",
  "rindo --init --preparar-pañuelos",
];

const pool: TLine[] = [
  { type: "info", text: "Consultando al Tío René sobre tu situación financiera..." },
  { type: "info", text: "Preguntándole a tu vieja si te puede prestar..." },
  { type: "fail", text: "Visto a las 14:32." },
];

/* ─── helpers ─── */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const prefixes: Record<LineType, string> = {
  cmd: "$ ",
  info: "[INFO] ",
  warn: "[WARN] ",
  ok: "[ OK ] ",
  fail: "[FAIL] ",
};

const textColors: Record<LineType, string> = {
  cmd: "text-green-400",
  info: "text-zinc-400",
  warn: "text-amber-400",
  ok: "text-emerald-400",
  fail: "text-red-400",
};

const dimColors: Record<LineType, string> = {
  cmd: "text-green-400/50",
  info: "text-zinc-600",
  warn: "text-amber-400/50",
  ok: "text-emerald-400/50",
  fail: "text-red-400/50",
};

/* ─── component ─── */
interface LoadingScreenProps {
  fullScreen?: boolean;
  message?: string;
  size?: "sm" | "md" | "lg";
  showFunFact?: boolean;
}

export function LoadingScreen({
  fullScreen = true,
  message,
  size = "md",
  showFunFact = true,
}: LoadingScreenProps) {
  const [done, setDone] = useState<TLine[]>([]);
  const [cur, setCur] = useState<{ type: LineType; text: string } | null>(null);
  const [blink, setBlink] = useState(true);
  const [visible, setVisible] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // entrance animation
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // cursor blink
  useEffect(() => {
    const id = setInterval(() => setBlink((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  // typing engine
  useEffect(() => {
    if (message) return;

    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    const cmd = commands[Math.floor(Math.random() * commands.length)];
    const script: TLine[] = [
      { type: "cmd", text: cmd },
      ...(showFunFact
        ? shuffle(pool)
        : [{ type: "info" as LineType, text: "Cargando datos..." }]),
    ];

    let li = 0;
    let ci = 0;

    function tick() {
      if (stop || li >= script.length) return;
      const line = script[li];

      if (ci <= line.text.length) {
        setCur({ type: line.type, text: line.text.slice(0, ci) });
        ci++;
        const speed =
          line.type === "cmd"
            ? 20 + Math.random() * 25
            : 8 + Math.random() * 16;
        timer = setTimeout(tick, speed);
      } else {
        setDone((p) => [...p, line]);
        setCur(null);
        li++;
        ci = 0;
        timer = setTimeout(tick, 250 + Math.random() * 350);
      }
    }

    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [showFunFact, message]);

  // auto-scroll
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [done, cur]);

  // simple message mode
  if (message) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-3",
          fullScreen && "min-h-screen bg-background"
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <p className="text-sm text-muted-foreground font-mono">{message}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-4",
        fullScreen && "min-h-screen bg-background"
      )}
    >
      {/* terminal */}
      <div
        className={cn(
          "w-full rounded-xl border border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden transition-all duration-700 ease-out",
          visible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-6 scale-[0.97]",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-md",
          size === "lg" && "max-w-lg"
        )}
      >
        {/* title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800/50 select-none">
          <div className="flex gap-[6px]">
            <div className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
            <div className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
            <div className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
          </div>
          <span className="ml-2 text-[11px] text-zinc-500 font-mono tracking-wide">
            rindo — finanzas.sh
          </span>
        </div>

        {/* body */}
        <div
          ref={bodyRef}
          className={cn(
            "p-4 font-mono text-[13px] leading-relaxed space-y-0.5 overflow-y-auto",
            size === "sm" && "max-h-40 text-xs",
            size === "md" && "max-h-56",
            size === "lg" && "max-h-72"
          )}
        >
          {done.map((l, i) => (
            <div key={i}>
              <span className={dimColors[l.type]}>{prefixes[l.type]}</span>
              <span className={textColors[l.type]}>{l.text}</span>
            </div>
          ))}
          {cur && (
            <div>
              <span className={dimColors[cur.type]}>{prefixes[cur.type]}</span>
              <span className={textColors[cur.type]}>{cur.text}</span>
              <span
                className={cn(
                  "inline-block w-[7px] h-[14px] ml-[1px] translate-y-[3px] bg-green-400 transition-opacity duration-75",
                  blink ? "opacity-80" : "opacity-0"
                )}
              />
            </div>
          )}
        </div>

        {/* progress bar */}
        <div className="h-[2px] bg-zinc-900/80">
          <div
            className="h-full bg-gradient-to-r from-green-500/50 to-emerald-400/50 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(92, done.length * 12)}%` }}
          />
        </div>
      </div>

      {/* branding */}
      <div
        className={cn(
          "mt-5 flex items-center gap-2 transition-opacity duration-1000 delay-500",
          visible ? "opacity-30" : "opacity-0"
        )}
      >
        <img
          src="/icon-512x512-removebg-preview.png"
          alt=""
          className="h-4 w-4"
        />
        <span className="text-[11px] font-mono text-zinc-500 tracking-[0.2em] uppercase">
          rindo
        </span>
      </div>
    </div>
  );
}

// Inline spinner — unchanged
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <img
        src="/icon-512x512-removebg-preview.png"
        alt="Cargando"
        className="h-6 w-6 animate-breathe"
      />
    </div>
  );
}
