import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Settings2,
  Plus,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getBankById } from "@/lib/banks";
import { BankLogo } from "@/components/BankLogo";
import { BankSyncPreferencesDialog } from "@/components/BankSyncPreferencesDialog";
import {
  useBankSyncCredentials,
  useDeleteCredentials,
} from "@/hooks/useBankSyncCredentials";
import type { BankCredential } from "@/hooks/useBankSyncCredentials";
import { cn } from "@/lib/utils";

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
    success: { icon: CheckCircle2, label: "Exitosa", className: "text-success" },
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

function ActiveIndicator({ isActive, color }: { isActive: boolean; color: string }) {
  return (
    <span
      className="flex items-center gap-1.5 text-xs font-medium"
      style={{ color: isActive ? color : undefined }}
    >
      <span
        className={isActive ? "h-1.5 w-1.5 rounded-full" : "h-1.5 w-1.5 rounded-full"}
        style={{ backgroundColor: isActive ? color : undefined }}
      />
      <span className={isActive ? "" : "text-muted-foreground"}>
        {isActive ? "Auto-sync activo" : "Auto-sync pausado"}
      </span>
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
      className={cn("flex flex-col gap-3 p-4 rounded-card border bg-card transition-opacity", !cred.is_active && "opacity-70")}
    >
      {/* Top row: logo + name + settings gear */}
      <div className="flex items-center gap-3">
        <BankLogo bank={bank} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{bank.label}</p>
          <p className="text-xs text-muted-foreground">{cred.rut}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onOpenPreferences(cred)}
          className="size-9 shrink-0 text-muted-foreground"
          aria-label="Configurar auto-sync"
          title="Configurar auto-sync"
        >
          <Settings2 />
        </Button>
      </div>

      {/* Auto-sync activo/pausado */}
      <ActiveIndicator isActive={cred.is_active} color={bank.color} />

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
              size="xs"
              variant="destructive"
              onClick={() => { onDelete(cred.bank); setConfirmDelete(false); }}
            >
              Eliminar
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </Button>
          </div>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="size-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Quitar ${bank.label}`}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      {/* Error message */}
      {cred.last_error && (cred.last_sync_status === "failed" || cred.last_sync_status === "invalid_credentials") && (
        <p className="text-xs text-destructive/80 bg-destructive/5 rounded-card px-2 py-1.5">
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
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-28 rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Bancos configurados</p>
          <p className="text-xs text-muted-foreground">
            {credentials && credentials.length > 0
              ? `${credentials.filter((c) => c.is_active).length} activo${credentials.filter((c) => c.is_active).length !== 1 ? "s" : ""}`
              : "Ninguno aún"}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onAddBank}
        >
          <Plus />
          Agregar
        </Button>
      </div>

      {!credentials || credentials.length === 0 ? (
        <EmptyState>Al sincronizar, marca «Guardar para auto-sync» y tu banco aparece acá</EmptyState>
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
