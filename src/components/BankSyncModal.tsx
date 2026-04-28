import { useState, useCallback } from "react";

import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  History,
  Settings2,
  CalendarClock,
} from "lucide-react";
import type { SyncStep, SyncResult, SyncMovementItem } from "@/contexts/BankSyncContext";
import { cn } from "@/lib/utils";
import {
  BANKS,
  SYNC_SCHEDULES,
  formatRut,
  validateRut,
} from "@/lib/banks";
import { BankLogo } from "@/components/BankLogo";
import { useSaveCredentials, useBankSyncCredentials } from "@/hooks/useBankSyncCredentials";
import type { SyncScheduleId } from "@/lib/banks";
import { BankSyncSettings } from "@/components/BankSyncSettings";
import { BankSyncHistory } from "@/components/BankSyncHistory";

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

function getScheduleTimeLabel(id: string): string {
  const labels: Record<string, string> = {
    daily_08: "las 8:00",
    daily_14: "las 14:00",
    daily_20: "las 20:00",
    twice_daily: "las 8:00 y 20:00",
    disabled: null!,
  };
  return labels[id] ?? id;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface BankSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncStep: SyncStep;
  pollStatus: string;
  result: SyncResult | null;
  onStart: (params: { bank: string; rut: string; password: string; fromDate?: string; toDate?: string }) => void;
  onStartStored: (params: { bank: string; fromDate?: string; toDate?: string }) => void;
  onImportSkipped: (movements: SyncMovementItem[]) => Promise<number>;
  onReset: () => void;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type ModalTab = "sync" | "settings" | "history";

// ── Component ────────────────────────────────────────────────────────────────

export function BankSyncModal({
  open,
  onOpenChange,
  syncStep,
  pollStatus,
  result,
  onStart,
  onStartStored,
  onImportSkipped,
  onReset,
}: BankSyncModalProps) {
  const [tab, setTab] = useState<ModalTab>("sync");
  const [bank, setBank] = useState("");
  const [rut, setRut] = useState("");
  const [rutTouched, setRutTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [showPassword, setShowPassword] = useState(false);

  // Save credentials state
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [syncSchedule, setSyncSchedule] = useState<SyncScheduleId>("daily_20");
  const saveCredentialsMutation = useSaveCredentials();
  const { data: existingCredentials } = useBankSyncCredentials();
  const hasCredentialsForBank = existingCredentials?.some((c) => c.bank === bank);

  // Result step state
  const [selectedSkipped, setSelectedSkipped] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importedSkippedCount, setImportedSkippedCount] = useState(0);
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  const rutValid = validateRut(rut);
  const showRutError = rutTouched && rut.length > 0 && !rutValid;

  const selectedBank = BANKS.find((b) => b.value === bank);

  const handleRutChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value));
  }, []);

  const storedCred = existingCredentials?.find((c) => c.bank === bank);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fromStr = fromDate ? fromDate.toISOString().split("T")[0] : undefined;
    const toStr = toDate ? toDate.toISOString().split("T")[0] : undefined;

    if (storedCred) {
      onStartStored({ bank, fromDate: fromStr, toDate: toStr });
      return;
    }

    setRutTouched(true);
    if (!bank || !rut || !password || !rutValid) return;
    onStart({ bank, rut, password, fromDate: fromStr, toDate: toStr });
  }

  // After sync completes, optionally save credentials
  async function handleSyncComplete() {
    if (saveCredentials && bank && rut && password && !hasCredentialsForBank) {
      try {
        await saveCredentialsMutation.mutateAsync({ bank, rut, password, syncSchedule });
        setCredentialsSaved(true);
      } catch (err) {
        console.error("Error saving credentials:", err);
      }
    }
  }

  // Trigger credential save when sync transitions to completed
  const [saveTriggerred, setSaveTriggered] = useState(false);
  if (syncStep === "completed" && !saveTriggerred && saveCredentials && password) {
    setSaveTriggered(true);
    handleSyncComplete();
  }

  function handleRetry() {
    onReset();
    setPassword("");
    setSelectedSkipped(new Set());
    setImportedSkippedCount(0);
    setCredentialsSaved(false);
    setSaveTriggered(false);
  }

  function handleClose() {
    onReset();
    onOpenChange(false);
    setTab("sync");
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

  const isSyncing = activeStep !== "form";

  // Dynamic title/description
  const modalTitle = tab === "settings" ? "Auto-sync"
    : tab === "history" ? "Historial"
    : activeStep === "form" && selectedBank ? selectedBank.label
    : "Sincronizar Banco";

  const modalDescription = tab === "settings" ? "Gestiona tus bancos configurados"
    : tab === "history" ? "Sincronizaciones recientes"
    : activeStep === "form" && selectedBank && storedCred ? "Credenciales guardadas · Elige el rango a sincronizar"
    : activeStep === "form" && selectedBank ? "Ingresa tus credenciales para sincronizar"
    : "Selecciona tu banco para comenzar";

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      description={modalDescription}
      maxWidth={activeStep === "result" && result && !("error" in result) ? "lg" : "md"}
    >
      {/* ── Tab bar (only when not syncing) ─────────────────────────────── */}
      {!isSyncing && (
        <div className="flex gap-1 p-1 rounded-xl bg-muted/50 mb-4">
          {(
            [
              { id: "sync" as ModalTab, label: "Sincronizar" },
              { id: "settings" as ModalTab, label: "Auto-sync", icon: Settings2 },
              { id: "history" as ModalTab, label: "Historial", icon: History },
            ] as { id: ModalTab; label: string; icon?: React.ElementType }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); if (id === "sync") onReset(); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer",
                tab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Settings tab ────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <BankSyncSettings
          onAddBank={() => { setTab("sync"); onReset(); setBank(""); }}
        />
      )}

      {/* ── History tab ─────────────────────────────────────────────────── */}
      {tab === "history" && <BankSyncHistory />}

      {/* ── Sync tab ────────────────────────────────────────────────────── */}
      {tab === "sync" && (
        <>
          {/* ── STEP 1: Form ───────────────────────────────────────────── */}
          {activeStep === "form" && !selectedBank && (
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {BANKS.map((b) => {
                const isConfigured = existingCredentials?.some((c) => c.bank === b.value);
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBank(b.value)}
                    className={cn(
                      "group relative flex items-center gap-3 p-3 rounded-xl",
                      "border bg-card transition-all duration-200 cursor-pointer",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                      isConfigured
                        ? "border-primary/30 hover:border-primary/60 hover:bg-accent/50"
                        : "border-border/50 hover:border-primary/40 hover:bg-accent/50",
                    )}
                  >
                    <BankLogo bank={b} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <span className="text-sm font-medium">{b.label}</span>
                      {isConfigured && (
                        <p className="text-[10px] text-primary font-medium flex items-center gap-1 mt-0.5">
                          <CalendarClock className="h-2.5 w-2.5" /> Auto-sync activo
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeStep === "form" && selectedBank && (
            <form onSubmit={handleSubmit} className="space-y-5 pt-1">
              {/* ── Dynamic bank header ─────────────────────────────────── */}
              <div
                className="relative flex items-center gap-4 p-4 rounded-2xl overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${selectedBank.color}18 0%, ${selectedBank.color}08 100%)` }}
              >
                <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full blur-2xl opacity-30" style={{ backgroundColor: selectedBank.color }} />
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
                  <p className="text-xs text-muted-foreground">
                    {storedCred ? "Auto-sync configurado · Credenciales guardadas" : "Conexión segura · Encriptación de extremo a extremo"}
                  </p>
                </div>
                {storedCred && (
                  <div className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${selectedBank.color}60, ${selectedBank.color}10)` }} />
              </div>

              {/* ── Stored credentials notice ────────────────────────────── */}
              {storedCred && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Credenciales guardadas</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      RUT {storedCred.rut} · Contraseña encriptada. No es necesario ingresarlas de nuevo.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Credentials (only when no stored creds) ─────────────── */}
              {!storedCred && (
                <div className="relative">
                  <div className="absolute -inset-[1px] rounded-2xl opacity-40" style={{ background: `linear-gradient(135deg, ${selectedBank.color}50, transparent 50%, ${selectedBank.color}20)` }} />
                  <div className="relative rounded-2xl bg-background/95 backdrop-blur-xl p-4 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ backgroundColor: `${selectedBank.color}15` }}>
                        <Lock className="h-3.5 w-3.5" style={{ color: selectedBank.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Credenciales de acceso</p>
                        <p className="text-[11px] text-muted-foreground">Encriptadas de extremo a extremo</p>
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
                        className={cn("rounded-xl h-10 bg-muted/30 border-border/40", showRutError && "border-destructive focus-visible:ring-destructive")}
                      />
                      {showRutError && <p className="text-xs text-destructive">RUT inválido</p>}
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
                          {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Date range ──────────────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Rango de fechas{" "}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <DateTimePicker value={fromDate} onChange={(d) => setFromDate(d)} showTime={false} placeholder="Desde" className="flex-1 rounded-xl h-10" maxDate={toDate || new Date()} />
                  <span className="text-xs text-muted-foreground shrink-0">→</span>
                  <DateTimePicker value={toDate} onChange={(d) => setToDate(d)} showTime={false} placeholder="Hasta" className="flex-1 rounded-xl h-10" minDate={fromDate} maxDate={new Date()} />
                </div>
                <p className="text-xs text-muted-foreground">Si no se indica, se importan todos los movimientos disponibles.</p>
              </div>

              {/* ── Save credentials for auto-sync ──────────────────────── */}
              {!hasCredentialsForBank && (
                <div className={cn(
                  "rounded-xl border p-3 space-y-3 transition-colors",
                  saveCredentials ? "border-primary/30 bg-primary/5" : "border-border/50 bg-muted/20",
                )}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="save-creds"
                      checked={saveCredentials}
                      onCheckedChange={(v) => setSaveCredentials(Boolean(v))}
                      className="mt-0.5 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor="save-creds" className="text-sm font-medium cursor-pointer">
                        Guardar para auto-sync
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Contraseña encriptada. Sincronización automática diaria.
                      </p>
                    </div>
                    <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>

                  {saveCredentials && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Horario de sincronización</Label>
                      <Select value={syncSchedule} onValueChange={(v) => setSyncSchedule(v as SyncScheduleId)}>
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SYNC_SCHEDULES.filter((s) => s.value !== "disabled").map((s) => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* ── Actions ─────────────────────────────────────────────── */}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl h-10">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={syncStep === "submitting" || (!storedCred && (!rut || !rutValid || !password))}
                  className="flex-1 rounded-xl h-10"
                  style={{ backgroundColor: selectedBank.color, borderColor: selectedBank.color }}
                >
                  {syncStep === "submitting" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Sincronizar
                </Button>
              </div>
            </form>
          )}

          {/* ── STEP 2: Polling ─────────────────────────────────────────── */}
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
                    <p className="text-sm text-muted-foreground">Abre tu app del banco y aprueba la solicitud de acceso</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Esperando aprobación...
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => onOpenChange(false)}>
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
                    <p className="text-sm text-muted-foreground">{STATUS_MESSAGES[pollStatus] ?? "Procesando..."}</p>
                  </div>
                  <p className="text-xs text-muted-foreground/60">Esto puede tardar hasta 90 segundos</p>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => onOpenChange(false)}>
                    Minimizar — sigue corriendo en segundo plano
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Result ───────────────────────────────────────────── */}
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl">Cerrar</Button>
                    <Button onClick={handleRetry} className="flex-1 rounded-xl">Reintentar</Button>
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
                  <div className="flex gap-2 flex-wrap">
                    {result.imported > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />{result.imported} importada{result.imported !== 1 ? "s" : ""}
                      </div>
                    )}
                    {result.skipped > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                        <SkipForward className="h-3.5 w-3.5" />{result.skipped} omitida{result.skipped !== 1 ? "s" : ""}
                      </div>
                    )}
                    {importedSkippedCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium">
                        <Plus className="h-3.5 w-3.5" />{importedSkippedCount} recuperada{importedSkippedCount !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {/* Auto-sync confirmation message */}
                  {credentialsSaved && syncSchedule !== "disabled" && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <CalendarClock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground">Auto-sync activado.</span>{" "}
                        Tus movimientos se sincronizarán automáticamente a {getScheduleTimeLabel(syncSchedule)}.
                        Puedes sincronizar manualmente cuando necesites desde aquí.
                      </div>
                    </div>
                  )}

                  {/* Imported transactions list */}
                  {result.importedItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Importadas</p>
                      <div className="rounded-xl border border-border/50 divide-y divide-border/30 max-h-[200px] overflow-y-auto">
                        {result.importedItems.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                            <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg shrink-0", item.type === "Ingreso" ? "bg-green-500/10" : "bg-red-500/10")}>
                              {item.type === "Ingreso" ? <ArrowDownCircle className="h-4 w-4 text-green-500" /> : <ArrowUpCircle className="h-4 w-4 text-red-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-sm">{item.description}</p>
                              <p className="text-xs text-muted-foreground">{formatMovDate(item.date)}</p>
                            </div>
                            <span className={cn("text-sm font-semibold tabular-nums shrink-0", item.type === "Ingreso" ? "text-green-600 dark:text-green-400" : "text-foreground")}>
                              {item.type === "Ingreso" ? "+" : "-"}{formatAmount(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skipped transactions */}
                  {result.skippedItems.length > 0 && importedSkippedCount === 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Omitidas</p>
                        {result.skippedItems.some((s) => s.reason !== "zero_amount") && (
                          <button
                            type="button"
                            onClick={() => toggleAllSkipped(result.skippedItems)}
                            className="text-xs text-primary hover:underline cursor-pointer"
                          >
                            {(() => {
                              const creatableIndexes = result.skippedItems.map((s, i) => (s.reason !== "zero_amount" ? i : -1)).filter((i) => i !== -1);
                              return creatableIndexes.length > 0 && creatableIndexes.every((i) => selectedSkipped.has(i)) ? "Deseleccionar todo" : "Seleccionar todo";
                            })()}
                          </button>
                        )}
                      </div>
                      <div className="rounded-xl border border-border/50 divide-y divide-border/30 max-h-[200px] overflow-y-auto">
                        {result.skippedItems.map((item, i) => {
                          const isZero = item.reason === "zero_amount";
                          return (
                            <div key={i} className={cn("flex items-center gap-3 px-3 py-2.5 text-sm", isZero && "opacity-40")}>
                              {!isZero ? <Checkbox checked={selectedSkipped.has(i)} onCheckedChange={() => toggleSkipped(i)} className="shrink-0 cursor-pointer" /> : <div className="w-4 shrink-0" />}
                              <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg shrink-0", item.type === "Ingreso" ? "bg-green-500/10" : "bg-red-500/10")}>
                                {item.type === "Ingreso" ? <ArrowDownCircle className="h-4 w-4 text-green-500" /> : <ArrowUpCircle className="h-4 w-4 text-red-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium text-sm">{item.description}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatMovDate(item.date)}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{SKIP_REASON_LABELS[item.reason ?? ""] ?? "Omitida"}</span>
                                </div>
                              </div>
                              <span className={cn("text-sm font-semibold tabular-nums shrink-0", item.type === "Ingreso" ? "text-green-600 dark:text-green-400" : "text-foreground")}>
                                {item.type === "Ingreso" ? "+" : "-"}{formatAmount(item.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {selectedSkipped.size > 0 && (
                        <Button onClick={handleImportSelected} disabled={isImporting} className="w-full rounded-xl h-10" variant="outline">
                          {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                          Importar {selectedSkipped.size} seleccionada{selectedSkipped.size !== 1 ? "s" : ""}
                        </Button>
                      )}
                    </div>
                  )}

                  {result.imported === 0 && result.skipped === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">No se encontraron transacciones nuevas.</p>
                  )}

                  <Button onClick={handleClose} className="w-full rounded-xl h-10">Listo</Button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </BaseModal>
  );
}
