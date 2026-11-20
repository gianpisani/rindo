import { useState, type MouseEvent as ReactMouseEvent } from "react";
import NumberFlow from "@number-flow/react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRightLeft,
  ChevronRight,
  Copy,
  GripVertical,
  LineChart,
  Minimize2,
  PiggyBank,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Transaction } from "@/hooks/useTransactions";
import { TRANSACTION_TYPES, displaySign, isCardPayment, type TransactionType } from "@/lib/ledger";
import { uniqueByName } from "@/lib/category-options";
import { QuickCategoryPicker } from "@/components/categories/QuickCategoryPicker";
import { useCategoryOptions } from "@/hooks/useCategoryOptions";
import { AMOUNT_TEXT_CLASS } from "@/lib/tx-display";
import { cn } from "@/lib/utils";
import { clp, SIGNED_CLP_FORMAT } from "@/lib/format";
import type { TableCategory } from "./useTransactionColumns";

const DEFAULT_PANEL_TOP = 160;

const typeIcons: Record<TransactionType, typeof TrendingUp> = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
  Rescate: ArrowDownToLine,
  Rendimiento: LineChart,
  Reembolso: ArrowLeftRight,
};

const signColor = (amount: number) => (amount > 0 ? "text-success" : "");

function selectionStats(rows: Transaction[]) {
  const amounts = rows.map(r => isCardPayment(r) ? 0 : displaySign(r.type) * r.amount);
  const sum = amounts.reduce((a, b) => a + b, 0);
  const income = amounts.reduce((a, v) => a + Math.max(0, v), 0);
  const expense = amounts.reduce((a, v) => a + Math.max(0, -v), 0);
  return {
    sum,
    avg: Math.round(sum / amounts.length),
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    income,
    expense,
    mixed: income > 0 && expense > 0,
  };
}

const ACTION_ROW = "w-full flex items-center gap-2 px-2 py-1.5 rounded-card text-sm transition-colors text-left";

interface SelectionPanelProps {
  selected: Transaction[];
  categories: TableCategory[];
  isPrivacyMode: boolean;
  onClearSelection: () => void;
  onUpdateMultiple: (ids: string[], updates: Partial<Pick<Transaction, "category_name" | "type">>) => void;
  onDuplicate: (ids: string[]) => void;
  onDeleteMultiple: (ids: string[]) => void;
}

export function SelectionPanel({
  selected,
  categories,
  isPrivacyMode,
  onClearSelection,
  onUpdateMultiple,
  onDuplicate,
  onDeleteMultiple,
}: SelectionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [panelY, setPanelY] = useState<number | null>(null);
  const categoryOptions = useCategoryOptions();
  const selectedIds = selected.map(t => t.id);
  const selectedTypes = [...new Set(selected.map(t => t.type))];
  const batchCategoryOptions = uniqueByName((selectedTypes.length === 1 ? selectedTypes : TRANSACTION_TYPES).flatMap(categoryOptions));
  const stats = selectionStats(selected);

  const runBatch = (action: () => void) => {
    action();
    onClearSelection();
  };

  const changeType = (type: TransactionType) => {
    const matchingCategory = categories.find(c => c.type === type);
    runBatch(() => onUpdateMultiple(selectedIds, { type, category_name: matchingCategory?.name || "Sin categoría" }));
  };

  const startDrag = (e: ReactMouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startTop = panelY ?? DEFAULT_PANEL_TOP;

    const handleMove = (ev: MouseEvent) => {
      setPanelY(Math.max(60, Math.min(window.innerHeight - 100, startTop + ev.clientY - startY)));
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div
      className={cn(
        "fixed right-4 z-50 transition-all duration-300 ease-out",
        "animate-in slide-in-from-right-5 fade-in-0",
        expanded ? "w-64" : "w-12"
      )}
      style={{ top: panelY ?? DEFAULT_PANEL_TOP }}
    >
      {!expanded && (
        <div
          className={cn(
            "flex flex-col items-center gap-1 py-2 px-1 rounded-card",
            "backdrop-blur-xl border",
            "shadow-float"
          )}
        >
          <div
            className="cursor-grab active:cursor-grabbing p-0.5 transition-colors"
            onMouseDown={startDrag}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>

          <button
            onClick={() => setExpanded(true)}
            className="size-9 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-medium transition-colors"
          >
            {selectedIds.length}
          </button>

          <button
            onClick={() => setExpanded(true)}
            className="size-9 grid place-items-center"
            aria-label="Expandir acciones"
          >
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          </button>
        </div>
      )}

      {expanded && (
        <div
          className={cn(
            "rounded-card overflow-hidden",
            "backdrop-blur-xl border",
            "shadow-float",
            "animate-in slide-in-from-right-3 fade-in-0 duration-200"
          )}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <div
              className="cursor-grab active:cursor-grabbing transition-colors"
              onMouseDown={startDrag}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            <Badge variant="secondary" className="font-medium text-xs h-5 px-1.5">
              {selectedIds.length}
            </Badge>
            <span className="text-xs text-muted-foreground">
              seleccionada{selectedIds.length > 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="size-9" aria-label="Minimizar" onClick={() => setExpanded(false)}>
              <Minimize2 />
            </Button>
          </div>

          <div className="p-2 space-y-0.5">
            <QuickCategoryPicker
              value=""
              options={batchCategoryOptions}
              title={`Cambiar categoría de ${selectedIds.length}`}
              onPick={(name) => runBatch(() => onUpdateMultiple(selectedIds, { category_name: name }))}
            >
              <button className={ACTION_ROW}>
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">Cambiar categoría</span>
              </button>
            </QuickCategoryPicker>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={ACTION_ROW}>
                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">Cambiar tipo</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="left">
                {TRANSACTION_TYPES.filter((type) => type !== "Reembolso").map((type) => {
                  const Icon = typeIcons[type];
                  return (
                    <DropdownMenuItem key={type} onClick={() => changeType(type)}>
                      <Icon className={cn("h-4 w-4 mr-2", AMOUNT_TEXT_CLASS[type])} /> {type}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <button onClick={() => runBatch(() => onDuplicate(selectedIds))} className={ACTION_ROW}>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">Duplicar</span>
            </button>

            <div className="my-1 border-t" />

            <button
              onClick={() => runBatch(() => onDeleteMultiple(selectedIds))}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-card text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-sm">Eliminar</span>
            </button>
          </div>

          <div className="px-3 py-2 border-t">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {([
                ["Suma", stats.sum, "font-medium"],
                ["Prom", stats.avg, "font-medium"],
                ["Min", stats.min, ""],
                ["Max", stats.max, ""],
              ] as const).map(([label, value, weight]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs">{label}</span>
                  <span className={cn("text-xs font-mono tabular-nums", weight, signColor(value), isPrivacyMode && "privacy-blur")}>
                    <NumberFlow value={value} locales="es-CL" format={SIGNED_CLP_FORMAT} />
                  </span>
                </div>
              ))}
            </div>
            {stats.mixed && (
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t">
                <span className={cn("text-xs font-mono tabular-nums text-success", isPrivacyMode && "privacy-blur")}>
                  +{clp(stats.income)}
                </span>
                <span className={cn("text-xs font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                  −{clp(stats.expense)}
                </span>
              </div>
            )}
          </div>

          <div className="px-2 py-1.5 border-t">
            <Button variant="ghost" size="xs" className="w-full text-muted-foreground" onClick={onClearSelection}>
              <X />
              Deseleccionar todo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
