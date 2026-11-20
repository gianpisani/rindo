import { useState, useCallback, useEffect, type ChangeEvent, type FormEvent } from "react";
import { format } from "date-fns";
import { BANKS, formatRut, validateRut, type SyncScheduleId } from "@/lib/banks";
import { useSaveCredentials, useBankSyncCredentials } from "@/hooks/useBankSyncCredentials";
import type { SyncStep } from "@/lib/bank-sync";

interface BankSyncFormParams {
  syncStep: SyncStep;
  onStart: (params: { bank: string; rut: string; password: string; fromDate?: string; toDate?: string }) => void;
  onStartStored: (params: { bank: string; fromDate?: string; toDate?: string }) => void;
}

export function useBankSyncForm({ syncStep, onStart, onStartStored }: BankSyncFormParams) {
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
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  const rutValid = validateRut(rut);
  const showRutError = rutTouched && rut.length > 0 && !rutValid;

  const selectedBank = BANKS.find((b) => b.value === bank);
  const storedCred = existingCredentials?.find((c) => c.bank === bank);

  const handleRutChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value));
  }, []);

  async function handleSubmit(e: FormEvent) {
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

  const [saveTriggered, setSaveTriggered] = useState(false);
  const { mutate: saveCredentialsOnce } = saveCredentialsMutation;
  useEffect(() => {
    if (syncStep !== "completed" || saveTriggered || !saveCredentials || !password) return;
    setSaveTriggered(true);
    if (!bank || !rut || hasCredentialsForBank) return;
    saveCredentialsOnce({ bank, rut, password, syncSchedule }, { onSuccess: () => setCredentialsSaved(true) });
  }, [syncStep, saveTriggered, saveCredentials, password, bank, rut, hasCredentialsForBank, syncSchedule, saveCredentialsOnce]);

  function resetForRetry() {
    setPassword("");
    setCredentialsSaved(false);
    setSaveTriggered(false);
  }

  const canSubmit = syncStep !== "submitting" && (Boolean(storedCred) || (Boolean(rut) && rutValid && Boolean(password)));

  return {
    bank,
    setBank,
    rut,
    handleRutChange,
    setRutTouched,
    showRutError,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    saveCredentials,
    setSaveCredentials,
    syncSchedule,
    setSyncSchedule,
    credentialsSaved,
    existingCredentials,
    hasCredentialsForBank,
    selectedBank,
    storedCred,
    canSubmit,
    handleSubmit,
    resetForRetry,
  };
}

export type BankSyncFormState = ReturnType<typeof useBankSyncForm>;
