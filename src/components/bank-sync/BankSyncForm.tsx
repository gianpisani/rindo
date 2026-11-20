import { Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import type { Bank } from "@/lib/banks";
import type { BankSyncFormState } from "@/hooks/useBankSyncForm";
import { BankFormHeader } from "@/components/bank-sync/BankFormHeader";
import { BankCredentialsFields } from "@/components/bank-sync/BankCredentialsFields";
import { AutoSyncOptIn } from "@/components/bank-sync/AutoSyncOptIn";

interface BankSyncFormProps {
  id: string;
  bank: Bank;
  form: BankSyncFormState;
}

export function BankSyncForm({ id, bank, form }: BankSyncFormProps) {
  const { storedCred, fromDate, setFromDate, toDate, setToDate } = form;

  return (
    <form id={id} onSubmit={form.handleSubmit} className="space-y-4 pt-1">
      <BankFormHeader bank={bank} hasStoredCredentials={Boolean(storedCred)} onBack={() => form.setBank("")} />

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

      {!storedCred && <BankCredentialsFields bank={bank} form={form} />}

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

      {!form.hasCredentialsForBank && (
        <AutoSyncOptIn
          checked={form.saveCredentials}
          onCheckedChange={form.setSaveCredentials}
          schedule={form.syncSchedule}
          onScheduleChange={form.setSyncSchedule}
        />
      )}
    </form>
  );
}
