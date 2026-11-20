import { useState, useCallback } from "react";

import { BaseModal } from "@/components/shared/BaseModal";
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
  Trash2,
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
  isCustomSchedule,
  getCustomHour,
  scheduleTimePhrase,
} from "@/lib/banks";
import { BankLogo } from "@/components/bank-sync/BankLogo";
import { useSaveCredentials, useBankSyncCredentials } from "@/hooks/useBankSyncCredentials";
import type { SyncScheduleId } from "@/lib/banks";
import { BankSyncSettings } from "@/components/bank-sync/BankSyncSettings";
import { BankSyncHistory } from "@/components/bank-sync/BankSyncHistory";
import { clp } from "@/lib/format";
import { format } from "date-fns";
import { SKIP_REASON_LABELS } from "@/lib/banks";

const FORM_ID = "bank-sync-form";

const STATUS_MESSAGES: Record<string, string> = {
  queued: "En cola, iniciando conexión...",
  running: "Conectando con tu banco...",
  awaiting_2fa: "Esperando aprobación 2FA en tu app del banco...",
};

function formatMovDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length <= 2) return `${parts[0]}/${parts[1]}`;
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}


interface BankSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncStep: SyncStep;
  pollStatus: string;
  result: SyncResult | null;
  onStart: (params: { bank: string; rut: string; password: string; fromDate?: string; toDate?: string }) => void;
  onStartStored: (params: { bank: string; fromDate?: string; toDate?: string }) => void;
  onImportSkipped: (movements: SyncMovementItem[], bank?: string) => Promise<number>;
  onDeleteImported: (ids: string[]) => Promise<number>;
  onReset: () => void;
}

type ModalTab = "sync" | "settings" | "history";

export function BankSyncModal({
  open,
  onOpenChange,
  syncStep,
  pollStatus,
  result,
  onStart,
  onStartStored,
  onImportSkipped,
  onDeleteImported,
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

  const [saveCredentials, setSaveCredentials] = useState(false);
  const [syncSchedule, setSyncSchedule] = useState<SyncScheduleId>("daily_20");
  const saveCredentialsMutation = useSaveCredentials();
  const { data: existingCredentials } = useBankSyncCredentials();
  const hasCredentialsForBank = existingCredentials?.some((c) => c.bank === bank);

  const [selectedSkipped, setSelectedSkipped] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importedSkippedCount, setImportedSkippedCount] = useState(0);
  const [selectedImported, setSelectedImported] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedImportedCount, setDeletedImportedCount] = useState(0);
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
    const fromStr = fromDate ? format(fromDate, "yyyy-MM-dd") : undefined;
    const toStr = toDate ? format(toDate, "yyyy-MM-dd") : undefined;

    if (storedCred) {
      onStartStored({ bank, fromDate: fromStr, toDate: toStr });
      return;
    }

    setRutTouched(true);
    if (!bank || !rut || !password || !rutValid) return;
    onStart({ bank, rut, password, fromDate: fromStr, toDate: toStr });
  }

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
    setSelectedImported(new Set());
    setDeletedImportedCount(0);
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
    const count = await onImportSkipped(movements, bank);
    setImportedSkippedCount(count);
    setSelectedSkipped(new Set());
    setIsImporting(false);
  }

  function toggleImported(index: number) {
    setSelectedImported((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAllImported(importedItems: SyncMovementItem[]) {
    const allIndexes = importedItems.map((_, i) => i);
    setSelectedImported((prev) => {
      const allSelected = allIndexes.every((i) => prev.has(i));
      if (allSelected) return new Set();
      return new Set(allIndexes);
    });
  }

  async function handleDeleteSelected() {
    if (!result || "error" in result) return;
    const ids = result.importedItems
      .filter((item, i) => selectedImported.has(i) && item.id)
      .map((item) => item.id as string);
    if (ids.length === 0) return;
    setIsDeleting(true);
    const count = await onDeleteImported(ids);
    setDeletedImportedCount(count);
    setSelectedImported(new Set());
    setIsDeleting(false);
  }

  const showPolling = syncStep === "submitting" || syncStep === "polling";
  const showResult = syncStep === "completed" || (syncStep === "failed" && result !== null);

  const activeStep: "form" | "polling" | "result" =
    showResult ? "result" : showPolling ? "polling" : "form";

  const isSyncing = activeStep !== "form";

  const modalTitle = tab === "settings" ? "Auto-sync"
    : tab === "history" ? "Historial"
    : activeStep === "form" && selectedBank ? selectedBank.label
    : "Sincronizar Banco";

  const modalDescription = tab === "settings" ? "Gestiona tus bancos configurados"
    : tab === "history" ? "Sincronizaciones recientes"
    : activeStep === "form" && selectedBank && storedCred ? "Credenciales guardadas · Elige el rango a sincronizar"
    : activeStep === "form" && selectedBank ? "Ingresa tus credenciales para sincronizar"
    : "Selecciona tu banco para comenzar";

  const modalFooter = tab !== "sync" ? undefined
    : activeStep === "form" && selectedBank ? (
      <div className="flex gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          disabled={syncStep === "submitting" || (!storedCred && (!rut || !rutValid || !password))}
          className="flex-1"
          style={{ backgroundColor: selectedBank.color, borderColor: selectedBank.color }}
        >
          {syncStep === "submitting" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Sincronizar
        </Button>
      </div>
    )
    : activeStep === "polling" ? (
      <Button
        variant="ghost"
        onClick={() => onOpenChange(false)}
        className="w-full text-xs font-normal text-muted-foreground"
      >
        Minimizar — sigue corriendo en segundo plano
      </Button>
    )
    : activeStep === "result" && result && "error" in result ? (
      <div className="flex gap-3">
        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className="flex-1"
        >
          Cerrar
        </Button>
        <Button onClick={handleRetry} className="flex-1">
          Reintentar
        </Button>
      </div>
    )
    : activeStep === "result" && result ? (
      <Button onClick={handleClose} className="w-full">Listo</Button>
    )
    : undefined;

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      description={modalDescription}
      maxWidth={activeStep === "result" && result && !("error" in result) ? "lg" : "md"}
      footer={modalFooter}
    >
      {!isSyncing && (
        <div className="flex gap-1 p-1 rounded-full mb-4">
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
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer",
                tab === id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "settings" && (
        <BankSyncSettings
          onAddBank={() => { setTab("sync"); onReset(); setBank(""); }}
        />
      )}

      {tab === "history" && <BankSyncHistory />}

      {tab === "sync" && (
        <>
          {activeStep === "form" && !selectedBank && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {BANKS.map((b) => {
                const isConfigured = existingCredentials?.some((c) => c.bank === b.value);
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBank(b.value)}
                    className={cn(
                      "group relative flex items-center gap-3 p-3 rounded-card",
                      "border bg-card transition-all duration-200 cursor-pointer",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                    )}
                  >
                    <BankLogo bank={b} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <span className="text-sm font-medium">{b.label}</span>
                      {isConfigured && (
                        <p className="text-xs text-success font-medium flex items-center gap-1 mt-0.5">
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
            <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div
                className="relative flex items-center gap-4 p-4 rounded-card overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${selectedBank.color}18 0%, ${selectedBank.color}08 100%)` }}
              >
                <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full blur-2xl opacity-30" style={{ backgroundColor: selectedBank.color }} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setBank("")}
                  className="relative z-10 size-9 shrink-0 backdrop-blur-sm hover:bg-background"
                  aria-label="Elegir otro banco"
                >
                  <ChevronLeft className="text-muted-foreground" />
                </Button>
                <div className="relative z-10">
                  <BankLogo bank={selectedBank} size="md" />
                </div>
                <div className="relative z-10 flex-1 min-w-0">
                  <p className="font-medium text-sm">{selectedBank.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {storedCred ? "Auto-sync configurado · Credenciales guardadas" : "Conexión segura · Encriptación de extremo a extremo"}
                  </p>
                </div>
                {storedCred && (
                  <div className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-foreground" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${selectedBank.color}60, ${selectedBank.color}10)` }} />
              </div>

              {storedCred && (
                <div className="flex items-start gap-3 p-3 rounded-card border">
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Credenciales guardadas</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      RUT {storedCred.rut} · Contraseña encriptada. No es necesario ingresarlas de nuevo.
                    </p>
                  </div>
                </div>
              )}

              {!storedCred && (
                <div className="relative">
                  <div className="absolute -inset-[1px] rounded-card opacity-40" style={{ background: `linear-gradient(135deg, ${selectedBank.color}50, transparent 50%, ${selectedBank.color}20)` }} />
                  <div className="relative rounded-card backdrop-blur-xl p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full" style={{ backgroundColor: `${selectedBank.color}15` }}>
                        <Lock className="h-3.5 w-3.5" style={{ color: selectedBank.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Credenciales de acceso</p>
                        <p className="text-xs text-muted-foreground">Encriptadas de extremo a extremo</p>
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
                        className={cn("rounded-card h-10 bg-transparent border-border", showRutError && "border-destructive focus-visible:ring-destructive")}
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
                          className="rounded-card pr-10 h-10 bg-transparent border-border"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent cursor-pointer"
                          onClick={() => setShowPassword((v) => !v)}
                          tabIndex={-1}
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Rango de fechas{" "}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <DateTimePicker value={fromDate} onChange={(d) => setFromDate(d)} showTime={false} placeholder="Desde" className="flex-1 rounded-card h-10" maxDate={toDate || new Date()} />
                  <span className="text-xs text-muted-foreground shrink-0">→</span>
                  <DateTimePicker value={toDate} onChange={(d) => setToDate(d)} showTime={false} placeholder="Hasta" className="flex-1 rounded-card h-10" minDate={fromDate} maxDate={new Date()} />
                </div>
                <p className="text-xs text-muted-foreground">Si no se indica, se importan todos los movimientos disponibles.</p>
              </div>

              {!hasCredentialsForBank && (
                <div className="rounded-card border p-3 space-y-3 transition-colors">
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
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Contraseña encriptada. Sincronización automática diaria.
                      </p>
                    </div>
                    <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>

                  {saveCredentials && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Horario de sincronización</Label>
                      <div className="flex gap-2">
                        <Select
                          value={isCustomSchedule(syncSchedule) ? "custom" : syncSchedule}
                          onValueChange={(v) => {
                            if (v === "custom") {
                              setSyncSchedule("custom_08" as SyncScheduleId);
                            } else {
                              setSyncSchedule(v as SyncScheduleId);
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs rounded-card flex-1">
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
                        {isCustomSchedule(syncSchedule) && (
                          <Select
                            value={String(getCustomHour(syncSchedule))}
                            onValueChange={(h) => setSyncSchedule(`custom_${h.padStart(2, "0")}` as SyncScheduleId)}
                          >
                            <SelectTrigger className="h-8 text-xs rounded-card w-20 shrink-0">
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
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          {activeStep === "polling" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              {pollStatus === "awaiting_2fa" ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative flex items-center justify-center h-20 w-20">
                    <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
                    <Smartphone className="relative z-10 h-12 w-12 text-blue-500" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xl font-medium">Aprobación requerida</p>
                    <p className="text-sm text-muted-foreground">Abre tu app del banco y aprueba la solicitud de acceso</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Esperando aprobación...
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative flex items-center justify-center h-20 w-20">
                    <RefreshCw className="relative z-10 h-12 w-12 text-muted-foreground animate-spin [animation-duration:2s]" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium">Conectando con tu banco</p>
                    <p className="text-sm text-muted-foreground">{STATUS_MESSAGES[pollStatus] ?? "Procesando..."}</p>
                  </div>
                  <p className="text-xs">Esto puede tardar hasta 90 segundos</p>
                </div>
              )}
            </div>
          )}

          {activeStep === "result" && result && (
            <div className="space-y-4">
              {"error" in result ? (
                <div className="flex flex-col items-center py-8 space-y-4">
                  <XCircle className="h-14 w-14 text-destructive" />
                  <div className="text-center space-y-1">
                    <p className="text-xl font-medium">Error en la sincronización</p>
                    <p className="text-sm text-muted-foreground">{result.error}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-success/10">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Sincronización completada</p>
                      <p className="text-sm text-muted-foreground">
                        {result.imported + result.skipped} movimiento{(result.imported + result.skipped) !== 1 ? "s" : ""} procesado{(result.imported + result.skipped) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {result.imported > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm font-medium">
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
                    {deletedImportedCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                        <Trash2 className="h-3.5 w-3.5" />{deletedImportedCount} eliminada{deletedImportedCount !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {credentialsSaved && syncSchedule !== "disabled" && (
                    <div className="flex items-start gap-2 p-3 rounded-card border">
                      <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground">Auto-sync activado.</span>{" "}
                        Tus movimientos se sincronizarán automáticamente a {scheduleTimePhrase(syncSchedule)}.
                        Puedes sincronizar manualmente cuando necesites desde aquí.
                      </div>
                    </div>
                  )}

                  {result.importedItems.length > 0 && deletedImportedCount === 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Importadas</p>
                        {result.importedItems.some((item) => item.id) && (
                          <button
                            type="button"
                            onClick={() => toggleAllImported(result.importedItems)}
                            className="text-xs text-foreground hover:underline cursor-pointer"
                          >
                            {result.importedItems.every((_, i) => selectedImported.has(i)) ? "Deseleccionar todo" : "Seleccionar todo"}
                          </button>
                        )}
                      </div>
                      <div className="rounded-card border divide-y max-h-[200px] overflow-y-auto">
                        {result.importedItems.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                            {item.id ? (
                              <Checkbox checked={selectedImported.has(i)} onCheckedChange={() => toggleImported(i)} className="shrink-0 cursor-pointer" />
                            ) : (
                              <div className="w-4 shrink-0" />
                            )}
                            <div className={cn("flex items-center justify-center w-7 h-7 rounded-full shrink-0", item.type === "Ingreso" ? "bg-success/10" : "bg-muted")}>
                              {item.type === "Ingreso" ? <ArrowDownCircle className="h-4 w-4 text-success" /> : <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-sm">{item.description}</p>
                              <p className="text-xs text-muted-foreground">{formatMovDate(item.date)}</p>
                            </div>
                            <span className={cn("text-sm font-medium tabular-nums shrink-0", item.type === "Ingreso" ? "text-success" : "text-foreground")}>
                              {item.type === "Ingreso" ? "+" : "-"}{clp(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {selectedImported.size > 0 && (
                        <Button onClick={handleDeleteSelected} disabled={isDeleting} className="w-full" variant="ghost">
                          {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                          Eliminar {selectedImported.size} seleccionada{selectedImported.size !== 1 ? "s" : ""}
                        </Button>
                      )}
                    </div>
                  )}

                  {result.skippedItems.length > 0 && importedSkippedCount === 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Omitidas</p>
                        {result.skippedItems.some((s) => s.reason !== "zero_amount") && (
                          <button
                            type="button"
                            onClick={() => toggleAllSkipped(result.skippedItems)}
                            className="text-xs text-foreground hover:underline cursor-pointer"
                          >
                            {(() => {
                              const creatableIndexes = result.skippedItems.map((s, i) => (s.reason !== "zero_amount" ? i : -1)).filter((i) => i !== -1);
                              return creatableIndexes.length > 0 && creatableIndexes.every((i) => selectedSkipped.has(i)) ? "Deseleccionar todo" : "Seleccionar todo";
                            })()}
                          </button>
                        )}
                      </div>
                      <div className="rounded-card border divide-y max-h-[200px] overflow-y-auto">
                        {result.skippedItems.map((item, i) => {
                          const isZero = item.reason === "zero_amount";
                          return (
                            <div key={i} className={cn("flex items-center gap-3 px-3 py-2 text-sm", isZero && "opacity-40")}>
                              {!isZero ? <Checkbox checked={selectedSkipped.has(i)} onCheckedChange={() => toggleSkipped(i)} className="shrink-0 cursor-pointer" /> : <div className="w-4 shrink-0" />}
                              <div className={cn("flex items-center justify-center w-7 h-7 rounded-full shrink-0", item.type === "Ingreso" ? "bg-success/10" : "bg-muted")}>
                                {item.type === "Ingreso" ? <ArrowDownCircle className="h-4 w-4 text-success" /> : <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium text-sm">{item.description}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatMovDate(item.date)}</span>
                                  <span className="px-1.5 py-0.5 rounded-full bg-muted text-xs font-medium">{SKIP_REASON_LABELS[item.reason ?? ""] ?? "Omitida"}</span>
                                </div>
                              </div>
                              <span className={cn("text-sm font-medium tabular-nums shrink-0", item.type === "Ingreso" ? "text-success" : "text-foreground")}>
                                {item.type === "Ingreso" ? "+" : "-"}{clp(item.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {selectedSkipped.size > 0 && (
                        <Button onClick={handleImportSelected} disabled={isImporting} className="w-full" variant="ghost">
                          {isImporting ? <Loader2 className="animate-spin" /> : <Plus />}
                          Importar {selectedSkipped.size} seleccionada{selectedSkipped.size !== 1 ? "s" : ""}
                        </Button>
                      )}
                    </div>
                  )}

                  {result.imported === 0 && result.skipped === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">No se encontraron transacciones nuevas.</p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </BaseModal>
  );
}
