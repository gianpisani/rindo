import { useState } from "react";
import { BaseModal } from "@/components/shared/BaseModal";
import type { SyncStep, SyncResult, SyncMovementItem } from "@/contexts/BankSyncContext";
import { bankSyncHeading, bankSyncView, hasBankSyncFooter, type BankSyncTab } from "@/lib/bank-sync";
import { useBankSyncForm } from "@/hooks/useBankSyncForm";
import { useSyncResultSelection } from "@/hooks/useSyncResultSelection";
import { BankSyncSettings } from "@/components/bank-sync/BankSyncSettings";
import { BankSyncHistory } from "@/components/bank-sync/BankSyncHistory";
import { BankSyncTabs } from "@/components/bank-sync/BankSyncTabs";
import { BankPicker } from "@/components/bank-sync/BankPicker";
import { BankSyncForm } from "@/components/bank-sync/BankSyncForm";
import { BankSyncPolling } from "@/components/bank-sync/BankSyncPolling";
import { BankSyncResult } from "@/components/bank-sync/BankSyncResult";
import { BankSyncFooter } from "@/components/bank-sync/BankSyncFooter";

const FORM_ID = "bank-sync-form";

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
  const [tab, setTab] = useState<BankSyncTab>("sync");
  const form = useBankSyncForm({ syncStep, onStart, onStartStored });
  const selection = useSyncResultSelection({ result, bank: form.bank, onImportSkipped, onDeleteImported });
  const { selectedBank, storedCred } = form;

  const view = bankSyncView(syncStep, result !== null);
  const { title, description } = bankSyncHeading(tab, view, selectedBank?.label, Boolean(storedCred));

  function handleRetry() {
    onReset();
    form.resetForRetry();
    selection.reset();
  }

  function handleClose() {
    onReset();
    onOpenChange(false);
    setTab("sync");
  }

  function selectTab(id: BankSyncTab) {
    setTab(id);
    if (id === "sync") onReset();
  }

  const footer = tab === "sync" && hasBankSyncFooter(view, Boolean(selectedBank), Boolean(result)) ? (
    <BankSyncFooter
      view={view}
      formId={FORM_ID}
      selectedBank={selectedBank}
      submitting={syncStep === "submitting"}
      canSubmit={form.canSubmit}
      result={result}
      onDismiss={() => onOpenChange(false)}
      onRetry={handleRetry}
      onDone={handleClose}
    />
  ) : undefined;

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      maxWidth={view === "result" && result && !("error" in result) ? "lg" : "md"}
      footer={footer}
    >
      {view === "form" && <BankSyncTabs tab={tab} onSelect={selectTab} />}

      {tab === "settings" && (
        <BankSyncSettings
          onAddBank={() => { setTab("sync"); onReset(); form.setBank(""); }}
        />
      )}

      {tab === "history" && <BankSyncHistory />}

      {tab === "sync" && (
        <>
          {view === "form" && !selectedBank && (
            <BankPicker credentials={form.existingCredentials} onPick={form.setBank} />
          )}

          {view === "form" && selectedBank && <BankSyncForm id={FORM_ID} bank={selectedBank} form={form} />}

          {view === "polling" && <BankSyncPolling pollStatus={pollStatus} />}

          {view === "result" && result && (
            <BankSyncResult
              result={result}
              selection={selection}
              autoSyncSchedule={form.credentialsSaved && form.syncSchedule !== "disabled" ? form.syncSchedule : null}
            />
          )}
        </>
      )}
    </BaseModal>
  );
}
