import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { format } from "date-fns";
import { periodNameDate, periodStartOf, shiftPeriod } from "@/lib/period";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { es } from "date-fns/locale";
import type { Transaction } from "@/hooks/useTransactions";
import type { Category } from "@/hooks/useCategories";
import { computeRealFlows, type RealFlowsConfig } from "@/lib/real-flows";
import { computeMonthPace, paceVerdict, type MonthPace, type PaceVerdict } from "@/lib/month-pace";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { clp, clpCompact } from "@/lib/format";

const TONE: Record<PaceVerdict, string> = {
  under: "oklch(var(--success))",
  over: "oklch(var(--destructive))",
  even: "var(--foreground)",
};
const MUTED = "var(--muted-foreground)";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const linePath = (pts: Array<[number, number]>) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

function PaceRace({ pace, verdict, privacy }: { pace: MonthPace; verdict: PaceVerdict; privacy: boolean }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = W >= 440 ? Math.round(Math.min(440, Math.max(280, W * 0.62))) : 240;
  const pad = { l: 4, r: 64, t: 20, b: 26 };
  const { daysInMonth: days, asOfDay, me, typical } = pace;
  const tone = TONE[verdict];

  const maxV = Math.max(1, ...me, ...(typical?.high ?? []), pace.projectedTotal) * 1.08;
  const x = (d: number) => pad.l + (d / days) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxV) * (H - pad.t - pad.b);
  const range = (to: number) => Array.from({ length: to + 1 }, (_, d) => d);

  if (W === 0) return <div ref={ref} style={{ height: 240 }} />;

  const meLine = linePath(range(asOfDay).map((d) => [x(d), y(me[d])]));
  const band = typical
    ? linePath([
        ...range(days).map((d) => [x(d), y(typical.high[d])] as [number, number]),
        ...range(days).reverse().map((d) => [x(d), y(typical.low[d])] as [number, number]),
      ]) + "Z"
    : null;
  const median = typical ? linePath(range(days).map((d) => [x(d), y(typical.median[d])])) : null;
  const gap = typical
    ? linePath([
        ...range(asOfDay).map((d) => [x(d), y(me[d])] as [number, number]),
        ...range(asOfDay).reverse().map((d) => [x(d), y(typical.median[d])] as [number, number]),
      ]) + "Z"
    : null;
  const ticks = [1, 8, 15, 22, days];
  const hx = hover ?? null;

  return (
    <div
      ref={ref}
      className="relative select-none touch-pan-y"
      style={{ height: H }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const d = Math.round(((e.clientX - r.left - pad.l) / (W - pad.l - pad.r)) * days);
        setHover(Math.max(1, Math.min(days, d)));
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={W} height={H} className="overflow-visible">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--border)" />
        {ticks.map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-xs tabular-nums">
            {d}
          </text>
        ))}

        {band && <path d={band} fill={MUTED} opacity={0.1} />}
        {median && (
          <path d={median} fill="none" stroke={MUTED} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />
        )}
        {gap && (
          <motion.path
            d={gap}
            fill={tone}
            initial={{ opacity: 0 }}
            animate={{ opacity: verdict === "even" ? 0.06 : 0.16 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          />
        )}

        {pace.isLive && typical && asOfDay < days && (
          <motion.line
            x1={x(asOfDay)} y1={y(me[asOfDay])} x2={x(days)} y2={y(pace.projectedTotal)}
            stroke={tone} strokeWidth={1.5} strokeDasharray="2 5" strokeLinecap="round"
            initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1.1 }}
          />
        )}

        <motion.path
          key={`${days}-${asOfDay}-${me[asOfDay]}`}
          d={meLine}
          fill="none"
          stroke={tone}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />

        <g transform={`translate(${x(asOfDay)},${y(me[asOfDay])})`}>
          {pace.isLive && (
            <motion.circle
              r={6} fill={tone}
              animate={{ scale: [1, 2.4], opacity: [0.35, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <circle r={5} fill={tone} stroke="var(--background)" strokeWidth={2} />
          <text y={-12} textAnchor="middle" className="fill-foreground text-xs font-medium">
            {pace.isLive ? "hoy" : "cierre"}
          </text>
        </g>

        {typical && (
          <g className={cn(privacy && "privacy-blur")}>
            <text x={x(days) + 8} y={y(typical.median[days]) + 4} className="fill-muted-foreground text-xs">
              típico
            </text>
            <text x={x(days) + 8} y={y(typical.median[days]) + 16} className="fill-muted-foreground text-xs tabular-nums">
              {clpCompact(typical.median[days])}
            </text>
          </g>
        )}
        {pace.isLive && typical && asOfDay < days && Math.abs(y(pace.projectedTotal) - y(typical.median[days])) > 24 && (
          <g className={cn(privacy && "privacy-blur")}>
            <text x={x(days) + 8} y={y(pace.projectedTotal) + 4} className="text-xs font-medium" fill={tone}>
              tú
            </text>
            <text x={x(days) + 8} y={y(pace.projectedTotal) + 16} className="text-xs tabular-nums" fill={tone}>
              ~{clpCompact(pace.projectedTotal)}
            </text>
          </g>
        )}

        {hx !== null && (
          <line x1={x(hx)} x2={x(hx)} y1={pad.t} y2={H - pad.b} stroke="var(--foreground)" opacity={0.25} />
        )}
      </svg>

      {hx !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-card border border-border bg-popover px-2 py-1.5 text-xs shadow-float"
          style={{ left: Math.min(Math.max(x(hx) - 70, 0), W - 140), width: 140 }}
        >
          <p className="font-medium">Día {hx}</p>
          <div className={cn("mt-0.5 space-y-0.5 tabular-nums", privacy && "privacy-blur")}>
            {hx <= asOfDay && (
              <p className="flex justify-between"><span className="text-muted-foreground">Tú</span>{clp(me[hx])}</p>
            )}
            {typical && (
              <p className="flex justify-between"><span className="text-muted-foreground">Típico</span>{clp(typical.median[hx])}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Drivers({ pace, colors, privacy }: { pace: MonthPace; colors: Map<string, string | null>; privacy: boolean }) {
  const floor = Math.max(3_000, pace.typicalSoFar * 0.02);
  const rows = pace.drivers.filter((d) => Math.abs(d.delta) >= floor).slice(0, 4);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => Math.abs(r.delta)));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Lo que explica la diferencia</p>
      {rows.map((r, i) => {
        const over = r.delta > 0;
        const w = (Math.abs(r.delta) / max) * 50;
        return (
          <div
            key={r.category}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-3"
            title={`Llevas ${clp(r.me)} · a esta altura sueles llevar ${clp(r.typical)}`}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className="size-2 shrink-0 rounded-full" style={{ background: colors.get(r.category) ?? MUTED }} />
              <span className="truncate">{r.category}</span>
            </span>
            <div className="relative h-2">
              <div className="absolute inset-y-[-3px] left-1/2 w-px bg-border" />
              <motion.div
                className="absolute inset-y-0 rounded-full"
                style={{
                  background: over ? TONE.over : TONE.under,
                  [over ? "left" : "right"]: "50%",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${w}%` }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <span className={cn("w-20 text-right text-sm font-medium tabular-nums", privacy && "privacy-blur")}>
              {over ? "+" : "−"}
              {clpCompact(Math.abs(r.delta))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Headline({ pace, verdict, privacy }: { pace: MonthPace; verdict: PaceVerdict; privacy: boolean }) {
  const tone = TONE[verdict];
  if (!pace.typical) {
    return (
      <div>
        <p className="text-hero font-semibold tracking-tight tabular-nums">
          <span className={cn(privacy && "privacy-blur")}>{clp(pace.spentSoFar)}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          gastados. Cuando cierres tu primer mes, acá vas a correr contra él.
        </p>
      </div>
    );
  }
  const phrase = pace.isLive
    ? verdict === "under" ? "bajo tu ritmo" : verdict === "over" ? "sobre tu ritmo" : "en tu ritmo"
    : verdict === "under" ? "bajo tu mes típico" : verdict === "over" ? "sobre tu mes típico" : "igual que tu mes típico";

  return (
    <div>
      {verdict === "even" ? (
        <p className="text-hero font-medium tracking-tight">Justo {phrase}</p>
      ) : (
        <p className="text-hero font-medium tracking-tight">
          <span className={cn("font-semibold tabular-nums", privacy && "privacy-blur")} style={{ color: tone }}>
            $<NumberFlow value={Math.round(Math.abs(pace.delta))} locales="es-CL" format={{ maximumFractionDigits: 0 }} />
          </span>
          <span className="block text-xl font-medium text-muted-foreground lg:mt-1">{phrase}</span>
        </p>
      )}
      <p className={cn("mt-3 text-sm text-muted-foreground", privacy && "privacy-blur")}>
        {pace.isLive ? (
          <>
            Llevas <b className="text-foreground">{clp(pace.spentSoFar)}</b>. Al día {pace.asOfDay} sueles llevar{" "}
            {clp(pace.typicalSoFar)}.
          </>
        ) : (
          <>
            Gastaste <b className="text-foreground">{clp(pace.spentSoFar)}</b>. Tu mes típico cierra en{" "}
            {clp(pace.typicalTotal)}.
          </>
        )}
      </p>
    </div>
  );
}

interface MonthPulseProps {
  open: boolean;
  onClose: () => void;
  initialMonth: Date;
  transactions: Transaction[];
  categories: Category[];
  flowConfig?: Partial<RealFlowsConfig>;
}

export function MonthPulse({ open, onClose, initialMonth, transactions, categories, flowConfig }: MonthPulseProps) {
  const { isPrivacyMode } = usePrivacyMode();
  const period = usePeriodConfig();
  const startDay = flowConfig?.periodStartDay ?? period.startDay;
  const startOf = (d: Date) => periodStartOf(d, startDay);
  const shift = useCallback((m: Date, delta: number) => shiftPeriod(m, delta, startDay), [startDay]);
  const [month, setMonth] = useState(() => startOf(initialMonth));

  useEffect(() => {
    if (open) setMonth(startOf(initialMonth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startDay]);

  const firstMonth = useMemo(() => {
    let min = Date.now();
    for (const t of transactions) min = Math.min(min, new Date(t.date).getTime());
    return periodStartOf(new Date(min), startDay);
  }, [transactions, startDay]);
  const canBack = month > firstMonth;
  const canForward = month < startOf(new Date());

  const pace = useMemo(
    () => computeMonthPace(transactions, month, { startDay }),
    [transactions, month, startDay]
  );
  const verdict = paceVerdict(pace);
  const colors = useMemo(() => new Map(categories.map((c) => [c.name, c.color])), [categories]);

  const income = useMemo(() => {
    const cur = computeRealFlows(transactions, month, flowConfig).ingresoReal;
    if (cur > 0 || !pace.isLive) return { amount: cur, estimated: false };
    const prev = [1, 2, 3]
      .map((b) => computeRealFlows(transactions, shift(month, -b), flowConfig).ingresoReal)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    return { amount: prev.length ? prev[Math.floor(prev.length / 2)] : 0, estimated: true };
  }, [transactions, month, flowConfig, pace.isLive, shift]);
  const leftover = income.amount - pace.projectedTotal;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && canBack) setMonth((m) => shift(m, -1));
      if (e.key === "ArrowRight" && canForward) setMonth((m) => shift(m, 1));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, canBack, canForward, shift]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pt-8 lg:max-w-6xl lg:px-12 lg:pb-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMonth((m) => shift(m, -1))}
                  disabled={!canBack}
                  className="size-9 disabled:opacity-30"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft />
                </Button>
                <div className="min-w-32 text-center">
                  <p className="text-sm font-medium capitalize">{format(periodNameDate(month, startDay), "MMMM yyyy", { locale: es })}</p>
                  <p className="text-xs text-muted-foreground">
                    {!period.isCalendar && <>{period.rangeLabel(month)} · </>}
                    {pace.isLive ? `Día ${pace.asOfDay} de ${pace.daysInMonth}` : "Mes cerrado"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMonth((m) => shift(m, 1))}
                  disabled={!canForward}
                  className="size-9 disabled:opacity-30"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight />
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="size-9 bg-muted" aria-label="Cerrar">
                <X />
              </Button>
            </div>

            <motion.div
              key={month.toISOString()}
              className="flex flex-col gap-8 lg:my-auto lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-x-12 lg:gap-y-8"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="lg:col-start-1 lg:row-start-1">
                <Headline pace={pace} verdict={verdict} privacy={isPrivacyMode} />
              </div>

              <div className="lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:rounded-card lg:bg-card lg:p-6">
                <PaceRace pace={pace} verdict={verdict} privacy={isPrivacyMode} />
                {pace.typical && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-4 rounded-full" style={{ background: TONE[verdict] }} /> Tú
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 border-t-[1.5px] border-dashed border-muted-foreground" /> Tu mes típico
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-4 rounded-full" style={{ background: "color-mix(in oklch, var(--muted-foreground) 15%, transparent)" }} /> Tu rango normal
                    </span>
                  </div>
                )}
              </div>

              {pace.typical && (
                <div className="grid grid-cols-2 gap-3 lg:col-start-1 lg:row-start-2">
                  <div className="rounded-card bg-muted p-4">
                    <p className="text-xs text-muted-foreground">
                      {pace.isLive ? "Cierras en" : "Gastaste"}
                    </p>
                    <p className={cn("mt-1 text-xl font-medium tabular-nums", isPrivacyMode && "privacy-blur")}>
                      {pace.isLive ? "~" : ""}
                      {clpCompact(pace.projectedTotal)}
                    </p>
                    <p className={cn("text-xs text-muted-foreground", isPrivacyMode && "privacy-blur")}>
                      típico {clpCompact(pace.typicalTotal)}
                    </p>
                  </div>
                  {income.amount > 0 && (
                    <div className="rounded-card bg-muted p-4">
                      <p className="text-xs text-muted-foreground">
                        {leftover >= 0 ? (pace.isLive ? "Te sobran" : "Te sobró") : pace.isLive ? "Te faltan" : "Te faltó"}
                      </p>
                      <p
                        className={cn("mt-1 text-xl font-medium tabular-nums", isPrivacyMode && "privacy-blur")}
                        style={{ color: leftover >= 0 ? TONE.under : TONE.over }}
                      >
                        {pace.isLive ? "~" : ""}
                        {clpCompact(Math.abs(leftover))}
                      </p>
                      <p className={cn("text-xs text-muted-foreground", isPrivacyMode && "privacy-blur")}>
                        de {clpCompact(income.amount)} {income.estimated ? "que suelen entrar" : "que entraron"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="lg:col-start-1 lg:row-start-3">
                <Drivers pace={pace} colors={colors} privacy={isPrivacyMode} />
              </div>

              {pace.typical && (
                <p className="text-xs text-muted-foreground lg:col-start-1 lg:row-start-4">
                  Tu mes típico es la mediana de tus últimos {pace.typicalMonths}{" "}
                  {pace.typicalMonths === 1 ? "mes" : "meses"} al mismo día. Gasto neto de reembolsos, sin
                  plata en tránsito.
                </p>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PaceText({ pace, className }: { pace: MonthPace; className?: string }) {
  if (!pace.typical) return null;
  const verdict = paceVerdict(pace);
  return (
    <b className={className} style={{ color: verdict === "even" ? undefined : TONE[verdict] }}>
      {verdict === "even"
        ? "Justo en tu ritmo"
        : `${clpCompact(Math.abs(pace.delta))} ${verdict === "under" ? "bajo" : "sobre"} tu ritmo`}
    </b>
  );
}

export function PaceSpark({ pace, className }: { pace: MonthPace; className?: string }) {
  const tone = TONE[paceVerdict(pace)];
  const W = 100;
  const H = 100;
  const maxV = Math.max(1, ...pace.me, ...(pace.typical?.median ?? []));
  const px = (d: number) => (d / pace.daysInMonth) * W;
  const py = (v: number) => H - 4 - (v / maxV) * (H - 8);
  const days = (to: number) => Array.from({ length: to + 1 }, (_, d) => d);

  return (
    <span className={cn("relative block", className)} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        {pace.typical && (
          <path
            d={linePath(days(pace.daysInMonth).map((d) => [px(d), py(pace.typical!.median[d])]))}
            fill="none" stroke={MUTED} strokeWidth={1.25} strokeDasharray="3 3" opacity={0.6} vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={linePath(days(pace.asOfDay).map((d) => [px(d), py(pace.me[d])]))}
          fill="none" stroke={tone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        />
      </svg>
      <i
        className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${px(pace.asOfDay)}%`, top: `${py(pace.me[pace.asOfDay])}%`, background: tone }}
      />
    </span>
  );
}
