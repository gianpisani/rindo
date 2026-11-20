import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLocation } from "react-router-dom";
import NumberFlow from "@number-flow/react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { CategorySelect } from "@/components/categories/CategorySelect";
import { getCategoryIcon } from "@/lib/category-icon";
import { useTransactions } from "@/hooks/useTransactions";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { DEFAULT_ALERT_AT, limitUsage } from "@/lib/category-spending";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { dayOfPeriod, periodEndOf, periodIndex, periodNameDate, periodStartOf, shiftPeriod } from "@/lib/period";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import { isCardPayment, isCardPaymentCategory } from "@/lib/ledger";
import {
  computeNextMonthSweep,
  computeSavingsMonths,
  type SavingsMonth,
  type Sweep,
} from "@/lib/savings-goal";
import { tint } from "@/lib/category-color";
import { clp } from "@/lib/format";

/**
 * Meta: ahorrar $X al mes. La página responde una sola pregunta, ¿la estás
 * cumpliendo?, con un número por mes: lo que de verdad se movió a inversión.
 * Al lado, los límites por categoría: el único lugar donde se ven y editan.
 * Nada derivado. Una pantalla exacta en web y celular.
 */

const MONTHS = 12;
/** Hasta este día del mes, un $0 todavía no es una alarma: el barrido puede venir. */
const GRACE_DAY = 5;

const day = (d: Date) => format(d, "d MMM", { locale: es }).replace(".", "");

/** "29 ago", "28 ene y 12 feb", "28 ene, 12 feb y 20 feb". Dos aportes el mismo día son un día. */
const listDays = (sweeps: Sweep[]) => {
  const days = Array.from(new Set(sweeps.map((s) => day(s.date))));
  if (days.length <= 1) return days.join("");
  return `${days.slice(0, -1).join(", ")} y ${days[days.length - 1]}`;
};

const parseAmount = (raw: string) => parseInt(raw.replace(/\D/g, ""), 10) || 0;
const formatInput = (raw: string) => (raw ? parseAmount(raw).toLocaleString("es-CL") : "");

/** El ícono de una categoría sobre un tono de su color. */

type Tone = "met" | "part" | "none" | "wait";

/** `dayOfMonth`: día del mes financiero en curso (1 = el día en que empieza). */
const toneOf = (m: SavingsMonth, isCurrent: boolean, dayOfMonth: number): Tone => {
  if (m.met) return "met";
  if (m.saved > 0) return "part";
  return isCurrent && dayOfMonth <= GRACE_DAY ? "wait" : "none";
};

/** Un campo de monto en línea: Enter guarda, Esc cancela. */
function AmountField({
  value,
  onChange,
  onSave,
  onCancel,
  autoFocus,
  placeholder = "1.500.000",
  label,
}: {
  value: string;
  onChange: (raw: string) => void;
  onSave: () => void;
  onCancel: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  label: string;
}) {
  return (
    <span className="meta-edit-field">
      <span>$</span>
      <input
        value={formatInput(value)}
        inputMode="numeric"
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={label}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
      />
    </span>
  );
}

export default function Meta() {
  const { transactions, isLoading } = useTransactions();
  const { budget, isLoading: budgetLoading, upsertBudget } = useMonthlyBudget();
  const { categories } = useCategories();
  const { limits, upsertLimit, deleteLimit } = useCategoryLimits();
  const { isPrivacyMode } = usePrivacyMode();

  const today = new Date();
  const period = usePeriodConfig();
  const { startDay } = period;
  const thisPeriod = period.currentPeriod;
  const todayInPeriod = dayOfPeriod(today, thisPeriod);
  const goal = budget?.savings_goal ?? 0;
  const hasGoal = goal > 0;

  const months = useMemo(
    () => computeSavingsMonths(transactions, goal, today, MONTHS, startDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, goal, thisPeriod.getTime(), startDay]
  );
  const nextSweeps = useMemo(
    () => computeNextMonthSweep(transactions, today, startDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, thisPeriod.getTime(), startDay]
  );

  const current = months[months.length - 1];
  const metCount = months.filter((m) => m.met).length;
  const [selectedKey, setSelectedKey] = useState(current.key);
  // Si cambia el mes financiero, la selección vuelve al mes en curso.
  useEffect(() => setSelectedKey(current.key), [current.key]);
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
      <AmountField
        value={draft}
        onChange={setDraft}
        onSave={saveGoal}
        onCancel={() => setEditing(false)}
        autoFocus={autoFocus}
        label="Meta de ahorro mensual"
      />
      <Button variant="ghost" size="icon" className="size-9" onClick={saveGoal} disabled={parseAmount(draft) <= 0} aria-label="Guardar meta">
        <Check />
      </Button>
      {hasGoal && (
        <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditing(false)} aria-label="Cancelar">
          <X />
        </Button>
      )}
    </span>
  );

  // ── El estado del mes en curso, en una frase ──
  const currentTone = toneOf(current, true, todayInPeriod);
  const pct = hasGoal ? Math.min(100, Math.round((current.saved / goal) * 100)) : 0;
  const nextMonthName = format(periodNameDate(shiftPeriod(thisPeriod, 1, startDay), startDay), "MMMM", { locale: es });
  const nextTotal = nextSweeps.reduce((s, x) => s + x.amount, 0);

  let note: { text: string; tone: Tone } = { text: "", tone: "wait" };
  if (nextTotal > 0) {
    note = { text: `ya barriste ${clp(nextTotal)} para ${nextMonthName} ✓`, tone: "met" };
  } else if (current.met) {
    note = { text: `cumplida ✓ · barrido el ${listDays(current.sweeps)}`, tone: "met" };
  } else if (current.saved > 0) {
    note = { text: `barrido el ${listDays(current.sweeps)} · faltan ${clp(goal - current.saved)}`, tone: "part" };
  } else if (currentTone === "wait") {
    note = { text: "todavía no barres nada este mes", tone: "wait" };
  } else {
    note = { text: "este mes no barriste nada", tone: "none" };
  }

  // ── El detalle del mes elegido: dos líneas fijas, sin saltos ──
  const detailTop = `${format(periodNameDate(selected.month, startDay), "MMMM", { locale: es })} · ${clp(selected.saved)}`;
  const detailBottom = (() => {
    const parts: string[] = [];
    if (selected.sweeps.length) parts.push(`barrido el ${listDays(selected.sweeps)}`);
    if (selected.rescued > 0) parts.push(`rescataste ${clp(selected.rescued)}`);
    if (!selected.met && selected.biggestHit) {
      parts.push(`el golpe: ${selected.biggestHit.label} ${clp(selected.biggestHit.amount)}`);
    }
    if (!parts.length) parts.push(selected.met ? "cumplida" : "sin movimientos a inversión");
    return parts.join(" · ");
  })();

  // ── Límites por categoría: las mismas filas que el Inicio, y acá se editan ──
  const limitRows = useMemo(
    () => limitUsage(transactions, limits, thisPeriod, periodEndOf(thisPeriod, startDay)),
    [transactions, limits, thisPeriod, startDay],
  );
  const limitsTotal = limitRows.reduce((s, r) => s + r.limit, 0);

  // Cómo voy: dónde cierro el mes si lo que queda se parece a los mismos
  // días de los últimos 3 meses. No extrapola un ritmo: un cargo fijo que ya
  // pasó (arriendo, suscripciones) no suma nada, y lo que suele caer a fin
  // de mes sí.
  const remainingTypical = useMemo(() => {
    const sums = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "Gasto" && !t.reimbursement_for_category) continue;
      if (isCardPayment(t)) continue;
      const d = new Date(t.date);
      const start = periodStartOf(d, startDay);
      const monthsAgo = periodIndex(thisPeriod) - periodIndex(start);
      if (monthsAgo < 1 || monthsAgo > 3 || dayOfPeriod(d, start) <= todayInPeriod) continue;
      const category = t.type === "Gasto" ? t.category_name : (t.reimbursement_for_category as string);
      const signed = t.type === "Gasto" ? Number(t.amount) : -Number(t.amount);
      sums.set(category, (sums.get(category) ?? 0) + signed);
    }
    return new Map([...sums].map(([category, sum]) => [category, Math.max(0, sum / 3)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, thisPeriod.getTime(), todayInPeriod, startDay]);

  const projectionOf = (row: (typeof limitRows)[number]) => {
    const rest = remainingTypical.get(row.category) ?? 0;
    if (row.state === "over" || rest <= 0) return null;
    return ((row.spent + rest) / row.limit) * 100;
  };

  const catOf = (name: string) => categories.find((c) => c.name === name);
  const emojiOf = (name: string) => catOf(name)?.icon || getCategoryIcon(name);
  const colorOf = (name: string) => catOf(name)?.color ?? null;

  // Categorías de gasto que todavía no tienen límite: las que se pueden agregar.
  const limited = new Set(limits.map((l) => l.category_name));
  const addable = categories
    .filter((c) => c.type === "Gasto" && c.is_active !== false && !limited.has(c.name) && !isCardPaymentCategory(c.name))
    .map((c) => ({ value: c.name, label: c.name, emoji: c.icon || getCategoryIcon(c.name) }));

  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addCat, setAddCat] = useState("");
  const [addDraft, setAddDraft] = useState("");

  const startEditLimit = (category: string, limit: number) => {
    setAdding(false);
    setEditingCat(category);
    setLimitDraft(String(limit));
  };
  const saveLimit = () => {
    const value = parseAmount(limitDraft);
    const existing = limits.find((l) => l.category_name === editingCat);
    if (!editingCat || value <= 0) return;
    upsertLimit.mutate({
      category_name: editingCat,
      monthly_limit: value,
      alert_at_percentage: existing?.alert_at_percentage ?? DEFAULT_ALERT_AT,
    });
    setEditingCat(null);
  };
  const removeLimit = (category: string) => {
    const existing = limits.find((l) => l.category_name === category);
    if (existing) deleteLimit.mutate(existing.id);
    setEditingCat(null);
  };
  const startAdd = () => {
    setEditingCat(null);
    setAdding(true);
    setAddCat("");
    setAddDraft("");
  };
  const saveAdd = () => {
    const value = parseAmount(addDraft);
    if (!addCat || value <= 0) return;
    upsertLimit.mutate({ category_name: addCat, monthly_limit: value, alert_at_percentage: DEFAULT_ALERT_AT });
    setAdding(false);
  };

  // En celular, los meses y los límites comparten la tarjeta. "Ver todos" de
  // los límites en el Inicio llega directo a la pestaña de límites.
  const location = useLocation();
  const [mobileTab, setMobileTab] = useState<"months" | "limits">(
    (location.state as { tab?: string } | null)?.tab === "limits" ? "limits" : "months"
  );

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
              Ahorrar <b className={cn(isPrivacyMode && "privacy-blur")}>{clp(goal)}</b> al mes
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
            <Skeleton className="meta-card h-[150px]" />
          </div>
        ) : !hasGoal ? (
          <section className="meta-card meta-setup">
            <h2>¿Cuánto quieres ahorrar al mes?</h2>
            <p>Un solo número. Cada mes verás si lo cumpliste con lo que de verdad moviste a inversión.</p>
            {goalInput(false)}
          </section>
        ) : (
          <div className="meta-grid" data-tab={mobileTab}>
            {/* El mes en curso */}
            <section className="meta-card meta-now" data-tone={currentTone}>
              <span className="meta-month">
                {period.isCalendar ? format(today, "MMMM yyyy", { locale: es }) : period.rangeLabel(thisPeriod)}
              </span>
              <div className={cn("meta-big", isPrivacyMode && "privacy-blur")}>
                $<NumberFlow
                  value={current.saved}
                  format={{ style: "decimal", maximumFractionDigits: 0 }}
                  locales="es-CL"
                />
              </div>
              <div className={cn("meta-of", isPrivacyMode && "privacy-blur")}>de {clp(goal)}</div>
              <div className="meta-track" aria-hidden>
                <i style={{ width: `${Math.max(pct, current.saved > 0 ? 1.5 : 0)}%` }} />
              </div>
              <p className={cn("meta-note", isPrivacyMode && "privacy-blur")} data-tone={note.tone}>
                {note.text}
              </p>
            </section>

            {/* Solo en celular: qué tarjeta se ve */}
            <div className="meta-tabs" role="tablist">
              <button className="meta-tab" role="tab" aria-selected={mobileTab === "months"} onClick={() => setMobileTab("months")}>
                {MONTHS} meses
              </button>
              <button className="meta-tab" role="tab" aria-selected={mobileTab === "limits"} onClick={() => setMobileTab("limits")}>
                Límites
                {limitRows.some((r) => r.state === "over") && <i className="meta-dot" aria-hidden />}
              </button>
            </div>

            {/* Los últimos doce meses */}
            <section className="meta-card meta-hist">
              <div className="meta-card-head">
                <span className="meta-label">Últimos {MONTHS} meses</span>
                <span className="meta-count">
                  <b>{metCount}</b> de {MONTHS} cumplidos
                </span>
              </div>
              <div className="meta-chart" role="listbox" aria-label="Ahorro por mes">
                <i
                  className="meta-goal-line"
                  style={{ bottom: `calc(var(--meta-mon) + (100% - var(--meta-mon)) * ${goalFrac})` }}
                  aria-hidden
                />
                {months.map((m, i) => {
                  const isCurrent = m.key === current.key;
                  const tone = toneOf(m, isCurrent, todayInPeriod);
                  const height = `${Math.min(100, (m.saved / scale) * 100)}%`;
                  return (
                    <button
                      key={m.key}
                      role="option"
                      aria-selected={m.key === selectedKey}
                      className="meta-col"
                      data-tone={tone}
                      onClick={() => setSelectedKey(m.key)}
                      style={{ "--i": i } as CSSProperties}
                    >
                      <span className="meta-bar">
                        <i style={{ height }} />
                      </span>
                      <span className="meta-mon"><span>{format(periodNameDate(m.month, startDay), "MMM", { locale: es }).replace(".", "")}</span></span>
                    </button>
                  );
                })}
              </div>
              <div className="meta-detail" data-tone={toneOf(selected, selected.key === current.key, todayInPeriod)}>
                <p className={cn("meta-detail-top", isPrivacyMode && "privacy-blur")}>{detailTop}</p>
                <p className={cn("meta-detail-sub", isPrivacyMode && "privacy-blur")}>{detailBottom}</p>
              </div>
            </section>

            {/* Límites por categoría: ver, tocar para editar, agregar abajo */}
            <section className="meta-card meta-limits">
              <div className="meta-card-head">
                <span className="meta-label">Límites</span>
                {limitRows.length > 0 && (
                  <span className={cn("meta-count", isPrivacyMode && "privacy-blur")}>
                    <b>{clp(limitsTotal)}</b> al mes
                  </span>
                )}
              </div>
              <div className="meta-lim-list" data-scrollable>
                {limitRows.length === 0 && !adding && (
                  <EmptyState className="col-span-full">Ponle un techo a una categoría y acá ves cómo vas</EmptyState>
                )}
                {limitRows.map((row, index) => {
                  const isEditing = editingCat === row.category;
                  const projection = projectionOf(row);
                  const willPass = projection !== null && projection > 100;
                  const color =
                    row.state === "over" ? "oklch(var(--destructive))" : row.state === "near" ? "var(--meta-amber)" : colorOf(row.category) || "var(--muted-foreground)";
                  return (
                    <div
                      key={row.category}
                      className="meta-lim"
                      data-state={row.state}
                      data-editing={isEditing || undefined}
                      role={isEditing ? undefined : "button"}
                      tabIndex={isEditing ? undefined : 0}
                      onClick={isEditing ? undefined : () => startEditLimit(row.category, row.limit)}
                      onKeyDown={isEditing ? undefined : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          startEditLimit(row.category, row.limit);
                        }
                      }}
                    >
                      <span className="meta-ico" style={tint(colorOf(row.category))}>{emojiOf(row.category)}</span>
                      <span className="n">{row.category}</span>
                      <span className="pct">
                        {/* Cómo voy: si a este ritmo me paso, adónde llego */}
                        {willPass && <small className="proj">→ {Math.round(projection as number)}%</small>}
                        {Math.round(row.usage)}%
                      </span>
                      <span className="meta-lim-track" title={projection !== null ? `A este ritmo cierras el mes en ${Math.round(projection)}%` : undefined}>
                        {/* Un 1% tiene que dejar marca: si no, la fila miente. */}
                        <i style={{ width: row.usage > 0 ? `max(3px, ${Math.min(row.usage, 100)}%)` : "0%", background: color, "--i": index } as CSSProperties} />
                        {/* La estela: desde donde vas hasta donde cierras a este ritmo */}
                        {projection !== null && projection > row.usage && (
                          <i
                            className="meta-ghost"
                            style={{
                              left: `${row.usage}%`,
                              width: `${Math.min(projection, 100) - Math.min(row.usage, 100)}%`,
                              background: willPass ? "var(--meta-amber)" : color,
                              "--i": index,
                            } as CSSProperties}
                          />
                        )}
                      </span>
                      {isEditing ? (
                        <span className="meta-lim-edit" onClick={(e) => e.stopPropagation()}>
                          <AmountField
                            value={limitDraft}
                            onChange={setLimitDraft}
                            onSave={saveLimit}
                            onCancel={() => setEditingCat(null)}
                            autoFocus
                            placeholder="100.000"
                            label={`Límite mensual de ${row.category}`}
                          />
                          <Button variant="ghost" size="icon" className="size-9" onClick={saveLimit} disabled={parseAmount(limitDraft) <= 0} aria-label="Guardar límite">
                            <Check />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditingCat(null)} aria-label="Cancelar">
                            <X />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeLimit(row.category)}
                            aria-label="Quitar límite"
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      ) : (
                        <span className={cn("of", isPrivacyMode && "privacy-blur")}>
                          <span>{clp(row.spent)} de {clp(row.limit)}</span>
                          {row.state === "over" ? (
                            <span className="extra">+{clp(row.spent - row.limit)}</span>
                          ) : (
                            <span>quedan {clp(row.limit - row.spent)}</span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
                {adding ? (
                  <div className="meta-lim-add">
                    <CategorySelect
                      value={addCat}
                      options={addable}
                      onChange={setAddCat}
                      placeholder="Categoría"
                      searchPlaceholder="Buscar categoría…"
                      className="meta-lim-select"
                    />
                    <AmountField
                      value={addDraft}
                      onChange={setAddDraft}
                      onSave={saveAdd}
                      onCancel={() => setAdding(false)}
                      placeholder="100.000"
                      label="Límite mensual"
                    />
                    <Button variant="ghost" size="icon" className="size-9" onClick={saveAdd} disabled={!addCat || parseAmount(addDraft) <= 0} aria-label="Guardar límite">
                      <Check />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9" onClick={() => setAdding(false)} aria-label="Cancelar">
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="self-start justify-self-start max-md:mx-3 max-md:mt-1" onClick={startAdd} disabled={addable.length === 0}>
                    <Plus /> Límite
                  </Button>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}
