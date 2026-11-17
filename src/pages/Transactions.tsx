import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { TransactionsTable, getCategoryIcon, typeAmountColors } from "@/components/TransactionsTable";
import { TransactionsToolbar } from "@/components/TransactionsToolbar";
import { Button } from "@/components/ui/button";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { categoryFrequency, getCleanDetail, parseWhisper, WHISPER_TYPES } from "@/lib/whisper";
import "@/components/whisper.css";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, X, Trash2, Users, CheckCircle2, Check, Clock, Pencil, ChevronDown, ArrowUp } from "lucide-react";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useSearchFocusShortcut } from "@/hooks/useSearchFocusShortcut";
import { useCategories } from "@/hooks/useCategories";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useSharedExpenses } from "@/hooks/useSharedExpenses";
import SharedExpenseDrawer from "@/components/SharedExpenseDrawer";
import { BankSyncModal } from "@/components/BankSyncModal";
import { useBankSyncContext } from "@/contexts/BankSyncContext";
import { format } from "date-fns";
import Papa from "papaparse";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DateRangeValue } from "@/components/DateRangeFilter";
import { TransactionType, allowsNegativeAmount } from "@/lib/ledger";

// ── Editor de movimientos: el composer del Whisper con el texto precargado ──

/** Colores para una categoría nueva creada desde el composer. */
const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#10b981", "#14b8a6", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#64748b",
];

const LOSS_ACCENT = "#f87171";

/** Un instante como valor de <input type="datetime-local">, en hora local. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount);

const EMPTY_FORM = {
  // Fecha y hora como valor de datetime-local, en hora local.
  date: "",
  // El monto nuevo; vacío deja el guardado.
  value: "",
  category_name: "",
  type: "Gasto" as TransactionType,
  card_id: null as string | null,
  // Solo aplica al rendimiento, el único tipo que puede ser negativo.
  isLoss: false,
};

/** Agrega el ítem a la lista, o lo saca si ya estaba. */
const toggleById = <T extends { id: string }>(list: T[], item: T) =>
  list.some((d) => d.id === item.id) ? list.filter((d) => d.id !== item.id) : [...list, item];

/** Panel para elegir deudas pendientes y aplicarles este movimiento. */
function DebtPanel({
  title,
  onClose,
  debts,
  selected,
  txAmount,
  blur,
  confirmLabel,
  pending,
  onConfirm,
}: {
  title: string;
  onClose?: () => void;
  debts: Array<{ id: string; name: string; amount: number; detail: React.ReactNode; onToggle: () => void }>;
  selected: Array<{ id: string; amount: number }>;
  txAmount: number;
  blur: boolean;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const selectedTotal = selected.reduce((sum, d) => sum + d.amount, 0);
  const totalMismatch = txAmount > 0 && selected.length > 0 && Math.abs(txAmount - selectedTotal) > 1;
  const plural = selected.length > 1 ? "s" : "";

  return (
    <div className="whisper-tx-panel">
      <div className="whisper-tx-panel-head">
        <span><Users aria-hidden="true" /> {title}</span>
        {onClose && (
          <button type="button" className="whisper-tx-icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={13} />
          </button>
        )}
      </div>
      {debts.map((debt) => {
        const isSelected = selected.some((d) => d.id === debt.id);
        return (
          <div
            key={debt.id}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={debt.onToggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                debt.onToggle();
              }
            }}
            className="whisper-tx-row"
          >
            {/* Indicador visual, NO un Checkbox de Radix: un Checkbox
                controlado dentro de un <form> monta un input oculto que
                re-despacha un evento 'click' burbujeante cada vez que
                cambia `checked`, y entra en loop infinito. */}
            <span className="whisper-tx-check" aria-hidden="true">{isSelected && <Check size={10} />}</span>
            <span className="name">
              <span>{debt.name}</span>
              <small>{debt.detail}</small>
            </span>
            <span className={cn("amt", blur && "privacy-blur")}>{formatCurrency(debt.amount)}</span>
          </div>
        );
      })}
      {selected.length > 0 && (
        <>
          <div className="whisper-tx-foot">
            <span>
              {selected.length} deuda{plural} seleccionada{plural}
            </span>
            <b className={cn(totalMismatch && "warn", blur && "privacy-blur")}>{formatCurrency(selectedTotal)}</b>
          </div>
          <button type="button" className="whisper-tx-mini primary" disabled={pending} onClick={onConfirm}>
            <Check size={12} /> {confirmLabel}
          </button>
        </>
      )}
    </div>
  );
}

export default function Transactions() {
  const {
    transactions,
    futureTransactions,
    allTransactions,
    updateTransaction,
    updateTransactionSilent,
    deleteTransaction,
    deleteMultipleTransactions,
    updateMultipleTransactions,
    duplicateTransactions,
  } = useTransactions();
  const { categories, addCategory } = useCategories();
  const { creditCards, isLoading: isLoadingCards } = useCreditCards();
  const {
    addSharedExpenses,
    updateSharedExpenseAmount,
    getSharedExpensesByTransaction,
    markAsPaid,
    linkExistingTransactionToDebts,
    settleDebtsIOwe,
    deleteSharedExpense,
    sharedExpenses,
    sharedExpensesWithTransaction,
    uniqueDebtorNames,
  } = useSharedExpenses();
  const bankSync = useBankSyncContext();
  const { isPrivacyMode } = usePrivacyMode();
  const reducedMotion = useReducedMotion();

  const [showFuture, setShowFuture] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);

  // El composer solo edita: los movimientos nuevos entran por el QuickAdd global.
  // editingTransaction queda puesto al cerrar, así el fade de salida no cambia de modo.
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  // El composer: opciones abiertas, todas las categorías, categoría nueva en línea, error.
  const [txExpanded, setTxExpanded] = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const [newCategory, setNewCategory] = useState<{ name: string; icon: string; color: string } | null>(null);
  const [txError, setTxError] = useState("");
  // La nota del movimiento, que al guardar pisa el detail. En null el campo
  // está colapsado y nadie lo tocó: el detail guardado se queda como está.
  const [note, setNote] = useState<string | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const txInputRef = useRef<HTMLInputElement>(null);
  const txCategoryGroupRef = useRef<HTMLDivElement>(null);
  const txOptionsToggleRef = useRef<HTMLButtonElement>(null);
  const [isShared, setIsShared] = useState(false);
  const [sharedDrawerOpen, setSharedDrawerOpen] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{ id: string; amount: number } | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<{ id: string; name: string; amount: number; detail?: string } | null>(null);
  // Gasto ya dividido: la persona que se está agregando, o la deuda cuyo monto se edita.
  const [newDebtor, setNewDebtor] = useState<{ name: string; amount: string } | null>(null);
  const [editingDebtor, setEditingDebtor] = useState<{ id: string; amount: string } | null>(null);
  const [debtsToLink, setDebtsToLink] = useState<Array<{ id: string; debtorName: string; amount: number; transactionDetail?: string }>>([]);
  const [debtsIOweToSettle, setDebtsIOweToSettle] = useState<Array<{ id: string; debtorName: string; amount: number }>>([]);
  const [settleDebtToggle, setSettleDebtToggle] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchFocusShortcut(searchInputRef);
  const [highlightId, setHighlightId] = useState<string | null>(searchParams.get("highlight"));
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cardFilter, setCardFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});

  // Sync from URL params (e.g. coming from ⌘K)
  useEffect(() => {
    const urlSearch = searchParams.get("search");
    const urlHighlight = searchParams.get("highlight");
    if (urlSearch) {
      setSearchValue(urlSearch);
      // Clean URL params without triggering re-render loop
      setSearchParams({}, { replace: true });
    }
    if (urlHighlight) {
      setHighlightId(urlHighlight);
      // Clear highlight after animation
      const timer = setTimeout(() => setHighlightId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, []);
  // Lo que espera confirmación para eliminarse: un id, o los de la selección.
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [formData, setFormData] = useState(() => ({ ...EMPTY_FORM, date: toLocalInput(new Date()) }));
  const parsedDraft = parseWhisper(formData.value);
  // El input parte vacío: dejarlo así conserva el monto guardado.
  const editingMagnitude = editingTransaction ? Math.abs(editingTransaction.amount) : 0;
  const effectiveAmount = parsedDraft?.amount ?? editingMagnitude;
  const composerType = WHISPER_TYPES.find((t) => t.type === formData.type) ?? WHISPER_TYPES[0];
  const composerAccent = formData.type === "Rendimiento" && formData.isLoss ? LOSS_ACCENT : composerType.color;

  // Las categorías que ofrece el filtro: las que aparecen en lo que se está
  // viendo, con su emoji ya resuelto.
  const toolbarCategories = useMemo(
    () =>
      Array.from(
        new Set(
          [...transactions, ...(showFuture ? futureTransactions : [])]
            .map((t) => t.category_name)
            .filter((name) => name && name.trim().length > 0)
        )
      )
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          name,
          emoji:
            categories.find((c) => c.name === name)?.icon ||
            getCategoryIcon(name),
        })),
    [transactions, futureTransactions, showFuture, categories]
  );

  // Las categorías del tipo elegido, las más usadas primero; cinco a la vista.
  const availableCategories = useMemo(() => {
    const frequency = categoryFrequency(allTransactions, formData.type);
    return categories
      .filter(
        (c) =>
          c.is_active !== false &&
          c.type === formData.type &&
          c.name.trim().length > 0 &&
          !["Sin categoría", "⚡ Analizando..."].includes(c.name)
      )
      .sort((a, b) => (frequency.get(b.name) ?? 0) - (frequency.get(a.name) ?? 0) || a.name.localeCompare(b.name));
  }, [categories, allTransactions, formData.type]);
  const visibleCategories = useMemo(() => {
    const top = allCategories ? availableCategories : availableCategories.slice(0, 5);
    // La categoría del movimiento que se edita siempre se ve, aunque no sea de las frecuentes.
    const current = availableCategories.find((c) => c.name === formData.category_name);
    return current && !top.includes(current) ? [...top, current] : top;
  }, [availableCategories, allCategories, formData.category_name]);

  const changeType = (type: TransactionType) => {
    setFormData((prev) => ({ ...prev, type, category_name: "" }));
    if (type !== "Ingreso" && type !== "Reembolso") setDebtsToLink([]);
    if (type !== "Gasto") setDebtsIOweToSettle([]);
    setAllCategories(false);
    setNewCategory(null);
    setTxError("");
  };
  const cycleType = (backwards: boolean) => {
    const index = WHISPER_TYPES.findIndex((t) => t.type === formData.type);
    changeType(WHISPER_TYPES[(index + (backwards ? WHISPER_TYPES.length - 1 : 1)) % WHISPER_TYPES.length].type);
  };

  const createCategory = async () => {
    if (!newCategory || !newCategory.name.trim()) return;
    const name = newCategory.name.trim();
    try {
      await addCategory.mutateAsync({ name, type: formData.type, color: newCategory.color, icon: newCategory.icon || "🏷️" });
    } catch {
      // addCategory ya notifica el error; quedarse en el form.
      return;
    }
    setFormData((prev) => ({ ...prev, category_name: name }));
    setNewCategory(null);
  };

  // Lo que alimenta los paneles de deudas: lo pendiente en cada dirección, y
  // lo ya dividido del movimiento que se edita.
  const existingShared = editingTransaction ? getSharedExpensesByTransaction(editingTransaction.id) : [];
  const pendingDebts = sharedExpensesWithTransaction.filter((se) => !se.paid && se.direction === "they_owe_me");
  const pendingIOwe = sharedExpensesWithTransaction.filter((se) => !se.paid && se.direction === "i_owe_them");
  const editingAlreadyLinked =
    !!editingTransaction && sharedExpenses.some((se) => se.paid_transaction_id === editingTransaction.id);
  const showLinkPanel =
    (formData.type === "Ingreso" || formData.type === "Reembolso") && !editingAlreadyLinked && pendingDebts.length > 0;

  const closeComposer = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    // El input es solo el monto: el texto va en la nota. Vacío significa
    // "deja el monto como está".
    if (formData.value.trim() && (!parsedDraft || parsedDraft.detail)) {
      setTxError("Acá va solo el monto. El detalle se edita en la nota.");
      txInputRef.current?.focus();
      return;
    }
    if (!formData.date || !Number.isFinite(new Date(formData.date).getTime())) {
      setTxExpanded(true);
      setTxError("Elige una fecha válida.");
      return;
    }

    // Un rendimiento negativo es un mes malo, no un error: el resto de los
    // tipos siempre va en positivo.
    const parsedAmount =
      allowsNegativeAmount(formData.type) && formData.isLoss ? -effectiveAmount : effectiveAmount;
    // El badge del bot sobrevive a que le cambies el texto, igual que en la
    // edición inline de la tabla.
    const prefix = (editingTransaction.detail || "").startsWith("🤖") ? "🤖 " : "";
    const newNote = note?.trim();

    await updateTransaction.mutateAsync({
      id: editingTransaction.id,
      category_name: formData.category_name,
      type: formData.type,
      card_id: formData.card_id,
      // Sin nota escrita, el detalle guardado queda intacto. Para borrarlo
      // está la edición inline de la columna Detalle.
      ...(newNote ? { detail: prefix + newNote } : {}),
      date: new Date(formData.date).toISOString(),
      amount: parsedAmount,
    });

    if (isShared && formData.type === "Gasto" && existingShared.length === 0) {
      setPendingTransaction({ id: editingTransaction.id, amount: parsedAmount });
      setIsDialogOpen(false);
      setSharedDrawerOpen(true);
      return;
    }

    closeComposer();
  };

  const handleSharedExpenseConfirm = async (debtors: Array<{ name: string; amount: number }>) => {
    if (!pendingTransaction) return;

    try {
      await addSharedExpenses.mutateAsync(
        debtors.map((d) => ({
          transaction_id: pendingTransaction.id,
          debtor_name: d.name,
          amount_owed: d.amount,
          detail: null,
        }))
      );

      toast.success(`Gasto compartido dividido entre ${debtors.length} persona${debtors.length > 1 ? "s" : ""}`);
    } catch (error) {
      console.error("Error guardando gastos compartidos:", error);
    }

    setPendingTransaction(null);
    resetForm();
  };

  const handleMarkAsPaid = async () => {
    if (!confirmPaid) return;
    await markAsPaid.mutateAsync({
      sharedExpenseId: confirmPaid.id,
      debtorName: confirmPaid.name,
      amount: confirmPaid.amount,
      transactionDetail: confirmPaid.detail,
    });
    // Actualizar el monto para que "Guardar cambios" no sobreescriba el monto reducido
    const newAmount = effectiveAmount - confirmPaid.amount;
    if (newAmount >= 0) {
      setFormData((prev) => ({ ...prev, value: String(newAmount) }));
    }
    setConfirmPaid(null);
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM, date: toLocalInput(new Date()) });
    setTxExpanded(false);
    setAllCategories(false);
    setNewCategory(null);
    setTxError("");
    setNote(null);
    setIsShared(false);
    setPendingTransaction(null);
    setNewDebtor(null);
    setEditingDebtor(null);
    setDebtsToLink([]);
    setDebtsIOweToSettle([]);
    setSettleDebtToggle(false);
  };

  // Ghost click de iOS: al tocar "Eliminar" (en el menú de una card, el
  // panel de selección o el propio diálogo de confirmación) el overlay se
  // desmonta y el click retrasado del navegador aterriza en la card que
  // quedó debajo, abriendo Editar sin querer. Cualquier paso del flujo de
  // eliminar arma esta ventana y handleEdit la respeta.
  const editGhostGuardRef = useRef(0);
  const armEditGuard = () => {
    editGhostGuardRef.current = Date.now();
  };

  const handleEdit = (transaction: Transaction) => {
    if (Date.now() - editGhostGuardRef.current < 800) return;
    if (deleteId || deleteIds.length > 0) return;
    setEditingTransaction(transaction);

    // El input parte vacío: el monto y el nombre del banco van en el
    // placeholder, y escribir solo hace falta si querés cambiar el monto.
    setFormData({
      ...EMPTY_FORM,
      date: toLocalInput(new Date(transaction.date)),
      category_name: transaction.category_name,
      type: transaction.type,
      card_id: transaction.card_id,
      isLoss: transaction.amount < 0,
    });
    // La nota parte cerrada y vacía: el detalle guardado solo cambia si
    // marcás la casilla y escribís algo.
    setNote(null);

    const shared = getSharedExpensesByTransaction(transaction.id);
    setIsShared(shared.length > 0);
    // Al editar, la fecha y la cuenta importan: las opciones parten abiertas.
    setTxExpanded(true);
    setTxError("");

    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    armEditGuard();
    setDeleteId(id);
  };

  const handleDeleteMultiple = async (ids: string[]) => {
    armEditGuard();
    setDeleteIds(ids);
  };

  const handleExportCSV = () => {
    const csvData = transactions.map((t) => ({
      Fecha: format(new Date(t.date), "dd/MM/yyyy"),
      Detalle: t.detail || "",
      Categoría: t.category_name,
      Tipo: t.type,
      Monto: `$${Number(t.amount).toLocaleString("es-CL")}`,
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transacciones_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };


  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Transacciones</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona todas tus transacciones
            </p>
          </div>
          <Button className="rounded-full h-12 w-12 p-0 md:w-auto md:px-6" onClick={() => useGlobalDrawers.getState().openQuickAdd("Gasto")} aria-label="Agregar movimiento">
            <Plus className="h-5 w-5 md:mr-2" />
            <span className="hidden md:inline">Agregar</span>
          </Button>

          {editingTransaction && (
            <Dialog.Root
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <Dialog.Portal>
                <Dialog.Overlay className="whisper-backdrop" />
                <Dialog.Content
                  data-scrollable
                  className="whisper-composer"
                  style={{ "--whisper-accent": composerAccent } as React.CSSProperties}
                  onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    txInputRef.current?.focus();
                  }}
                >
                  <Dialog.Title className="sr-only">Editar movimiento</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Escribe monto y detalle en una línea. Tab cambia el tipo; flecha abajo lleva a las categorías. En más opciones están la fecha, la cuenta y los gastos compartidos.
                  </Dialog.Description>
                  <Dialog.Close className="whisper-close" aria-label="Cerrar">
                    <X size={16} />
                  </Dialog.Close>

                  <form id="transaction-form" onSubmit={handleSubmit} className="whisper-form">
                    {/* Tipo */}
                    <div className="whisper-type">
                      <span className="whisper-dot" aria-hidden="true" />
                      <span aria-hidden="true">{formData.type}</span>
                      <select
                        aria-label="Tipo de movimiento"
                        value={formData.type}
                        onChange={(event) => {
                          changeType(event.target.value as TransactionType);
                          txInputRef.current?.focus();
                        }}
                      >
                        {WHISPER_TYPES.map((t) => (
                          <option key={t.type}>{t.type}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} aria-hidden="true" />
                    </div>

                    {/* Solo el monto: el detalle va en la nota */}
                    <div className="whisper-entry">
                      <input
                        ref={txInputRef}
                        aria-label="Monto"
                        aria-describedby={txError ? "tx-error tx-shortcuts" : "tx-shortcuts"}
                        aria-invalid={!!txError}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={1000}
                        value={formData.value}
                        onChange={(event) => {
                          setFormData((prev) => ({ ...prev, value: event.target.value }));
                          setTxError("");
                        }}
                        // El placeholder recuerda qué movimiento es: su monto y el nombre
                        // que mandó el banco, que es el que no cambia aunque le pongas una nota.
                        placeholder={[editingMagnitude, editingTransaction.bank_description || getCleanDetail(editingTransaction.detail)]
                          .filter(Boolean)
                          .join(" ")}
                        // El monto vive en el placeholder: también se tapa.
                        className={cn("whisper-input", isPrivacyMode && "privacy-blur")}
                        onKeyDown={(event) => {
                          if (event.nativeEvent.isComposing) {
                            if (event.key === "Enter") event.preventDefault();
                            return;
                          }
                          if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
                            event.preventDefault();
                            cycleType(event.shiftKey);
                            return;
                          }
                          if (event.key === "ArrowDown" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                            event.preventDefault();
                            const selected = txCategoryGroupRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
                            const first = txCategoryGroupRef.current?.querySelector<HTMLButtonElement>("button");
                            (selected ?? first ?? txOptionsToggleRef.current)?.focus();
                            return;
                          }
                          if (event.altKey && ["ArrowRight", "ArrowLeft"].includes(event.key)) {
                            event.preventDefault();
                            cycleType(event.key === "ArrowLeft");
                          }
                        }}
                      />
                      <div
                        className={cn("whisper-preview", isPrivacyMode && effectiveAmount > 0 && "privacy-blur")}
                        aria-hidden="true"
                      >
                        {effectiveAmount > 0 && (
                          <span>
                            {formData.type === "Rendimiento" && formData.isLoss ? "−" : ""}
                            {formatCurrency(effectiveAmount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Categorías */}
                    <div className="whisper-category-space">
                      {formData.type === "Rendimiento" && (
                        <div className="whisper-categories whisper-tx-sign" role="group" aria-label="Ganancia o pérdida">
                          {[
                            { loss: false, label: "Ganancia" },
                            { loss: true, label: "Pérdida" },
                          ].map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              className="whisper-category"
                              aria-pressed={formData.isLoss === opt.loss}
                              onClick={() => setFormData((prev) => ({ ...prev, isLoss: opt.loss }))}
                            >
                              <span className="whisper-category-dot" aria-hidden="true" />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {newCategory ? (
                        <div className="whisper-tx-newcat" role="group" aria-label="Nueva categoría">
                          <div className="whisper-tx-inline">
                            <input
                              className="whisper-tx-emoji"
                              aria-label="Emoji de la categoría"
                              maxLength={4}
                              value={newCategory.icon}
                              onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                            />
                            <input
                              className="grow"
                              aria-label="Nombre de la categoría"
                              placeholder={`Nueva categoría de ${formData.type.toLowerCase()}`}
                              value={newCategory.name}
                              autoFocus
                              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  createCategory();
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setNewCategory(null);
                                }
                              }}
                            />
                          </div>
                          <div className="whisper-swatches" role="radiogroup" aria-label="Color de la categoría">
                            {CATEGORY_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                role="radio"
                                aria-checked={newCategory.color === c}
                                aria-label={`Color ${c}`}
                                className="whisper-swatch"
                                style={{ "--swatch": c } as React.CSSProperties}
                                onClick={() => setNewCategory({ ...newCategory, color: c })}
                              />
                            ))}
                          </div>
                          <div className="whisper-tx-inline">
                            <button
                              type="button"
                              className="whisper-tx-mini primary"
                              disabled={!newCategory.name.trim() || addCategory.isPending}
                              onClick={createCategory}
                            >
                              <Check size={12} /> Crear {newCategory.icon} {newCategory.name.trim() || "categoría"}
                            </button>
                            <button type="button" className="whisper-tx-mini" onClick={() => setNewCategory(null)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div ref={txCategoryGroupRef} className="whisper-categories" role="group" aria-label="Categorías disponibles">
                          {visibleCategories.map((category) => (
                            <button
                              key={category.id}
                              type="button"
                              className="whisper-category"
                              aria-pressed={formData.category_name === category.name}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  category_name: prev.category_name === category.name ? "" : category.name,
                                }));
                                txInputRef.current?.focus();
                              }}
                            >
                              <span className="whisper-category-dot" aria-hidden="true" />
                              {category.icon || getCategoryIcon(category.name)} {category.name}
                              {formData.category_name === category.name && <Check size={12} aria-hidden="true" />}
                            </button>
                          ))}
                          {availableCategories.length > 5 && (
                            <button
                              type="button"
                              className="whisper-more-categories"
                              aria-expanded={allCategories}
                              onClick={() => setAllCategories(!allCategories)}
                            >
                              {allCategories ? "Menos" : `+${availableCategories.length - 5}`}
                            </button>
                          )}
                          <button
                            type="button"
                            className="whisper-more-categories"
                            onClick={() => setNewCategory({ name: "", icon: "🏷️", color: CATEGORY_COLORS[0] })}
                          >
                            <Plus size={11} aria-hidden="true" /> Nueva
                          </button>
                        </div>
                      )}

                      <p className="whisper-caption" aria-live="polite">
                        {formData.category_name ? `Se guardará en ${formData.category_name}` : "Elige una categoría"}
                      </p>
                    </div>

                    {/* Nota: pisa el detalle del movimiento, dejando intacto el
                        nombre que mandó el banco. El campo aparece solo si marcás
                        la casilla, y parte vacío para escribir de una. */}
                    <div className="whisper-note-block">
                      <label className="whisper-note-check">
                        <input
                          type="checkbox"
                          checked={note !== null}
                          onChange={(event) => {
                            setNote(event.target.checked ? "" : null);
                            if (event.target.checked) {
                              requestAnimationFrame(() => noteInputRef.current?.focus());
                            }
                          }}
                        />
                        Agregar nota
                      </label>
                      {note !== null && (
                        <input
                          ref={noteInputRef}
                          aria-label="Nota del movimiento"
                          className={cn("whisper-note", isPrivacyMode && note && "privacy-blur")}
                          autoComplete="off"
                          maxLength={200}
                          // El detalle actual como placeholder: ves qué vas a reemplazar.
                          placeholder={getCleanDetail(editingTransaction.detail) || "Tu nota para este movimiento"}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              // Cierra la nota, no el diálogo.
                              event.stopPropagation();
                              event.preventDefault();
                              setNote(null);
                              txInputRef.current?.focus();
                            }
                            if (event.key === "Enter") {
                              event.preventDefault();
                              noteInputRef.current?.blur();
                            }
                          }}
                        />
                      )}
                    </div>

                    {/* Más opciones: fecha, cuenta, compartido, saldar */}
                    <AnimatePresence initial={false}>
                      {txExpanded && (
                        <motion.div
                          className="whisper-options"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: reducedMotion ? 0 : 0.18 }}
                        >
                          <label>
                            Fecha y hora
                            <input
                              type="datetime-local"
                              aria-label="Fecha y hora del movimiento"
                              value={formData.date}
                              onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                            />
                          </label>
                          {formData.type !== "Inversión" && creditCards.length > 0 && (
                            <label>
                              Cuenta
                              <select
                                aria-label="Cuenta o tarjeta"
                                value={formData.card_id ?? ""}
                                onChange={(event) =>
                                  setFormData((prev) => ({ ...prev, card_id: event.target.value || null }))
                                }
                              >
                                <option value="">Cuenta</option>
                                {creditCards
                                  .filter((card) => card.is_active)
                                  .map((card) => (
                                    <option key={card.id} value={card.id}>
                                      {card.name}
                                      {card.last_4_digits ? ` ···· ${card.last_4_digits}` : ""}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          )}
                          {formData.type === "Gasto" && existingShared.length === 0 && (
                            <label className="whisper-check">
                              <input type="checkbox" checked={isShared} onChange={(event) => setIsShared(event.target.checked)} />
                              Gasto compartido
                            </label>
                          )}
                          {formData.type === "Gasto" && pendingIOwe.length > 0 && (
                            <label className="whisper-check">
                              <input
                                type="checkbox"
                                checked={settleDebtToggle}
                                onChange={(event) => {
                                  setSettleDebtToggle(event.target.checked);
                                  if (!event.target.checked) setDebtsIOweToSettle([]);
                                }}
                              />
                              Salda una deuda que debo
                            </label>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Vincular a deuda(s) pendiente(s): Ingreso o Reembolso */}
                    {showLinkPanel && (
                      <DebtPanel
                        title="Vincular a una deuda pendiente"
                        debts={pendingDebts.map((debt) => ({
                          id: debt.id,
                          name: debt.debtor_name,
                          amount: debt.amount_owed,
                          detail: (
                            <>
                              {debt.transaction_detail || "Sin detalle"}{debt.transaction_date && ` · ${new Date(debt.transaction_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`}
                              {debtsToLink.length <= 1 && effectiveAmount > 0 && Math.abs(effectiveAmount - debt.amount_owed) > 1 && " · monto distinto a la deuda"}
                            </>
                          ),
                          onToggle: () =>
                            setDebtsToLink((prev) =>
                              toggleById(prev, { id: debt.id, debtorName: debt.debtor_name, amount: debt.amount_owed, transactionDetail: debt.transaction_detail || undefined })
                            ),
                        }))}
                        selected={debtsToLink}
                        txAmount={effectiveAmount}
                        blur={isPrivacyMode}
                        confirmLabel="Vincular seleccionadas"
                        pending={linkExistingTransactionToDebts.isPending}
                        onConfirm={async () => {
                          await linkExistingTransactionToDebts.mutateAsync({
                            debts: debtsToLink.map((d) => ({
                              sharedExpenseId: d.id,
                              amount: d.amount,
                              debtorName: d.debtorName,
                              transactionDetail: d.transactionDetail,
                            })),
                            existingTransactionId: editingTransaction.id,
                          });
                          closeComposer();
                        }}
                      />
                    )}

                    {/* Gasto compartido ya dividido: se edita acá mismo */}
                    {formData.type === "Gasto" && existingShared.length > 0 && (() => {
                      const liveTxAmount = transactions.find((t) => t.id === editingTransaction.id)?.amount ?? effectiveAmount;
                      const alreadyAssignedAll = existingShared.reduce((sum, se) => sum + se.amount_owed, 0);
                      const alreadyAssignedPending = existingShared.filter((se) => !se.paid).reduce((sum, se) => sum + se.amount_owed, 0);
                      const myShare = liveTxAmount - alreadyAssignedPending;
                      const remaining = liveTxAmount - alreadyAssignedAll;
                      const newAmount = parseFloat(newDebtor?.amount || "0");
                      const exceedsLimit = newAmount > remaining;
                      const isFormValid = newDebtor?.name.trim() && newDebtor.amount && !exceedsLimit;

                      return (
                        <div className="whisper-tx-panel">
                          <div className="whisper-tx-panel-head">
                            <span><Users aria-hidden="true" /> Gasto compartido</span>
                            {!newDebtor && (
                              <button type="button" className="whisper-tx-mini" onClick={() => setNewDebtor({ name: "", amount: "" })}>
                                <Plus size={11} /> Persona
                              </button>
                            )}
                          </div>

                          {existingShared.map((se) => {
                            const draft = editingDebtor?.id === se.id ? editingDebtor.amount : null;
                            const isEditingThis = draft !== null;
                            const editAmount = parseFloat(draft || "0");
                            const otherAssigned = existingShared.filter((s) => s.id !== se.id).reduce((sum, s) => sum + s.amount_owed, 0);
                            const editRemaining = effectiveAmount - otherAssigned;
                            const editExceeds = editAmount > editRemaining;
                            const editValid = draft && editAmount > 0 && !editExceeds;
                            const saveAmount = async () => {
                              await updateSharedExpenseAmount.mutateAsync({ id: se.id, amount_owed: editAmount });
                              setEditingDebtor(null);
                            };

                            return (
                              <div key={se.id} className="whisper-tx-row" data-paid={se.paid || undefined}>
                                {se.paid ? (
                                  <CheckCircle2 size={14} className="whisper-tx-status paid" aria-label="Pagado" />
                                ) : (
                                  <Clock size={14} className="whisper-tx-status" aria-label="Pendiente" />
                                )}
                                <span className="name">
                                  <span>{se.debtor_name}</span>
                                  {se.paid && (
                                    <small>Pagado {se.paid_at ? new Date(se.paid_at).toLocaleDateString("es-CL") : ""}</small>
                                  )}
                                  {isEditingThis && editExceeds && (
                                    <small className="warn">Máximo disponible: {formatCurrency(editRemaining)}</small>
                                  )}
                                </span>
                                {isEditingThis ? (
                                  <span className="whisper-tx-inline">
                                    <input
                                      className="amt"
                                      inputMode="numeric"
                                      aria-label={`Monto de ${se.debtor_name}`}
                                      value={draft}
                                      onChange={(e) => setEditingDebtor({ id: se.id, amount: e.target.value.replace(/\D/g, "") })}
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && editValid) {
                                          e.preventDefault();
                                          saveAmount();
                                        }
                                        if (e.key === "Escape") {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setEditingDebtor(null);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="whisper-tx-icon-btn"
                                      aria-label="Guardar monto"
                                      disabled={!editValid}
                                      onClick={saveAmount}
                                    >
                                      <Check size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className="whisper-tx-icon-btn"
                                      aria-label="Cancelar"
                                      onClick={() => setEditingDebtor(null)}
                                    >
                                      <X size={13} />
                                    </button>
                                  </span>
                                ) : (
                                  <>
                                    <span className={cn("amt", isPrivacyMode && "privacy-blur")}>{formatCurrency(se.amount_owed)}</span>
                                    <span className="whisper-tx-row-actions">
                                      {!se.paid && (
                                        <>
                                          <button
                                            type="button"
                                            className="whisper-tx-icon-btn"
                                            aria-label={`Editar monto de ${se.debtor_name}`}
                                            onClick={() => setEditingDebtor({ id: se.id, amount: se.amount_owed.toString() })}
                                          >
                                            <Pencil size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            className="whisper-tx-mini"
                                            onClick={() =>
                                              setConfirmPaid({
                                                id: se.id,
                                                name: se.debtor_name,
                                                amount: se.amount_owed,
                                                detail: editingTransaction.detail || undefined,
                                              })
                                            }
                                          >
                                            <CheckCircle2 size={11} /> Pagado
                                          </button>
                                        </>
                                      )}
                                      <button
                                        type="button"
                                        className="whisper-tx-icon-btn danger"
                                        aria-label={`Quitar a ${se.debtor_name}`}
                                        onClick={() => deleteSharedExpense.mutate(se.id)}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </span>
                                  </>
                                )}
                              </div>
                            );
                          })}

                          {myShare >= 0 && (
                            <div className="whisper-tx-foot">
                              <span>Tu parte</span>
                              <b className={cn(isPrivacyMode && "privacy-blur")}>{formatCurrency(myShare)}</b>
                            </div>
                          )}

                          {newDebtor && (
                            <div className="whisper-tx-add">
                              <div className="whisper-tx-foot">
                                <span>Disponible para asignar</span>
                                <b className={cn(remaining <= 0 && "warn", isPrivacyMode && "privacy-blur")}>{formatCurrency(remaining)}</b>
                              </div>
                              <div className="whisper-tx-inline">
                                <input
                                  className="grow"
                                  placeholder="Nombre"
                                  aria-label="Nombre de la persona"
                                  list="tx-debtor-suggestions"
                                  value={newDebtor.name}
                                  onChange={(e) => setNewDebtor({ ...newDebtor, name: e.target.value })}
                                  autoFocus
                                />
                                <datalist id="tx-debtor-suggestions">
                                  {uniqueDebtorNames("they_owe_me").map((name) => (
                                    <option key={name} value={name} />
                                  ))}
                                </datalist>
                                <input
                                  className={cn("amt", exceedsLimit && "invalid")}
                                  inputMode="numeric"
                                  placeholder="Monto"
                                  aria-label="Monto que debe"
                                  value={newDebtor.amount}
                                  onChange={(e) => setNewDebtor({ ...newDebtor, amount: e.target.value.replace(/\D/g, "") })}
                                />
                                <button
                                  type="button"
                                  className="whisper-tx-mini primary"
                                  disabled={!isFormValid}
                                  onClick={async () => {
                                    await addSharedExpenses.mutateAsync([{
                                      transaction_id: editingTransaction.id,
                                      debtor_name: newDebtor.name.trim(),
                                      amount_owed: newAmount,
                                      detail: null,
                                    }]);
                                    setNewDebtor(null);
                                  }}
                                >
                                  <Check size={12} /> Agregar
                                </button>
                                <button
                                  type="button"
                                  className="whisper-tx-icon-btn"
                                  aria-label="Cancelar"
                                  onClick={() => setNewDebtor(null)}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                              {exceedsLimit && (
                                <p className="whisper-tx-note warn">El monto supera el disponible ({formatCurrency(remaining)})</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Saldar deuda(s) que yo debo: solo Gasto */}
                    {formData.type === "Gasto" && settleDebtToggle && pendingIOwe.length > 0 && (
                      <DebtPanel
                        title="Saldar una deuda que debo"
                        onClose={() => {
                          setSettleDebtToggle(false);
                          setDebtsIOweToSettle([]);
                        }}
                        debts={pendingIOwe.map((debt) => ({
                          id: debt.id,
                          name: debt.debtor_name,
                          amount: debt.amount_owed,
                          detail: debt.transaction_detail || debt.detail || "Sin detalle",
                          onToggle: () =>
                            setDebtsIOweToSettle((prev) =>
                              toggleById(prev, { id: debt.id, debtorName: debt.debtor_name, amount: debt.amount_owed })
                            ),
                        }))}
                        selected={debtsIOweToSettle}
                        txAmount={effectiveAmount}
                        blur={isPrivacyMode}
                        confirmLabel="Saldar seleccionadas"
                        pending={settleDebtsIOwe.isPending}
                        onConfirm={async () => {
                          await settleDebtsIOwe.mutateAsync({
                            debts: debtsIOweToSettle.map((d) => ({ sharedExpenseId: d.id })),
                            existingTransactionId: editingTransaction.id,
                          });
                          closeComposer();
                        }}
                      />
                    )}

                    {txError && (
                      <p id="tx-error" role="alert" className="whisper-error">
                        {txError}
                      </p>
                    )}

                    <div className="whisper-actions">
                      <button
                        ref={txOptionsToggleRef}
                        type="button"
                        className="whisper-options-toggle"
                        aria-expanded={txExpanded}
                        onClick={() => setTxExpanded(!txExpanded)}
                      >
                        {txExpanded ? "Menos opciones" : "Más opciones"}
                        <ChevronDown size={12} className={cn(txExpanded && "rotate-180")} />
                      </button>
                      <button
                        type="submit"
                        className="whisper-submit"
                        // Se puede guardar sin tocar el monto.
                        disabled={updateTransaction.isPending}
                        aria-label="Guardar cambios"
                      >
                        Guardar cambios
                        <span className="hidden sm:inline" aria-hidden="true">↵</span>
                        <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
                      </button>
                    </div>
                    <p id="tx-shortcuts" className="whisper-shortcuts">
                      <span><kbd>Tab</kbd> tipo</span>
                      <span><kbd>↓</kbd> categorías</span>
                      <span><kbd>Esc</kbd> cerrar</span>
                    </p>
                  </form>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>

        <BankSyncModal
          open={isBankSyncOpen}
          onOpenChange={setIsBankSyncOpen}
          syncStep={bankSync.step}
          pollStatus={bankSync.pollStatus}
          result={bankSync.result}
          onStart={bankSync.startSync}
          onStartStored={bankSync.startSyncStored}
          onImportSkipped={bankSync.importSkipped}
          onDeleteImported={bankSync.deleteImported}
          onReset={bankSync.reset}
        />

        {/* Toolbar: una línea, ver TransactionsToolbar para el criterio */}
        <TransactionsToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchRef={searchInputRef}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          cardFilter={cardFilter}
          onCardFilterChange={setCardFilter}
          cards={creditCards.map((card) => ({
            id: card.id,
            label: `${card.name}${card.last_4_digits ? ` ···${card.last_4_digits}` : ""}`,
          }))}
          cardsLoading={isLoadingCards}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          categories={toolbarCategories}
          futureCount={futureTransactions.length}
          showFuture={showFuture}
          onToggleFuture={() => setShowFuture(!showFuture)}
          isSyncing={bankSync.isRunning}
          onSync={() => setIsBankSyncOpen(true)}
          onExport={handleExportCSV}
        />

        <TransactionsTable
          transactions={showFuture ? [...transactions, ...futureTransactions] : transactions}
          categories={categories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpdateSilent={async (id, updates) => {
            await updateTransactionSilent.mutateAsync({ id, ...updates });
          }}
          onDeleteMultiple={handleDeleteMultiple}
          onUpdateMultiple={async (ids, updates) => {
            await updateMultipleTransactions.mutateAsync({ ids, updates });
          }}
          onDuplicate={async (ids) => {
            await duplicateTransactions.mutateAsync(ids);
          }}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          cardFilter={cardFilter}
          onCardFilterChange={setCardFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          highlightId={highlightId}
        />
      </div>

      <SharedExpenseDrawer
        open={sharedDrawerOpen}
        onOpenChange={setSharedDrawerOpen}
        totalAmount={pendingTransaction?.amount || 0}
        onConfirm={handleSharedExpenseConfirm}
        suggestions={uniqueDebtorNames("they_owe_me")}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (open) return;
          armEditGuard();
          setDeleteId(null);
        }}
        onConfirm={() => deleteId && deleteTransaction.mutateAsync(deleteId)}
        title="¿Eliminar transacción?"
        description="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
      >
        {deleteId && (() => {
          const tx = transactions.find(t => t.id === deleteId);
          if (!tx) return null;
          return (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{tx.detail || "Sin detalle"}</span>
                <span className={cn(
                  "font-bold font-mono tabular-nums",
                  typeAmountColors[tx.type] ?? "text-rose-500"
                )}>
                  {formatCurrency(tx.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{tx.category_name}</span>
                <span>{format(new Date(tx.date), "dd/MM/yyyy")}</span>
              </div>
            </div>
          );
        })()}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteIds.length > 0}
        onOpenChange={(open) => {
          if (open) return;
          armEditGuard();
          setDeleteIds([]);
        }}
        onConfirm={() => deleteMultipleTransactions.mutateAsync(deleteIds)}
        title={`¿Eliminar ${deleteIds.length} transacciones?`}
        description="Esta acción eliminará las transacciones seleccionadas. Podrás deshacerlo desde el toast de confirmación."
        confirmText={`Eliminar ${deleteIds.length}`}
        cancelText="Cancelar"
        variant="destructive"
      />
      <AlertDialog open={!!confirmPaid} onOpenChange={() => setConfirmPaid(null)}>
        <AlertDialogContent
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleMarkAsPaid();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará automáticamente un reembolso de{" "}
              <span className="font-bold">
                ${confirmPaid && new Intl.NumberFormat("es-CL").format(confirmPaid.amount)}
              </span>{" "}
              por el pago de <span className="font-bold">{confirmPaid?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAsPaid}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
