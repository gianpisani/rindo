import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import NumberFlow from "@number-flow/react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { CategorySelect } from "@/components/CategorySelect";
import { getCategoryIcon } from "@/components/TransactionsTable";
import { useTransactions } from "@/hooks/useTransactions";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useCategoryInsights } from "@/hooks/useCategoryInsights";
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
 * Al lado, los límites por categoría: el único lugar donde se ven y editan.
 * Nada derivado. Una pantalla exacta en web y celular.
 */

const MONTHS = 12;
/** Hasta este día del mes, un $0 todavía no es una alarma: el barrido puede venir. */
const GRACE_DAY = 5;
const DEFAULT_ALERT_AT = 80;

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

/** El ícono de una categoría sobre un tono de su color. */
const tint = (color?: string | null) => ({
  background: `color-mix(in oklch, ${color || "var(--muted-foreground)"} 22%, transparent)`,
});

type Tone = "met" | "part" | "none" | "wait";

const toneOf = (m: SavingsMonth, isCurrent: boolean, today: Date): Tone => {
  if (m.met) return "met";
  if (m.saved > 0) return "part";
  return isCurrent && today.getDate() <= GRACE_DAY ? "wait" : "none";
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
      <AmountField
        value={draft}
        onChange={setDraft}
        onSave={saveGoal}
        onCancel={() => setEditing(false)}
        autoFocus={autoFocus}
        label="Meta de ahorro mensual"
      />
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

  // ── Límites por categoría: las mismas filas que el Inicio, y acá se editan ──
  const { categorySpending } = useCategoryInsights(transactions, limits, today);
  const limitRows = useMemo(
    () =>
      categorySpending
        .filter((c) => c.limit && c.limit > 0)
        .map((c) => {
          const limit = c.limit as number;
          const usage = (c.effectiveAmount / limit) * 100;
          const state: "over" | "near" | "ok" =
            usage > 100 ? "over" : usage >= (c.alertPercentage || DEFAULT_ALERT_AT) ? "near" : "ok";
          return { category: c.category, spent: c.effectiveAmount, limit, usage, state };
        })
        .sort((a, b) => b.usage - a.usage),
    [categorySpending]
  );
  const limitsTotal = limitRows.reduce((s, r) => s + r.limit, 0);

  const catOf = (name: string) => categories.find((c) => c.name === name);
  const emojiOf = (name: string) => catOf(name)?.icon || getCategoryIcon(name);
  const colorOf = (name: string) => catOf(name)?.color ?? null;

  // Categorías de gasto que todavía no tienen límite: las que se pueden agregar.
  const limited = new Set(limits.map((l) => l.category_name));
  const addable = categories
    .filter((c) => c.type === "Gasto" && c.is_active !== false && !limited.has(c.name))
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

  // En celular, los meses y los límites comparten la tarjeta.
  const [mobileTab, setMobileTab] = useState<"months" | "limits">("months");

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
                      style={{ "--i": i } as CSSProperties}
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

            {/* Límites por categoría: ver, tocar para editar, agregar abajo */}
            <section className="meta-card meta-limits">
              <div className="meta-card-head">
                <span className="meta-label">Límites</span>
                {limitRows.length > 0 && (
                  <span className={cn("meta-count", isPrivacyMode && "privacy-blur")}>
                    <b>{formatCurrency(limitsTotal)}</b> al mes
                  </span>
                )}
              </div>
              <div className="meta-lim-list" data-scrollable>
                {limitRows.length === 0 && !adding && (
                  <p className="meta-lim-empty">Ponle un techo a una categoría y acá ves cómo vas.</p>
                )}
                {limitRows.map((row, index) => {
                  const isEditing = editingCat === row.category;
                  const color =
                    row.state === "over" ? "var(--meta-rose)" : row.state === "near" ? "var(--meta-amber)" : colorOf(row.category) || "var(--muted-foreground)";
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
                      <span className="pct">{Math.round(row.usage)}%</span>
                      <span className="meta-lim-track">
                        {/* Un 1% tiene que dejar marca: si no, la fila miente. */}
                        <i style={{ width: row.usage > 0 ? `max(3px, ${Math.min(row.usage, 100)}%)` : "0%", background: color, "--i": index } as CSSProperties} />
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
                          <button onClick={saveLimit} disabled={parseAmount(limitDraft) <= 0} aria-label="Guardar límite" className="meta-edit-btn">
                            <Check />
                          </button>
                          <button onClick={() => setEditingCat(null)} aria-label="Cancelar" className="meta-edit-btn">
                            <X />
                          </button>
                          <button onClick={() => removeLimit(row.category)} aria-label="Quitar límite" className="meta-edit-btn meta-edit-danger">
                            <Trash2 />
                          </button>
                        </span>
                      ) : (
                        <span className={cn("of", isPrivacyMode && "privacy-blur")}>
                          <span>{formatCurrency(row.spent)} de {formatCurrency(row.limit)}</span>
                          {row.state === "over" ? (
                            <span className="extra">+{formatCurrency(row.spent - row.limit)}</span>
                          ) : (
                            <span>quedan {formatCurrency(row.limit - row.spent)}</span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="meta-lim-foot">
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
                    <button onClick={saveAdd} disabled={!addCat || parseAmount(addDraft) <= 0} aria-label="Guardar límite" className="meta-edit-btn">
                      <Check />
                    </button>
                    <button onClick={() => setAdding(false)} aria-label="Cancelar" className="meta-edit-btn">
                      <X />
                    </button>
                  </div>
                ) : (
                  <button className="meta-lim-new" onClick={startAdd} disabled={addable.length === 0}>
                    <Plus /> Límite
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}
