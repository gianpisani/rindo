import { format } from "date-fns";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { Transaction } from "@/hooks/useTransactions";
import { AMOUNT_TEXT_CLASS } from "@/lib/tx-display";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";

interface DeleteTransactionsConfirmProps {
  ids: string[];
  bulk: boolean;
  transactions: Transaction[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}

function TransactionPreview({ tx }: { tx: Transaction }) {
  return (
    <div className="rounded-card border p-3 space-y-1 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{tx.detail || "Sin detalle"}</span>
        <span className={cn("font-medium font-mono tabular-nums", AMOUNT_TEXT_CLASS[tx.type])}>
          {clp(tx.amount)}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{tx.category_name}</span>
        <span>{format(new Date(tx.date), "dd/MM/yyyy")}</span>
      </div>
    </div>
  );
}

export function DeleteTransactionsConfirm({ ids, bulk, transactions, onClose, onConfirm }: DeleteTransactionsConfirmProps) {
  const closeOnDismiss = (open: boolean) => {
    if (!open) onClose();
  };

  if (bulk) {
    return (
      <ConfirmDialog
        open={ids.length > 0}
        onOpenChange={closeOnDismiss}
        onConfirm={() => onConfirm(ids)}
        title={`¿Eliminar ${ids.length} transacciones?`}
        description="Esta acción eliminará las transacciones seleccionadas. Podrás deshacerlo desde el toast de confirmación."
        confirmText={`Eliminar ${ids.length}`}
        cancelText="Cancelar"
        variant="destructive"
      />
    );
  }

  const tx = ids.length > 0 ? transactions.find((t) => t.id === ids[0]) : undefined;
  return (
    <ConfirmDialog
      open={ids.length > 0}
      onOpenChange={closeOnDismiss}
      onConfirm={() => ids.length > 0 && onConfirm(ids)}
      title="¿Eliminar transacción?"
      description="Esta acción no se puede deshacer."
      confirmText="Eliminar"
      cancelText="Cancelar"
    >
      {tx && <TransactionPreview tx={tx} />}
    </ConfirmDialog>
  );
}
