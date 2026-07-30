import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Settings2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SYNC_SCHEDULES, getBankById, isCustomSchedule, getCustomHour } from "@/lib/banks";
import { BankLogo } from "@/components/BankLogo";
import {
  useBankSyncCredentials,
  useDeleteCredentials,
  useUpdateSchedule,
} from "@/hooks/useBankSyncCredentials";
import type { BankCredential } from "@/hooks/useBankSyncCredentials";
import { supabase } from "@/integrations/supabase/client";
import type { SyncScheduleId } from "@/lib/banks";

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BankCredential["last_sync_status"] }) {
  if (!status) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> Sin sincronizar
      </span>
    );
  }

  const configs = {
    success: { icon: CheckCircle2, label: "Exitosa", className: "text-green-500" },
    failed: { icon: XCircle, label: "Error", className: "text-destructive" },
    "2fa_blocked": { icon: AlertTriangle, label: "2FA bloqueado", className: "text-amber-500" },
    invalid_credentials: { icon: XCircle, label: "Credenciales inválidas", className: "text-destructive" },
  } as const;

  const cfg = configs[status];
  const Icon = cfg.icon;

  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  failed: "No se pudo sincronizar con el banco. Intenta nuevamente más tarde.",
  invalid_credentials: "El RUT o la contraseña no son correctos. Actualiza tus credenciales.",
  "2fa_blocked": "El banco pidió verificación en dos pasos (2FA). La sincronización automática fue pausada.",
};

function getFriendlyError(status: BankCredential["last_sync_status"]): string {
  if (!status) return "Hubo un problema con la sincronización.";
  return FRIENDLY_ERROR_MESSAGES[status] ?? "Hubo un problema con la sincronización.";
}

function formatSyncDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Credential row ────────────────────────────────────────────────────────────

function CredentialRow({
  cred,
  onDelete,
  onToggle,
  onScheduleChange,
}: {
  cred: BankCredential;
  onDelete: (bank: string) => void;
  onToggle: (bank: string, active: boolean) => void;
  onScheduleChange: (bank: string, schedule: SyncScheduleId) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bank = getBankById(cred.bank);

  if (!bank) return null;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-card">
      {/* Top row: logo + name + status + toggle */}
      <div className="flex items-center gap-3">
        <BankLogo bank={bank} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{bank.label}</p>
          <p className="text-xs text-muted-foreground">{cred.rut}</p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(cred.bank, !cred.is_active)}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          title={cred.is_active ? "Pausar auto-sync" : "Activar auto-sync"}
        >
          {cred.is_active ? (
            <ToggleRight className="h-5 w-5 text-primary" />
          ) : (
            <ToggleLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Last sync status */}
      <div className="flex items-center justify-between">
        <StatusBadge status={cred.last_sync_status} />
        {cred.last_sync_at && (
          <span className="text-xs text-muted-foreground">{formatSyncDate(cred.last_sync_at)}</span>
        )}
      </div>

      {/* Schedule + delete */}
      <div className="flex items-center gap-2">
        <Select
          value={isCustomSchedule(cred.sync_schedule) ? "custom" : cred.sync_schedule}
          onValueChange={(v) => {
            if (v === "custom") {
              onScheduleChange(cred.bank, "custom_08" as SyncScheduleId);
            } else {
              onScheduleChange(cred.bank, v as SyncScheduleId);
            }
          }}
          disabled={!cred.is_active}
        >
          <SelectTrigger className="h-8 text-xs rounded-lg flex-1">
            <Settings2 className="h-3 w-3 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYNC_SCHEDULES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isCustomSchedule(cred.sync_schedule) && (
          <Select
            value={String(getCustomHour(cred.sync_schedule))}
            onValueChange={(h) => onScheduleChange(cred.bank, `custom_${h.padStart(2, "0")}` as SyncScheduleId)}
            disabled={!cred.is_active}
          >
            <SelectTrigger className="h-8 text-xs rounded-lg w-20 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)} className="text-xs">
                  {String(i).padStart(2, "0")}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {confirmDelete ? (
          <div className="flex gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs px-2.5 rounded-lg"
              onClick={() => { onDelete(cred.bank); setConfirmDelete(false); }}
            >
              Eliminar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs px-2.5 rounded-lg"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Error message */}
      {cred.last_error && (cred.last_sync_status === "failed" || cred.last_sync_status === "invalid_credentials") && (
        <p className="text-[11px] text-destructive/80 bg-destructive/5 rounded-lg px-2.5 py-1.5">
          {getFriendlyError(cred.last_sync_status)}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface BankSyncSettingsProps {
  onAddBank: () => void;
}

export function BankSyncSettings({ onAddBank }: BankSyncSettingsProps) {
  const qc = useQueryClient();
  const { data: credentials, isLoading } = useBankSyncCredentials();
  const deleteMutation = useDeleteCredentials();
  const scheduleMutation = useUpdateSchedule();

  async function handleToggle(bank: string, active: boolean) {
    await supabase
      .from("bank_sync_credentials")
      .update({
        is_active: active,
        updated_at: new Date().toISOString(),
        ...(active ? { consecutive_failures: 0, last_error: null } : {}),
      })
      .eq("bank", bank);
    // Invalidate query to refresh UI
    qc.invalidateQueries({ queryKey: ["bank-sync-credentials"] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Bancos configurados</p>
          <p className="text-xs text-muted-foreground">
            {credentials && credentials.length > 0
              ? `${credentials.filter((c) => c.is_active).length} activo${credentials.filter((c) => c.is_active).length !== 1 ? "s" : ""}`
              : "Ninguno aún"}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-8 text-xs gap-1.5"
          onClick={onAddBank}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>

      {!credentials || credentials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 rounded-xl border border-dashed border-border/50">
          <Settings2 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No hay bancos configurados para auto-sync.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Al sincronizar, marca "Guardar para auto-sync" para activar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.map((cred) => (
            <CredentialRow
              key={cred.bank}
              cred={cred}
              onDelete={(bank) => deleteMutation.mutate(bank)}
              onToggle={handleToggle}
              onScheduleChange={(bank, schedule) =>
                scheduleMutation.mutate({ bank, syncSchedule: schedule })
              }
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Las contraseñas se guardan encriptadas y nunca son visibles.
      </p>
    </div>
  );
}
