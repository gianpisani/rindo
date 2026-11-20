import { useState } from "react";
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
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getBankById } from "@/lib/banks";
import { BankLogo } from "@/components/bank-sync/BankLogo";
import { useBankSyncContext } from "@/contexts/BankSyncContext";
import { useBankSyncLog, type SyncLogEntry } from "@/hooks/useBankSyncLog";
import { clp } from "@/lib/format";
import { SKIP_REASON_LABELS } from "@/lib/banks";

function formatMovDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length <= 2) return `${parts[0]}/${parts[1]}`;
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}


function EntryDetail({ entry }: { entry: SyncLogEntry }) {
  const { importSkipped, deleteImported } = useBankSyncContext();
  const [selectedSkipped, setSelectedSkipped] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [selectedImported, setSelectedImported] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);

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
    const created = await importSkipped(skippedItems.filter((_, i) => selectedSkipped.has(i)), entry.bank);
    if (created > 0) {
      setImportedCount((c) => c + created);
      setSelectedSkipped(new Set());
    }
    setIsImporting(false);
  }

  function toggleImported(i: number) {
    setSelectedImported((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAllImported() {
    const allIndexes = importedItems.map((_, i) => i);
    const allSelected = allIndexes.every((i) => selectedImported.has(i));
    setSelectedImported(allSelected ? new Set() : new Set(allIndexes));
  }

  async function handleDelete() {
    if (!selectedImported.size) return;
    setIsDeleting(true);
    const ids = importedItems
      .filter((item, i) => selectedImported.has(i) && item.id)
      .map((item) => item.id as string);
    if (ids.length === 0) { setIsDeleting(false); return; }
    const deleted = await deleteImported(ids);
    if (deleted > 0) {
      setDeletedCount((c) => c + deleted);
      setSelectedImported(new Set());
    }
    setIsDeleting(false);
  }

  return (
    <div className="space-y-3 pt-1">
      {importedItems.length > 0 && deletedCount === 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Importadas ({importedItems.length})
            </p>
            {importedItems.some((item) => item.id) && (
              <button
                type="button"
                onClick={toggleAllImported}
                className="text-xs text-foreground hover:underline cursor-pointer"
              >
                {importedItems.every((_, i) => selectedImported.has(i)) ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
            )}
          </div>
          <div className="rounded-card border divide-y max-h-[180px] overflow-y-auto">
            {importedItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                {item.id ? (
                  <Checkbox
                    checked={selectedImported.has(i)}
                    onCheckedChange={() => toggleImported(i)}
                    className="shrink-0 cursor-pointer"
                  />
                ) : <div className="w-4 shrink-0" />}
                <div className={cn("flex items-center justify-center w-6 h-6 rounded-full shrink-0",
                  item.type === "Ingreso" ? "bg-success/10" : "bg-muted")}>
                  {item.type === "Ingreso"
                    ? <ArrowDownCircle className="h-3.5 w-3.5 text-success" />
                    : <ArrowUpCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{formatMovDate(item.date)}</p>
                </div>
                <span className={cn("text-xs font-medium tabular-nums shrink-0",
                  item.type === "Ingreso" ? "text-success" : "")}>
                  {item.type === "Ingreso" ? "+" : "-"}{clp(item.amount)}
                </span>
              </div>
            ))}
          </div>
          {selectedImported.size > 0 && (
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              size="xs"
              variant="ghost"
              className="w-full"
            >
              {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Eliminar {selectedImported.size} seleccionada{selectedImported.size !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      )}
      {deletedCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {deletedCount} transacción{deletedCount !== 1 ? "es" : ""} eliminada{deletedCount !== 1 ? "s" : ""} correctamente.
        </p>
      )}

      {skippedItems.length > 0 && importedCount === 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Ignoradas ({skippedItems.length})
            </p>
            {creatableIndexes.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-foreground hover:underline cursor-pointer"
              >
                {creatableIndexes.every((i) => selectedSkipped.has(i)) ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
            )}
          </div>
          <div className="rounded-card border divide-y max-h-[180px] overflow-y-auto">
            {skippedItems.map((item, i) => {
              const isZero = item.reason === "zero_amount";
              return (
                <div key={i} className={cn("flex items-center gap-2 px-3 py-2 text-sm", isZero && "opacity-40")}>
                  {!isZero ? (
                    <Checkbox
                      checked={selectedSkipped.has(i)}
                      onCheckedChange={() => toggleSkipped(i)}
                      className="shrink-0 cursor-pointer"
                    />
                  ) : <div className="w-4 shrink-0" />}
                  <div className={cn("flex items-center justify-center w-6 h-6 rounded-full shrink-0",
                    item.type === "Ingreso" ? "bg-success/10" : "bg-muted")}>
                    {item.type === "Ingreso"
                      ? <ArrowDownCircle className="h-3.5 w-3.5 text-success" />
                      : <ArrowUpCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium">{item.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatMovDate(item.date)}</span>
                      <span className="px-1 py-0.5 rounded-full bg-muted text-xs">
                        {SKIP_REASON_LABELS[item.reason] ?? "Omitida"}
                      </span>
                    </div>
                  </div>
                  <span className={cn("text-xs font-medium tabular-nums shrink-0",
                    item.type === "Ingreso" ? "text-success" : "")}>
                    {item.type === "Ingreso" ? "+" : "-"}{clp(item.amount)}
                  </span>
                </div>
              );
            })}
          </div>
          {selectedSkipped.size > 0 && (
            <Button
              onClick={handleImport}
              disabled={isImporting}
              size="xs"
              variant="ghost"
              className="w-full"
            >
              {isImporting ? <Loader2 className="animate-spin" /> : <Plus />}
              Importar {selectedSkipped.size} seleccionada{selectedSkipped.size !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      )}

      {importedCount > 0 && (
        <p className="text-xs text-success text-center">
          {importedCount} transacción{importedCount !== 1 ? "es" : ""} importada{importedCount !== 1 ? "s" : ""} correctamente.
        </p>
      )}
    </div>
  );
}

function LogEntryRow({ entry }: { entry: SyncLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const bank = getBankById(entry.bank);

  const statusConfig = {
    success: { icon: CheckCircle2, color: "text-success" },
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
    <div className="rounded-card border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 p-3 text-left",
          hasDetail && "cursor-pointer transition-colors",
        )}
      >
        {bank && <BankLogo bank={bank} size="sm" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{bank?.label ?? entry.bank}</p>
            {entry.trigger === "cron" && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Auto</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{dateLabel} · {timeLabel}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {entry.status === "success" && (
            <div className="flex gap-1.5 text-xs">
              {entry.imported > 0 && (
                <span className="flex items-center gap-0.5 text-success font-medium">
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
        <div className="px-3 pb-3 border-t">
          <EntryDetail entry={entry} />
        </div>
      )}
    </div>
  );
}

export function BankSyncHistory() {
  const { data: entries, isLoading } = useBankSyncLog();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-card" />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <EmptyState>No hay sincronizaciones registradas aún</EmptyState>
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
