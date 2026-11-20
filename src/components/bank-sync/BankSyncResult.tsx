import { Plus, Trash2, XCircle } from "lucide-react";
import type { SyncResult } from "@/lib/bank-sync";
import { SKIP_REASON_LABELS, type SyncScheduleId } from "@/lib/banks";
import { creatableIndexes, formatMovementDate, isCreatableSkip } from "@/lib/bank-sync";
import type { SyncResultSelection } from "@/hooks/useSyncResultSelection";
import { SyncResultSummary } from "@/components/bank-sync/SyncResultSummary";
import { SyncMovementSection } from "@/components/bank-sync/SyncMovementSection";
import { SyncMovementRow } from "@/components/bank-sync/SyncMovementRow";

interface BankSyncResultProps {
  result: SyncResult;
  selection: SyncResultSelection;
  autoSyncSchedule: SyncScheduleId | null;
}

export function BankSyncResult({ result, selection, autoSyncSchedule }: BankSyncResultProps) {
  if ("error" in result) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center py-8 space-y-4">
          <XCircle className="h-14 w-14 text-destructive" />
          <div className="text-center space-y-1">
            <p className="text-xl font-medium">Error en la sincronización</p>
            <p className="text-sm text-muted-foreground">{result.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const { importedItems, skippedItems } = result;
  const creatable = creatableIndexes(skippedItems);

  return (
    <div className="space-y-4">
      <SyncResultSummary
        imported={result.imported}
        skipped={result.skipped}
        recoveredCount={selection.importedSkippedCount}
        deletedCount={selection.deletedImportedCount}
        autoSyncSchedule={autoSyncSchedule}
      />

      {importedItems.length > 0 && selection.deletedImportedCount === 0 && (
        <SyncMovementSection
          title="Importadas"
          canSelectAll={importedItems.some((item) => item.id)}
          allSelected={importedItems.every((_, i) => selection.selectedImported.has(i))}
          onToggleAll={() => selection.toggleAllImported(importedItems)}
          selectedCount={selection.selectedImported.size}
          busy={selection.isDeleting}
          actionIcon={Trash2}
          actionVerb="Eliminar"
          onAction={selection.deleteSelected}
        >
          {importedItems.map((item, i) => (
            <SyncMovementRow
              key={i}
              item={item}
              selectable={Boolean(item.id)}
              selected={selection.selectedImported.has(i)}
              onToggle={() => selection.toggleImported(i)}
              meta={<p className="text-xs text-muted-foreground">{formatMovementDate(item.date)}</p>}
            />
          ))}
        </SyncMovementSection>
      )}

      {skippedItems.length > 0 && selection.importedSkippedCount === 0 && (
        <SyncMovementSection
          title="Omitidas"
          canSelectAll={skippedItems.some(isCreatableSkip)}
          allSelected={creatable.length > 0 && creatable.every((i) => selection.selectedSkipped.has(i))}
          onToggleAll={() => selection.toggleAllSkipped(skippedItems)}
          selectedCount={selection.selectedSkipped.size}
          busy={selection.isImporting}
          actionIcon={Plus}
          actionVerb="Importar"
          onAction={selection.importSelected}
        >
          {skippedItems.map((item, i) => (
            <SyncMovementRow
              key={i}
              item={item}
              selectable={isCreatableSkip(item)}
              selected={selection.selectedSkipped.has(i)}
              onToggle={() => selection.toggleSkipped(i)}
              dimmed={!isCreatableSkip(item)}
              meta={
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatMovementDate(item.date)}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-muted text-xs font-medium">{SKIP_REASON_LABELS[item.reason ?? ""] ?? "Omitida"}</span>
                </div>
              }
            />
          ))}
        </SyncMovementSection>
      )}

      {result.imported === 0 && result.skipped === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">No se encontraron transacciones nuevas.</p>
      )}
    </div>
  );
}
