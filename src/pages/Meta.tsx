import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import NumberFlow from "@number-flow/react";
import { Check, Pencil, X } from "lucide-react";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions } from "@/hooks/useTransactions";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import {
  computeNextMonthSweep,
  computeSavingsMonths,
  type SavingsMonth,
  type Sweep,
} from "@/lib/savings-goal";

/**
 * Meta: ahorrar $X al mes. La página responde una sola pregunta, ¿la estás
 * cumpliendo?, con un número por mes: lo que de verdad se movió a inversión.
 * Nada derivado. Una pantalla exacta en web y celular.
 */

const MONTHS = 12;
/** Hasta este día del mes, un $0 todavía no es una alarma: el barrido puede venir. */
const GRACE_DAY = 5;

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);

/** "917k", "1,8M", "1M", "0": lo justo para caber sobre una barra. */
const short = (v: number) => {
  if (v <= 0) return "0";
  if (v < 1_000_000) return `${Math.round(v / 1000)}k`;
  const m = v / 1_000_000;
  return `${(Math.round(m * 10) / 10).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`;
};

const day = (d: Date) => format(d, "d MMM", { locale: es }).replace(".", "");

/** "29 ago", "28 ene y 12 feb", "28 ene, 12 feb y 20 feb". Dos aportes el mismo día son un día. */
const listDays = (sweeps: Sweep[]) => {
  const days = Array.from(new Set(sweeps.map((s) => day(s.date))));
  if (days.length <= 1) return days.join("");
  return `${days.slice(0, -1).join(", ")} y ${days[days.length - 1]}`;
};

const parseAmount = (raw: string) => parseInt(raw.replace(/\D/g, ""), 10) || 0;
const formatInput = (raw: string) => (raw ? parseAmount(raw).toLocaleString("es-CL") : "");

type Tone = "met" | "part" | "none" | "wait";

const toneOf = (m: SavingsMonth, isCurrent: boolean, today: Date): Tone => {
  if (m.met) return "met";
  if (m.saved > 0) return "part";
  return isCurrent && today.getDate() <= GRACE_DAY ? "wait" : "none";
};

export default function Meta() {
  const { transactions, isLoading } = useTransactions();
  const { budget, isLoading: budgetLoading, upsertBudget } = useMonthlyBudget();
  const { isPrivacyMode } = usePrivacyMode();

  const today = new Date();
  const goal = budget?.savings_goal ?? 0;
  const hasGoal = goal > 0;

  const months = useMemo(
    () => computeSavingsMonths(transactions, goal, today, MONTHS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, goal, today.getFullYear(), today.getMonth()]
  );
  const nextSweeps = useMemo(
    () => computeNextMonthSweep(transactions, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, today.getFullYear(), today.getMonth()]
  );

  const current = months[months.length - 1];
  const metCount = months.filter((m) => m.met).length;
  const [selectedKey, setSelectedKey] = useState(current.key);
  const selected = months.find((m) => m.key === selectedKey) ?? current;

  // La escala del gráfico: la meta con aire arriba, o el mejor mes si la pasó.
  const scale = Math.max(goal * 1.12, ...months.map((m) => m.saved * 1.04), 1);
  const goalFrac = hasGoal ? goal / scale : 0;

  // ── Editar la meta ──
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (!editing) setDraft(hasGoal ? String(goal) : "");
  }, [goal, hasGoal, editing]);

  const saveGoal = () => {
    const value = parseAmount(draft);
    if (value <= 0) return;
    upsertBudget.mutate({ savings_goal: value });
    setEditing(false);
  };

  const goalInput = (autoFocus: boolean) => (
    <span className="meta-edit">
      <span className="meta-edit-field">
        <span>$</span>
        <input
          value={formatInput(draft)}
          inputMode="numeric"
          placeholder="1.500.000"
          autoFocus={autoFocus}
          aria-label="Meta de ahorro mensual"
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveGoal();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </span>
      <button onClick={saveGoal} disabled={parseAmount(draft) <= 0} aria-label="Guardar meta" className="meta-edit-btn">
        <Check />
      </button>
      {hasGoal && (
        <button onClick={() => setEditing(false)} aria-label="Cancelar" className="meta-edit-btn">
          <X />
        </button>
      )}
    </span>
  );

  // ── El estado del mes en curso, en una frase ──
  const currentTone = toneOf(current, true, today);
  const pct = hasGoal ? Math.min(100, Math.round((current.saved / goal) * 100)) : 0;
  const nextMonthName = format(new Date(today.getFullYear(), today.getMonth() + 1, 1), "MMMM", { locale: es });
  const nextTotal = nextSweeps.reduce((s, x) => s + x.amount, 0);

  let note: { text: string; tone: Tone } = { text: "", tone: "wait" };
  if (nextTotal > 0) {
    note = { text: `ya barriste ${formatCurrency(nextTotal)} para ${nextMonthName} ✓`, tone: "met" };
  } else if (current.met) {
    note = { text: `cumplida ✓ · barrido el ${listDays(current.sweeps)}`, tone: "met" };
  } else if (current.saved > 0) {
    note = { text: `barrido el ${listDays(current.sweeps)} · faltan ${formatCurrency(goal - current.saved)}`, tone: "part" };
  } else if (currentTone === "wait") {
    note = { text: "todavía no barres nada este mes", tone: "wait" };
  } else {
    note = { text: "este mes no barriste nada", tone: "none" };
  }

  // ── El detalle del mes elegido: dos líneas fijas, sin saltos ──
  const detailTop = `${format(selected.month, "MMMM", { locale: es })} · ${formatCurrency(selected.saved)}`;
  const detailBottom = (() => {
    const parts: string[] = [];
    if (selected.sweeps.length) parts.push(`barrido el ${listDays(selected.sweeps)}`);
    if (selected.rescued > 0) parts.push(`rescataste ${formatCurrency(selected.rescued)}`);
    if (!selected.met && selected.biggestHit) {
      parts.push(`el golpe: ${selected.biggestHit.label} ${formatCurrency(selected.biggestHit.amount)}`);
    }
    if (!parts.length) parts.push(selected.met ? "cumplida" : "sin movimientos a inversión");
    return parts.join(" · ");
  })();

  const loading = isLoading || budgetLoading;

  return (
    <Layout fit>
      <div className="meta">
        <header className="meta-head">
          <h1 className="meta-title">Meta</h1>
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : hasGoal && !editing ? (
            <button className="meta-goal" onClick={() => setEditing(true)} aria-label="Editar meta">
              Ahorrar <b className={cn(isPrivacyMode && "privacy-blur")}>{formatCurrency(goal)}</b> al mes
              <Pencil />
            </button>
          ) : hasGoal ? (
            goalInput(true)
          ) : null}
        </header>

        {loading ? (
          <div className="meta-grid">
            <Skeleton className="meta-card h-[150px]" />
            <Skeleton className="meta-card h-[150px]" />
          </div>
        ) : !hasGoal ? (
          <section className="meta-card meta-setup">
            <h2>¿Cuánto quieres ahorrar al mes?</h2>
            <p>Un solo número. Cada mes verás si lo cumpliste con lo que de verdad moviste a inversión.</p>
            {goalInput(false)}
          </section>
        ) : (
          <div className="meta-grid">
            {/* El mes en curso */}
            <section className="meta-card meta-now" data-tone={currentTone}>
              <div className="meta-now-top">
                <span className="meta-month">{format(today, "MMMM yyyy", { locale: es })}</span>
                <span className="meta-pct">{pct}%</span>
              </div>
              <div className={cn("meta-big", isPrivacyMode && "privacy-blur")}>
                $<NumberFlow
                  value={current.saved}
                  format={{ style: "decimal", maximumFractionDigits: 0 }}
                  locales="es-CL"
                />
              </div>
              <div className={cn("meta-of", isPrivacyMode && "privacy-blur")}>de {formatCurrency(goal)}</div>
              <div className="meta-track" aria-hidden>
                <i style={{ width: `${Math.max(pct, current.saved > 0 ? 1.5 : 0)}%` }} />
              </div>
              <p className={cn("meta-note", isPrivacyMode && "privacy-blur")} data-tone={note.tone}>
                {note.text}
              </p>
            </section>

            {/* Los últimos doce meses */}
            <section className="meta-card meta-hist">
              <div className="meta-hist-head">
                <span className="meta-label">Últimos {MONTHS} meses</span>
                <span className="meta-count">
                  <b>{metCount}</b> de {MONTHS} cumplidos
                </span>
              </div>
              <div className="meta-chart" role="listbox" aria-label="Ahorro por mes">
                <i
                  className="meta-goal-line"
                  style={{ bottom: `calc(var(--meta-mon) + (100% - var(--meta-amt) - var(--meta-mon)) * ${goalFrac})` }}
                  aria-hidden
                />
                {months.map((m, i) => {
                  const isCurrent = m.key === current.key;
                  const tone = toneOf(m, isCurrent, today);
                  const height = `${Math.min(100, (m.saved / scale) * 100)}%`;
                  return (
                    <button
                      key={m.key}
                      role="option"
                      aria-selected={m.key === selectedKey}
                      className="meta-col"
                      data-tone={tone}
                      onClick={() => setSelectedKey(m.key)}
                      style={{ "--i": i } as React.CSSProperties}
                    >
                      <span className={cn("meta-amt", isPrivacyMode && "privacy-blur")}>
                        {m.met && <span className="meta-check">✓</span>}
                        <span className="meta-amt-num">{short(m.saved)}</span>
                      </span>
                      <span className="meta-bar">
                        <i style={{ height }} />
                      </span>
                      <span className="meta-mon"><span>{format(m.month, "MMM", { locale: es }).replace(".", "")}</span></span>
                    </button>
                  );
                })}
              </div>
              <div className="meta-detail" data-tone={toneOf(selected, selected.key === current.key, today)}>
                <p className={cn("meta-detail-top", isPrivacyMode && "privacy-blur")}>{detailTop}</p>
                <p className={cn("meta-detail-sub", isPrivacyMode && "privacy-blur")}>{detailBottom}</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}
