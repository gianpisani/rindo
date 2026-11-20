import { CalendarClock, CheckCircle2, Plus, SkipForward, Trash2 } from "lucide-react";
import { scheduleTimePhrase, type SyncScheduleId } from "@/lib/banks";

interface SyncResultSummaryProps {
  imported: number;
  skipped: number;
  recoveredCount: number;
  deletedCount: number;
  autoSyncSchedule: SyncScheduleId | null;
}

export function SyncResultSummary({ imported, skipped, recoveredCount, deletedCount, autoSyncSchedule }: SyncResultSummaryProps) {
  const processed = imported + skipped;

  return (
    <>
      <div className="flex items-center gap-3 py-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-success/10">
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">Sincronización completada</p>
          <p className="text-sm text-muted-foreground">
            {processed} movimiento{processed !== 1 ? "s" : ""} procesado{processed !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {imported > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />{imported} importada{imported !== 1 ? "s" : ""}
          </div>
        )}
        {skipped > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
            <SkipForward className="h-3.5 w-3.5" />{skipped} omitida{skipped !== 1 ? "s" : ""}
          </div>
        )}
        {recoveredCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium">
            <Plus className="h-3.5 w-3.5" />{recoveredCount} recuperada{recoveredCount !== 1 ? "s" : ""}
          </div>
        )}
        {deletedCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
            <Trash2 className="h-3.5 w-3.5" />{deletedCount} eliminada{deletedCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {autoSyncSchedule && (
        <div className="flex items-start gap-2 p-3 rounded-card border">
          <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Auto-sync activado.</span>{" "}
            Tus movimientos se sincronizarán automáticamente a {scheduleTimePhrase(autoSyncSchedule)}.
            Puedes sincronizar manualmente cuando necesites desde aquí.
          </div>
        </div>
      )}
    </>
  );
}
