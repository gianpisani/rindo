import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/currency";
import {
  groupByPerson,
  planFromSelection,
  type PersonDebts,
} from "@/lib/debtNetting";
import type { SharedExpenseWithTransaction } from "@/hooks/useSharedExpenses";
import { Check, ChevronDown, ArrowLeftRight } from "lucide-react";

interface DebtLinkPanelProps {
  /** Deudas pendientes candidatas. El panel no filtra por pagadas: pásalas ya filtradas. */
  rows: SharedExpenseWithTransaction[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  /** Monto de la transacción, para avisar si lo seleccionado no calza. */
  transactionAmount?: number;
  /** Acota el panel a una sola persona (modal de saldar de la página de Deudas). */
  personKeyFilter?: string;
  className?: string;
}

const netLabel = (person: PersonDebts) => {
  if (person.net > 0) return { text: `te debe ${fmt(person.net)}`, tone: "text-amber-500" };
  if (person.net < 0) return { text: `le debes ${fmt(-person.net)}`, tone: "text-destructive" };
  return { text: "se compensan enteras", tone: "text-success" };
};

/**
 * Selector de deudas agrupado por persona. Cubre las dos formas de conciliar:
 * saldar el neto de alguien en un click, o marcar deudas sueltas de cualquiera de
 * los dos lados. Ambas terminan en el mismo SettlementPlan, que calcula
 * planFromSelection sobre lo seleccionado.
 */
export function DebtLinkPanel({
  rows,
  selectedIds,
  onSelectionChange,
  transactionAmount = 0,
  personKeyFilter,
  className,
}: DebtLinkPanelProps) {
  const people = useMemo(() => {
    const grouped = groupByPerson(rows);
    return personKeyFilter ? grouped.filter((p) => p.key === personKeyFilter) : grouped;
  }, [rows, personKeyFilter]);

  // Las personas con deuda de los dos lados arrancan abiertas: son justamente el
  // caso donde hay algo que decidir.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isOpen = (person: PersonDebts) =>
    collapsed[person.key] === undefined ? person.hasBothSides || people.length === 1 : !collapsed[person.key];

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const plan = useMemo(() => planFromSelection(selectedRows), [selectedRows]);

  const toggleRow = (id: string) => {
    onSelectionChange(selected.has(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);
  };

  const toggleWholePerson = (person: PersonDebts) => {
    const personIds = [...person.owedToMe, ...person.iOwe].map((r) => r.id);
    const allSelected = personIds.every((id) => selected.has(id));
    onSelectionChange(
      allSelected
        ? selectedIds.filter((id) => !personIds.includes(id))
        : [...new Set([...selectedIds, ...personIds])]
    );
  };

  if (people.length === 0) return null;

  const difference = transactionAmount > 0 ? transactionAmount - plan.netAmount : 0;
  // Tolerancia de $1 por el redondeo de los montos divididos.
  const mismatch = transactionAmount > 0 && plan.netAmount > 0 && Math.abs(difference) > 1;

  const renderRow = (row: SharedExpenseWithTransaction, side: "owed" | "iowe") => {
    const isSelected = selected.has(row.id);
    const date = row.transaction_date || row.created_at;

    return (
      <div
        key={row.id}
        role="checkbox"
        aria-checked={isSelected}
        tabIndex={0}
        onClick={() => toggleRow(row.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleRow(row.id);
          }
        }}
        className={cn(
          "w-full flex items-center gap-3 rounded-lg border bg-background p-2.5 text-left transition-colors cursor-pointer select-none",
          isSelected
            ? side === "owed"
              ? "border-amber-500 bg-amber-500/5"
              : "border-destructive bg-destructive/5"
            : "border-border"
        )}
      >
        {/* Indicador visual, NO un Checkbox de Radix: un Checkbox controlado dentro
            de un <form> monta un input oculto que re-despacha un 'click'
            burbujeante cada vez que cambia `checked`. Ese click vuelve a este
            contenedor, re-dispara el toggle y entra en loop infinito
            ("Maximum update depth exceeded"). */}
        <span
          aria-hidden
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
            isSelected
              ? side === "owed"
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-destructive bg-destructive text-white"
              : "border-input"
          )}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">
            {row.transaction_detail || row.detail || "Sin detalle"}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
            {row.transaction_category && ` · ${row.transaction_category}`}
          </p>
        </div>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums shrink-0",
            side === "owed" ? "text-amber-500" : "text-destructive"
          )}
        >
          {side === "owed" ? fmt(row.amount_owed) : `-${fmt(row.amount_owed)}`}
        </span>
      </div>
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {people.map((person) => {
        const open = isOpen(person);
        const label = netLabel(person);
        const personIds = [...person.owedToMe, ...person.iOwe].map((r) => r.id);
        const allSelected = personIds.every((id) => selected.has(id));

        return (
          <div key={person.key} className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
            <button
              type="button"
              className="w-full flex items-center gap-2 text-left"
              onClick={() => setCollapsed((prev) => ({ ...prev, [person.key]: open }))}
            >
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", !open && "-rotate-90")}
              />
              <span className="text-sm font-semibold truncate flex-1">{person.displayName}</span>
              <span className={cn("text-xs font-medium tabular-nums shrink-0", label.tone)}>{label.text}</span>
            </button>

            {open && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={allSelected ? "secondary" : "outline"}
                  className="w-full h-8 rounded-full text-xs"
                  onClick={() => toggleWholePerson(person)}
                >
                  {allSelected
                    ? "Quitar selección"
                    : person.net === 0
                      ? `Compensar — ${fmt(person.offsetAmount)}`
                      : `Saldar el neto — ${fmt(Math.abs(person.net))}`}
                </Button>

                {person.owedToMe.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Te deben</p>
                    {person.owedToMe.map((row) => renderRow(row, "owed"))}
                  </div>
                )}

                {person.iOwe.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Le debes</p>
                    {person.iOwe.map((row) => renderRow(row, "iowe"))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {selectedIds.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-border/60 bg-background p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {selectedIds.length} deuda{selectedIds.length > 1 ? "s" : ""} seleccionada
              {selectedIds.length > 1 ? "s" : ""}
            </span>
            <span className="font-semibold tabular-nums">
              {plan.netDirection === "none"
                ? "no se mueve plata"
                : plan.netDirection === "in"
                  ? `entran ${fmt(plan.netAmount)}`
                  : `salen ${fmt(plan.netAmount)}`}
            </span>
          </div>

          {plan.offsetAmount > 0 && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
              Se compensan {fmt(plan.offsetAmount)} entre lo que te deben y lo que debes.
            </p>
          )}

          {mismatch && (
            <p className="text-amber-600">
              El monto de la transacción difiere en {fmt(Math.abs(difference))} de lo que se salda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
