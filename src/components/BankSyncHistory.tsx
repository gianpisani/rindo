import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  SkipForward,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getBankById } from "@/lib/banks";
import { BankLogo } from "@/components/BankLogo";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ImportedItem {
  date: string;
  description: string;
  amount: number;
  type: string;
}

interface SkippedItem {
  date: string;
  description: string;
  amount: number;
  type: string;
  reason: string;
  card?: string;
}

interface SyncLogEntry {
  id: string;
  bank: string;
  trigger: "cron" | "manual";
  sync_date: string;
  imported: number;
  skipped: number;
  status: "success" | "failed" | "2fa_blocked" | "invalid_credentials";
  error: string | null;
  imported_items: ImportedItem[] | null;
  skipped_items: SkippedItem[] | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(amount);
}

function formatMovDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length <= 2) return `${parts[0]}/${parts[1]}`;
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}

const SKIP_REASON_LABELS: Record<string, string> = {
  bank_duplicate: "Ya importada",
  manual_duplicate: "Ingresada manualmente",
  zero_amount: "Monto $0",
};

// ── Expanded entry detail ─────────────────────────────────────────────────────

function EntryDetail({ entry }: { entry: SyncLogEntry }) {
  const [selectedSkipped, setSelectedSkipped] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const importedItems = entry.imported_items ?? [];
  const skippedItems = entry.skipped_items ?? [];
  const creatableIndexes = skippedItems
    .map((s, i) => (s.reason !== "zero_amount" ? i : -1))
    .filter((i) => i !== -1);

  function toggleSkipped(i: number) {
    setSelectedSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAll() {
    const allSelected = creatableIndexes.every((i) => selectedSkipped.has(i));
    setSelectedSkipped(allSelected ? new Set() : new Set(creatableIndexes));
  }

  async function handleImport() {
    if (!selectedSkipped.size) return;
    setIsImporting(true);
    const movements = skippedItems.filter((_, i) => selectedSkipped.has(i));
    const { data } = await supabase.functions.invoke("bank-sync", {
      body: { action: "import-skipped", movements },
    });
    if (data?.created) {
      setImportedCount((c) => c + data.created);
      setSelectedSkipped(new Set());
    }
    setIsImporting(false);
  }

  return (
    <div className="space-y-3 pt-1">
      {/* Imported list */}
      {importedItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Importadas ({importedItems.length})
          </p>
          <div className="rounded-xl border border-border/50 divide-y divide-border/30 max-h-[180px] overflow-y-auto">
            {importedItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                <div className={cn("flex items-center justify-center w-6 h-6 rounded-lg shrink-0",
                  item.type === "Ingreso" ? "bg-green-500/10" : "bg-red-500/10")}>
                  {item.type === "Ingreso"
                    ? <ArrowDownCircle className="h-3.5 w-3.5 text-green-500" />
                    : <ArrowUpCircle className="h-3.5 w-3.5 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium">{item.description}</p>
                  <p className="text-[10px] text-muted-foreground">{formatMovDate(item.date)}</p>
                </div>
                <span className={cn("text-xs font-semibold tabular-nums shrink-0",
                  item.type === "Ingreso" ? "text-green-600 dark:text-green-400" : "")}>
                  {item.type === "Ingreso" ? "+" : "-"}{formatAmount(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skipped list with import option */}
      {skippedItems.length > 0 && importedCount === 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Ignoradas ({skippedItems.length})
            </p>
            {creatableIndexes.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] text-primary hover:underline cursor-pointer"
              >
                {creatableIndexes.every((i) => selectedSkipped.has(i)) ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
            )}
          </div>
          <div className="rounded-xl border border-border/50 divide-y divide-border/30 max-h-[180px] overflow-y-auto">
            {skippedItems.map((item, i) => {
              const isZero = item.reason === "zero_amount";
              return (
                <div key={i} className={cn("flex items-center gap-2.5 px-3 py-2 text-sm", isZero && "opacity-40")}>
                  {!isZero ? (
                    <Checkbox
                      checked={selectedSkipped.has(i)}
                      onCheckedChange={() => toggleSkipped(i)}
                      className="shrink-0 cursor-pointer"
                    />
                  ) : <div className="w-4 shrink-0" />}
                  <div className={cn("flex items-center justify-center w-6 h-6 rounded-lg shrink-0",
                    item.type === "Ingreso" ? "bg-green-500/10" : "bg-red-500/10")}>
                    {item.type === "Ingreso"
                      ? <ArrowDownCircle className="h-3.5 w-3.5 text-green-500" />
                      : <ArrowUpCircle className="h-3.5 w-3.5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium">{item.description}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{formatMovDate(item.date)}</span>
                      <span className="px-1 py-0.5 rounded bg-muted text-[9px]">
                        {SKIP_REASON_LABELS[item.reason] ?? "Omitida"}
                      </span>
                    </div>
                  </div>
                  <span className={cn("text-xs font-semibold tabular-nums shrink-0",
                    item.type === "Ingreso" ? "text-green-600 dark:text-green-400" : "")}>
                    {item.type === "Ingreso" ? "+" : "-"}{formatAmount(item.amount)}
                  </span>
                </div>
              );
            })}
          </div>
          {selectedSkipped.size > 0 && (
            <Button
              onClick={handleImport}
              disabled={isImporting}
              size="sm"
              variant="outline"
              className="w-full rounded-xl h-8 text-xs"
            >
              {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Importar {selectedSkipped.size} seleccionada{selectedSkipped.size !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      )}

      {importedCount > 0 && (
        <p className="text-xs text-green-600 dark:text-green-400 text-center">
          {importedCount} transacción{importedCount !== 1 ? "es" : ""} importada{importedCount !== 1 ? "s" : ""} correctamente.
        </p>
      )}
    </div>
  );
}

// ── Log entry row ─────────────────────────────────────────────────────────────

function LogEntryRow({ entry }: { entry: SyncLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const bank = getBankById(entry.bank);

  const statusConfig = {
    success: { icon: CheckCircle2, color: "text-green-500" },
    failed: { icon: XCircle, color: "text-destructive" },
    "2fa_blocked": { icon: AlertTriangle, color: "text-amber-500" },
    invalid_credentials: { icon: XCircle, color: "text-destructive" },
  } as const;

  const cfg = statusConfig[entry.status];
  const Icon = cfg.icon;
  const hasDetail = (entry.imported_items?.length ?? 0) > 0 || (entry.skipped_items?.length ?? 0) > 0;

  const syncDate = new Date(entry.sync_date);
  const dateLabel = syncDate.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  const timeLabel = syncDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 p-3 text-left",
          hasDetail && "cursor-pointer hover:bg-accent/40 transition-colors",
        )}
      >
        {bank && <BankLogo bank={bank} size="sm" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{bank?.label ?? entry.bank}</p>
            {entry.trigger === "cron" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Auto</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{dateLabel} · {timeLabel}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {entry.status === "success" && (
            <div className="flex gap-1.5 text-xs">
              {entry.imported > 0 && (
                <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle2 className="h-3 w-3" />{entry.imported}
                </span>
              )}
              {entry.skipped > 0 && (
                <span className="flex items-center gap-0.5 text-muted-foreground">
                  <SkipForward className="h-3 w-3" />{entry.skipped}
                </span>
              )}
            </div>
          )}
          <Icon className={cn("h-4 w-4", cfg.color)} />
          {hasDetail && (expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />)}
        </div>
      </button>

      {expanded && hasDetail && (
        <div className="px-3 pb-3 border-t border-border/40">
          <EntryDetail entry={entry} />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BankSyncHistory() {
  const { data: entries, isLoading } = useQuery<SyncLogEntry[]>({
    queryKey: ["bank-sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_sync_log")
        .select("*")
        .order("sync_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
        <p className="text-sm text-muted-foreground">No hay sincronizaciones registradas aún.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <LogEntryRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
