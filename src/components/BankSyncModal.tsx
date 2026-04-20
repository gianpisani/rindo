import { useState, useCallback } from "react";

// ── RUT helpers ───────────────────────────────────────────────────────────────

function cleanRut(value: string): string {
  return value.replace(/[^0-9kK]/g, "");
}

function formatRut(raw: string): string {
  const clean = cleanRut(raw);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean;
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1).toUpperCase();
  return `${body}-${verifier}`;
}

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
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Lock,
  Smartphone,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  ArrowDownCircle,
  ArrowUpCircle,
  SkipForward,
  Plus,
  ChevronLeft,
} from "lucide-react";
import type { SyncStep, SyncResult, SyncMovementItem } from "@/contexts/BankSyncContext";
import { cn } from "@/lib/utils";

// ── Bank list with brand colors ──────────────────────────────────────────────

const BANKS = [
  { value: "bancosecurity", label: "Banco Security", color: "#7B2D8E", initials: "BS" },
  { value: "bchile", label: "Banco de Chile", color: "#0066CC" },
  { value: "bci", label: "BCI", color: "#4CAF50" },
  { value: "bestado", label: "BancoEstado", color: "#F57C00" },
  { value: "bice", label: "BICE", color: "#5B9BD5" },
  { value: "edwards", label: "Banco Edwards", color: "#00897B", initials: "BE" },
  { value: "falabella", label: "Banco Falabella", color: "#8CC63F" },
  { value: "itau", label: "Itaú", color: "#EC7000" },
  { value: "santander", label: "Santander", color: "#EC0000" },
  { value: "scotiabank", label: "Scotiabank", color: "#EC1C24" },
];

/** Renders bank logo or colored initials fallback */
function BankLogo({ bank, size = "sm" }: { bank: typeof BANKS[number]; size?: "sm" | "md" }) {
  const px = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  if (bank.initials) {
    return (
      <div
        className={cn(px, "rounded-lg flex items-center justify-center font-bold text-white shrink-0", textSize)}
        style={{ backgroundColor: bank.color }}
      >
        {bank.initials}
      </div>
    );
  }
  return (
    <img
      src={`/banks/${bank.value}.png`}
      alt={bank.label}
      className={cn(px, "rounded-lg object-contain shrink-0")}
    />
  );
}

// ── Status labels during polling ─────────────────────────────────────────────

const STATUS_MESSAGES: Record<string, string> = {
  queued: "En cola, iniciando conexión...",
  running: "Conectando con tu banco...",
  awaiting_2fa: "Esperando aprobación 2FA en tu app del banco...",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Props ────────────────────────────────────────────────────────────────────

interface BankSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncStep: SyncStep;
  pollStatus: string;
  result: SyncResult | null;
  onStart: (params: { bank: string; rut: string; password: string; fromDate?: string; toDate?: string }) => void;
  onImportSkipped: (movements: SyncMovementItem[]) => Promise<number>;
  onReset: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BankSyncModal({
  open,
  onOpenChange,
  syncStep,
  pollStatus,
  result,
  onStart,
  onImportSkipped,
  onReset,
}: BankSyncModalProps) {
  const [bank, setBank] = useState("");
  const [rut, setRut] = useState("");
  const [rutTouched, setRutTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [showPassword, setShowPassword] = useState(false);

  // Result step state
  const [selectedSkipped, setSelectedSkipped] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importedSkippedCount, setImportedSkippedCount] = useState(0);

  const rutValid = validateRut(rut);
  const showRutError = rutTouched && rut.length > 0 && !rutValid;

  const selectedBank = BANKS.find((b) => b.value === bank);

  const handleRutChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRutTouched(true);
    if (!bank || !rut || !password || !rutValid) return;
    const fromStr = fromDate ? fromDate.toISOString().split("T")[0] : undefined;
    const toStr = toDate ? toDate.toISOString().split("T")[0] : undefined;
    onStart({ bank, rut, password, fromDate: fromStr, toDate: toStr });
  }

  function handleRetry() {
    onReset();
    setPassword("");
    setSelectedSkipped(new Set());
    setImportedSkippedCount(0);
  }

  function toggleSkipped(index: number) {
    setSelectedSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAllSkipped(skippedItems: SyncMovementItem[]) {
    const creatableIndexes = skippedItems
      .map((item, i) => (item.reason !== "zero_amount" ? i : -1))
      .filter((i) => i !== -1);
    setSelectedSkipped((prev) => {
      const allSelected = creatableIndexes.every((i) => prev.has(i));
      if (allSelected) return new Set();
      return new Set(creatableIndexes);
    });
  }

  async function handleImportSelected() {
    if (!result || "error" in result) return;
    const movements = result.skippedItems.filter((_, i) => selectedSkipped.has(i));
    if (movements.length === 0) return;
    setIsImporting(true);
    const count = await onImportSkipped(movements);
    setImportedSkippedCount(count);
    setSelectedSkipped(new Set());
    setIsImporting(false);
  }

  const showForm = syncStep === "idle" || syncStep === "failed";
  const showPolling = syncStep === "submitting" || syncStep === "polling";
  const showResult = syncStep === "completed" || (syncStep === "failed" && result !== null);

  const activeStep: "form" | "polling" | "result" =
    showResult ? "result" : showPolling ? "polling" : "form";

  // Dynamic title/description based on selected bank
  const modalTitle = activeStep === "form" && selectedBank
    ? selectedBank.label
    : "Sincronizar Banco";
  const modalDescription = activeStep === "form" && selectedBank
    ? "Ingresa tus credenciales para sincronizar"
    : "Selecciona tu banco para comenzar";

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      description={modalDescription}
      maxWidth={activeStep === "result" && result && !("error" in result) ? "lg" : "md"}
    >
      {/* ── STEP 1: Form ──────────────────────────────────────────────────── */}
      {activeStep === "form" && !selectedBank && (
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {BANKS.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => setBank(b.value)}
              className={cn(
                "group relative flex items-center gap-3 p-3 rounded-xl",
                "border border-border/50 bg-card",
                "hover:border-primary/40 hover:bg-accent/50",
                "transition-all duration-200 cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              )}
            >
              <BankLogo bank={b} size="sm" />
              <span className="text-sm font-medium text-left">{b.label}</span>
            </button>
          ))}
        </div>
      )}

      {activeStep === "form" && selectedBank && (
        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* ── Dynamic bank header ──────────────────────────────────────── */}
          <div
            className="relative flex items-center gap-4 p-4 rounded-2xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${selectedBank.color}18 0%, ${selectedBank.color}08 100%)`,
            }}
          >
            {/* Subtle glow */}
            <div
              className="absolute -top-8 -left-8 w-24 h-24 rounded-full blur-2xl opacity-30"
              style={{ backgroundColor: selectedBank.color }}
            />
            <button
              type="button"
              onClick={() => setBank("")}
              className="relative z-10 flex items-center justify-center w-8 h-8 rounded-lg bg-background/80 backdrop-blur-sm hover:bg-background transition-colors shrink-0 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="relative z-10">
              <BankLogo bank={selectedBank} size="md" />
            </div>
            <div className="relative z-10 flex-1 min-w-0">
              <p className="font-semibold text-base">{selectedBank.label}</p>
              <p className="text-xs text-muted-foreground">Conexión segura</p>
            </div>
            {/* Brand color accent line */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, ${selectedBank.color}60, ${selectedBank.color}10)`,
              }}
            />
          </div>

          {/* ── Secure credentials zone ──────────────────────────────────── */}
          <div className="relative">
            {/* Gradient border wrapper */}
            <div
              className="absolute -inset-[1px] rounded-2xl opacity-40"
              style={{
                background: `linear-gradient(135deg, ${selectedBank.color}50, transparent 50%, ${selectedBank.color}20)`,
              }}
            />
            <div className="relative rounded-2xl bg-background/95 backdrop-blur-xl p-4 space-y-4">
              {/* Lock header */}
              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg"
                  style={{ backgroundColor: `${selectedBank.color}15` }}
                >
                  <Lock className="h-3.5 w-3.5" style={{ color: selectedBank.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium">Credenciales de acceso</p>
                  <p className="text-[11px] text-muted-foreground">Encriptadas y nunca almacenadas</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bank-rut" className="text-sm">RUT</Label>
                <Input
                  id="bank-rut"
                  placeholder="20799959-8"
                  value={rut}
                  onChange={handleRutChange}
                  onBlur={() => setRutTouched(true)}
                  required
                  autoComplete="username"
                  className={cn(
                    "rounded-xl h-10 bg-muted/30 border-border/40",
                    showRutError && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {showRutError && (
                  <p className="text-xs text-destructive">RUT inválido</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bank-password" className="text-sm">Clave de internet</Label>
                <div className="relative">
                  <Input
                    id="bank-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="rounded-xl pr-10 h-10 bg-muted/30 border-border/40"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent cursor-pointer"
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
            </div>
          </div>

          {/* ── Date range picker ─────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Rango de fechas{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <div className="flex items-center gap-2">
              <DateTimePicker
                value={fromDate}
                onChange={(d) => setFromDate(d)}
                showTime={false}
                placeholder="Desde"
                className="flex-1 rounded-xl h-10"
                maxDate={toDate || new Date()}
              />
              <span className="text-xs text-muted-foreground shrink-0">→</span>
              <DateTimePicker
                value={toDate}
                onChange={(d) => setToDate(d)}
                showTime={false}
                placeholder="Hasta"
                className="flex-1 rounded-xl h-10"
                minDate={fromDate}
                maxDate={new Date()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Si no se indica, se importan todos los movimientos disponibles.
            </p>
          </div>

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl h-10"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={syncStep === "submitting" || !rut || !rutValid || !password}
              className="flex-1 rounded-xl h-10"
              style={{
                backgroundColor: selectedBank.color,
                borderColor: selectedBank.color,
              }}
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
        <div className="space-y-4">
          {"error" in result ? (
            <div className="flex flex-col items-center py-8 space-y-5">
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
            </div>
          ) : (
            <>
              {/* Summary header */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">Sincronización completada</p>
                  <p className="text-sm text-muted-foreground">
                    {result.imported + result.skipped} movimiento{(result.imported + result.skipped) !== 1 ? "s" : ""} procesado{(result.imported + result.skipped) !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Stats pills */}
              <div className="flex gap-2">
                {result.imported > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {result.imported} importada{result.imported !== 1 ? "s" : ""}
                  </div>
                )}
                {result.skipped > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                    <SkipForward className="h-3.5 w-3.5" />
                    {result.skipped} omitida{result.skipped !== 1 ? "s" : ""}
                  </div>
                )}
                {importedSkippedCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium">
                    <Plus className="h-3.5 w-3.5" />
                    {importedSkippedCount} recuperada{importedSkippedCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>

              {/* Imported transactions list */}
              {result.importedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Importadas
                  </p>
                  <div className="rounded-xl border border-border/50 divide-y divide-border/30 max-h-[200px] overflow-y-auto">
                    {result.importedItems.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm"
                      >
                        <div className={cn(
                          "flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
                          item.type === "Ingreso" ? "bg-green-500/10" : "bg-red-500/10"
                        )}>
                          {item.type === "Ingreso" ? (
                            <ArrowDownCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowUpCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{formatMovDate(item.date)}</p>
                        </div>
                        <span className={cn(
                          "text-sm font-semibold tabular-nums shrink-0",
                          item.type === "Ingreso" ? "text-green-600 dark:text-green-400" : "text-foreground"
                        )}>
                          {item.type === "Ingreso" ? "+" : "-"}{formatAmount(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped transactions list with checkboxes */}
              {result.skippedItems.length > 0 && importedSkippedCount === 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Omitidas
                    </p>
                    {result.skippedItems.some((s) => s.reason !== "zero_amount") && (
                      <button
                        type="button"
                        onClick={() => toggleAllSkipped(result.skippedItems)}
                        className="text-xs text-primary hover:underline cursor-pointer"
                      >
                        {(() => {
                          const creatableIndexes = result.skippedItems
                            .map((s, i) => (s.reason !== "zero_amount" ? i : -1))
                            .filter((i) => i !== -1);
                          const allSelected = creatableIndexes.length > 0 && creatableIndexes.every((i) => selectedSkipped.has(i));
                          return allSelected ? "Deseleccionar todo" : "Seleccionar todo";
                        })()}
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/50 divide-y divide-border/30 max-h-[200px] overflow-y-auto">
                    {result.skippedItems.map((item, i) => {
                      const isZero = item.reason === "zero_amount";
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 text-sm",
                            isZero && "opacity-40"
                          )}
                        >
                          {!isZero ? (
                            <Checkbox
                              checked={selectedSkipped.has(i)}
                              onCheckedChange={() => toggleSkipped(i)}
                              className="shrink-0 cursor-pointer"
                            />
                          ) : (
                            <div className="w-4 shrink-0" />
                          )}
                          <div className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
                            item.type === "Ingreso" ? "bg-green-500/10" : "bg-red-500/10"
                          )}>
                            {item.type === "Ingreso" ? (
                              <ArrowDownCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowUpCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-sm">{item.description}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatMovDate(item.date)}</span>
                              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                                {SKIP_REASON_LABELS[item.reason ?? ""] ?? "Omitida"}
                              </span>
                            </div>
                          </div>
                          <span className={cn(
                            "text-sm font-semibold tabular-nums shrink-0",
                            item.type === "Ingreso" ? "text-green-600 dark:text-green-400" : "text-foreground"
                          )}>
                            {item.type === "Ingreso" ? "+" : "-"}{formatAmount(item.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {selectedSkipped.size > 0 && (
                    <Button
                      onClick={handleImportSelected}
                      disabled={isImporting}
                      className="w-full rounded-xl h-10"
                      variant="outline"
                    >
                      {isImporting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Importar {selectedSkipped.size} seleccionada{selectedSkipped.size !== 1 ? "s" : ""}
                    </Button>
                  )}
                </div>
              )}

              {/* No transactions at all */}
              {result.imported === 0 && result.skipped === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No se encontraron transacciones nuevas.
                </p>
              )}

              {/* Close button */}
              <Button
                onClick={() => { onReset(); onOpenChange(false); }}
                className="w-full rounded-xl h-10"
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
