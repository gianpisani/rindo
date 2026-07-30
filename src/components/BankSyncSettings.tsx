import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Loader2,
  Settings2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBankById } from "@/lib/banks";
import { BankLogo } from "@/components/BankLogo";
import { BankSyncPreferencesDialog } from "@/components/BankSyncPreferencesDialog";
import {
  useBankSyncCredentials,
  useDeleteCredentials,
} from "@/hooks/useBankSyncCredentials";
import type { BankCredential } from "@/hooks/useBankSyncCredentials";

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
    <span className={`flex items-center gap-1 text-xs font-medium ${cfg.className}`}>
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

function ActiveIndicator({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-medium ${
        isActive ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-muted-foreground/50"}`}
      />
      {isActive ? "Auto-sync activo" : "Auto-sync pausado"}
    </span>
  );
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
  onOpenPreferences,
}: {
  cred: BankCredential;
  onDelete: (bank: string) => void;
  onOpenPreferences: (cred: BankCredential) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bank = getBankById(cred.bank);

  if (!bank) return null;

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-xl border bg-card transition-opacity ${
        cred.is_active ? "border-border/50" : "border-border/50 opacity-70"
      }`}
    >
      {/* Top row: logo + name + settings gear */}
      <div className="flex items-center gap-3">
        <BankLogo bank={bank} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{bank.label}</p>
          <p className="text-xs text-muted-foreground">{cred.rut}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenPreferences(cred)}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          title="Configurar auto-sync"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </div>

      {/* Auto-sync activo/pausado */}
      <ActiveIndicator isActive={cred.is_active} />

      {/* Last sync status */}
      <div className="flex items-center justify-between">
        <StatusBadge status={cred.last_sync_status} />
        {cred.last_sync_at && (
          <span className="text-xs text-muted-foreground">{formatSyncDate(cred.last_sync_at)}</span>
        )}
      </div>

      {/* Delete */}
      <div className="flex items-center justify-end gap-2">
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
  const { data: credentials, isLoading } = useBankSyncCredentials();
  const deleteMutation = useDeleteCredentials();
  const [preferencesCred, setPreferencesCred] = useState<BankCredential | null>(null);

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
              onOpenPreferences={setPreferencesCred}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Las contraseñas se guardan encriptadas y nunca son visibles.
      </p>

      <BankSyncPreferencesDialog
        cred={preferencesCred ? credentials?.find((c) => c.bank === preferencesCred.bank) ?? null : null}
        onOpenChange={(open) => !open && setPreferencesCred(null)}
      />
    </div>
  );
}
