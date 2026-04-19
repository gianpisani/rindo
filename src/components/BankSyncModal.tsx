import { useState, useCallback } from "react";

// ── RUT helpers ───────────────────────────────────────────────────────────────

/** Strip everything except digits and 'k'/'K' */
function cleanRut(value: string): string {
  return value.replace(/[^0-9kK]/g, "");
}

/**
 * Format a raw RUT string as the user types.
 * Output: "20799959-8" (no dots, hyphen before verifier).
 */
function formatRut(raw: string): string {
  const clean = cleanRut(raw);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean;
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1).toUpperCase();
  return `${body}-${verifier}`;
}

/**
 * Validate a RUT using modulo 11.
 * Accepts formatted ("20799959-8") or clean ("207999598") strings.
 */
function validateRut(value: string): boolean {
  const clean = cleanRut(value);
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1).toUpperCase();

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const expected =
    remainder === 0 ? "0" : remainder === 1 ? "K" : String(11 - remainder);

  return verifier === expected;
}
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  Smartphone,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import type { SyncStep, SyncResult } from "@/contexts/BankSyncContext";

// ── Bank list ─────────────────────────────────────────────────────────────────

const BANKS = [
  { value: "bancosecurity", label: "Banco Security" },
  { value: "bchile", label: "Banco de Chile" },
  { value: "bci", label: "BCI" },
  { value: "bestado", label: "BancoEstado" },
  { value: "bice", label: "BICE" },
  { value: "edwards", label: "Banco Edwards" },
  { value: "falabella", label: "Banco Falabella" },
  { value: "itau", label: "Itaú" },
  { value: "santander", label: "Santander" },
  { value: "scotiabank", label: "Scotiabank" },
];

// ── Status labels during polling ──────────────────────────────────────────────

const STATUS_MESSAGES: Record<string, string> = {
  queued: "En cola, iniciando conexión...",
  running: "Conectando con tu banco...",
  awaiting_2fa: "Esperando aprobación 2FA en tu app del banco...",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface BankSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Sync state owned by the parent (survives modal close)
  syncStep: SyncStep;
  pollStatus: string;
  result: SyncResult | null;
  onStart: (params: { bank: string; rut: string; password: string; fromDate?: string }) => void;
  onReset: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BankSyncModal({
  open,
  onOpenChange,
  syncStep,
  pollStatus,
  result,
  onStart,
  onReset,
}: BankSyncModalProps) {
  // Form-only local state — these don't need to survive modal close
  const [bank, setBank] = useState("");
  const [rut, setRut] = useState("");
  const [rutTouched, setRutTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
  const [showPassword, setShowPassword] = useState(false);

  const rutValid = validateRut(rut);
  const showRutError = rutTouched && rut.length > 0 && !rutValid;

  const handleRutChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRutTouched(true);
    if (!bank || !rut || !password || !rutValid) return;
    onStart({ bank, rut, password, fromDate: fromDate || undefined });
  }

  function handleRetry() {
    onReset();
    setPassword("");
  }

  // Determine which step to show
  const showForm = syncStep === "idle" || syncStep === "failed";
  const showPolling = syncStep === "submitting" || syncStep === "polling";
  const showResult = syncStep === "completed" || (syncStep === "failed" && result !== null);

  // When reopening after completion/failure, show result if available
  const activeStep: "form" | "polling" | "result" =
    showResult ? "result" : showPolling ? "polling" : "form";

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title="Sincronizar Banco"
      description="Importa tus movimientos directamente desde tu banco"
      maxWidth="md"
    >
      {/* ── STEP 1: Form ──────────────────────────────────────────────────── */}
      {activeStep === "form" && (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <Shield className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm text-muted-foreground ml-2">
              <strong className="text-foreground">Privacidad:</strong> Tus credenciales
              se usan solo para obtener los movimientos y nunca son almacenadas.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Banco</Label>
            <Select value={bank} onValueChange={setBank} required>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Selecciona tu banco" />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-rut">RUT</Label>
            <Input
              id="bank-rut"
              placeholder="20799959-8"
              value={rut}
              onChange={handleRutChange}
              onBlur={() => setRutTouched(true)}
              required
              autoComplete="username"
              className={`rounded-xl ${showRutError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {showRutError && (
              <p className="text-xs text-destructive">RUT inválido</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-password">Clave de internet</Label>
            <div className="relative">
              <Input
                id="bank-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="rounded-xl pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-from-date">
              Importar desde{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="bank-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Si no se indica, se importan todos los movimientos disponibles.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={syncStep === "submitting" || !bank || !rut || !rutValid || !password}
              className="flex-1 rounded-xl"
            >
              {syncStep === "submitting" && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Sincronizar
            </Button>
          </div>
        </form>
      )}

      {/* ── STEP 2: Polling ────────────────────────────────────────────────── */}
      {activeStep === "polling" && (
        <div className="flex flex-col items-center justify-center py-10 space-y-6">
          {pollStatus === "awaiting_2fa" ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative flex items-center justify-center h-20 w-20">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
                <Smartphone className="relative z-10 h-12 w-12 text-blue-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold">Aprobación requerida</p>
                <p className="text-sm text-muted-foreground">
                  Abre tu app del banco y aprueba la solicitud de acceso
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Esperando aprobación...
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => onOpenChange(false)}
              >
                Minimizar — sigue corriendo en segundo plano
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative flex items-center justify-center h-20 w-20">
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse" />
                <RefreshCw className="relative z-10 h-12 w-12 text-primary animate-spin [animation-duration:2s]" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-semibold">Conectando con tu banco</p>
                <p className="text-sm text-muted-foreground">
                  {STATUS_MESSAGES[pollStatus] ?? "Procesando..."}
                </p>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Esto puede tardar hasta 90 segundos
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => onOpenChange(false)}
              >
                Minimizar — sigue corriendo en segundo plano
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Result ─────────────────────────────────────────────────── */}
      {activeStep === "result" && result && (
        <div className="flex flex-col items-center py-8 space-y-5">
          {"error" in result ? (
            <>
              <XCircle className="h-14 w-14 text-destructive" />
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold">Error en la sincronización</p>
                <p className="text-sm text-muted-foreground">{result.error}</p>
              </div>
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 rounded-xl"
                >
                  Cerrar
                </Button>
                <Button onClick={handleRetry} className="flex-1 rounded-xl">
                  Reintentar
                </Button>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold">¡Sincronización completada!</p>
                <p className="text-sm text-muted-foreground">
                  {result.imported === 0
                    ? "No se encontraron transacciones nuevas."
                    : `${result.imported} transacción${result.imported !== 1 ? "es" : ""} importada${result.imported !== 1 ? "s" : ""}`}
                  {result.skipped > 0 &&
                    `, ${result.skipped} omitida${result.skipped !== 1 ? "s" : ""} (duplicadas)`}
                </p>
              </div>
              <Button
                onClick={() => { onReset(); onOpenChange(false); }}
                className="w-full rounded-xl"
              >
                Listo
              </Button>
            </>
          )}
        </div>
      )}
    </BaseModal>
  );
}
