import { useState, useMemo, useRef } from "react";
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
import { categoryFrequency, getCleanDetail, WHISPER_TYPES } from "@/lib/whisper";
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
import { Plus, X, Trash2, Users, CheckCircle2, Check, Clock, Pencil, ChevronDown } from "lucide-react";
import { es } from "date-fns/locale";
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
import {
  TransactionType,
  allowsNegativeAmount,
  CARD_PAYMENT_CATEGORY,
  CARD_PAYMENT_ICON,
  isCardPaymentCategory,
} from "@/lib/ledger";

// ── Editor de movimientos: corregir la categoría es un toque ──

/** Colores para una categoría nueva creada desde el composer. */
const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#10b981", "#14b8a6", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#64748b",
];

const LOSS_ACCENT = "oklch(var(--destructive))";

/** Un instante como valor de <input type="datetime-local">, en hora local. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount);

const EMPTY_FORM = {
  // Fecha y hora como valor de datetime-local, en hora local.
  date: "",
  // El monto, solo dígitos; vacío deja el guardado.
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
    deleteTransactions,
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
  // Modo selección: los checkboxes y las acciones masivas aparecen a pedido.
  const [selecting, setSelecting] = useState(false);
  const [pageSize, setPageSize] = useState(100);

  // El composer solo edita: los movimientos nuevos entran por el QuickAdd global.
  // editingTransaction queda puesto al cerrar, así el fade de salida no cambia de modo.
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  // El editor: detalles (monto, fecha, cuenta) abiertos, todas las categorías, categoría nueva en línea, error.
  const [txExpanded, setTxExpanded] = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const [newCategory, setNewCategory] = useState<{ name: string; icon: string; color: string } | null>(null);
  const [txError, setTxError] = useState("");
  // El nombre del movimiento, editable en el título. Si no cambia, el detail guardado queda intacto.
  const [detailText, setDetailText] = useState("");
  const [sharedDrawerOpen, setSharedDrawerOpen] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{ id: string; amount: number } | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<{ id: string; name: string; amount: number; detail?: string } | null>(null);
  // Gasto ya dividido: la persona que se está agregando, o la deuda cuyo monto se edita.
  const [newDebtor, setNewDebtor] = useState<{ name: string; amount: string } | null>(null);
  const [editingDebtor, setEditingDebtor] = useState<{ id: string; amount: string } | null>(null);
  const [debtsToLink, setDebtsToLink] = useState<Array<{ id: string; debtorName: string; amount: number; transactionDetail?: string }>>([]);
  const [debtsIOweToSettle, setDebtsIOweToSettle] = useState<Array<{ id: string; debtorName: string; amount: number }>>([]);
  const [settleDebtToggle, setSettleDebtToggle] = useState(false);
  // Deudas enlaza aquí con ?search=<detalle> para encontrar el gasto que originó la deuda.
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchFocusShortcut(searchInputRef);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cardFilter, setCardFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});

  // Lo que espera confirmación para eliminarse: un id, o los de la selección.
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [formData, setFormData] = useState(() => ({ ...EMPTY_FORM, date: toLocalInput(new Date()) }));
  // El monto: lo escrito en "Monto", o el guardado si el campo queda vacío.
  const editingMagnitude = editingTransaction ? Math.abs(editingTransaction.amount) : 0;
  const effectiveAmount = Number(formData.value.replace(/\D/g, "")) || editingMagnitude;
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
  // "Pago de tarjeta" es una categoría del sistema: no vive en la tabla, pero
  // se elige acá para marcar a mano un pago que la importación no reconoció.
  // Siempre a la vista en Gasto e Ingreso; si alguien ya tiene la suya ("Pago
  // Tarjeta"), se ofrece esa.
  const cardPaymentOption = useMemo(() => {
    if (formData.type !== "Gasto" && formData.type !== "Ingreso") return null;
    const own = availableCategories.find((c) => isCardPaymentCategory(c.name));
    return own ?? {
      id: "system-card-payment",
      name: CARD_PAYMENT_CATEGORY,
      type: formData.type,
      icon: CARD_PAYMENT_ICON,
      color: null,
      user_id: "",
      created_at: "",
    };
  }, [availableCategories, formData.type]);
  const visibleCategories = useMemo(() => {
    const top = allCategories ? availableCategories : availableCategories.slice(0, 5);
    // La categoría del movimiento que se edita siempre se ve, aunque no sea de las frecuentes.
    const current = availableCategories.find((c) => c.name === formData.category_name);
    const shown = current && !top.includes(current) ? [...top, current] : top;
    return cardPaymentOption && !shown.includes(cardPaymentOption) ? [...shown, cardPaymentOption] : shown;
  }, [availableCategories, allCategories, formData.category_name, cardPaymentOption]);

  const changeType = (type: TransactionType) => {
    setFormData((prev) => ({ ...prev, type, category_name: "" }));
    if (type !== "Ingreso" && type !== "Reembolso") setDebtsToLink([]);
    if (type !== "Gasto") setDebtsIOweToSettle([]);
    setAllCategories(false);
    setNewCategory(null);
    setTxError("");
  };

  const createCategory = () => {
    if (!newCategory || !newCategory.name.trim()) return;
    const name = newCategory.name.trim();
    addCategory.mutate(
      { name, type: formData.type, color: newCategory.color, icon: newCategory.icon || "🏷️" },
      {
        onSuccess: () => {
          setNewCategory(null);
          saveEdit({ category_name: name });
        },
      },
    );
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

  /** Guarda el movimiento. `overrides` permite guardar al tocar una categoría,
   *  y `split` abre el reparto del gasto compartido después de guardar. */
  const saveEdit = (overrides: Partial<typeof formData> = {}, { split = false } = {}) => {
    if (!editingTransaction || updateTransaction.isPending) return;
    const data = { ...formData, ...overrides };
    if (!data.date || !Number.isFinite(new Date(data.date).getTime())) {
      setTxExpanded(true);
      setTxError("Elige una fecha válida.");
      return;
    }

    // Un rendimiento negativo es un mes malo, no un error: el resto de los
    // tipos siempre va en positivo.
    const amount = allowsNegativeAmount(data.type) && data.isLoss ? -effectiveAmount : effectiveAmount;
    // El badge del bot sobrevive a que le cambies el nombre, igual que en la
    // edición inline de la tabla. Un nombre vacío no borra el guardado.
    const prefix = (editingTransaction.detail || "").startsWith("🤖") ? "🤖 " : "";
    const newDetail = detailText.trim();
    const detailChanged = !!newDetail && newDetail !== getCleanDetail(editingTransaction.detail);

    updateTransaction.mutate({
      id: editingTransaction.id,
      category_name: data.category_name,
      type: data.type,
      card_id: data.card_id,
      ...(detailChanged ? { detail: prefix + newDetail } : {}),
      date: new Date(data.date).toISOString(),
      amount,
    });

    if (split) {
      setPendingTransaction({ id: editingTransaction.id, amount });
      setIsDialogOpen(false);
      setSharedDrawerOpen(true);
      return;
    }

    closeComposer();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveEdit();
  };

  const handleSharedExpenseConfirm = (debtors: Array<{ name: string; amount: number }>) => {
    if (!pendingTransaction) return;
    addSharedExpenses.mutate(
      debtors.map((d) => ({
        transaction_id: pendingTransaction.id,
        debtor_name: d.name,
        amount_owed: d.amount,
        detail: null,
      })),
      {
        onSuccess: () => {
          toast.success(`Gasto compartido dividido entre ${debtors.length} persona${debtors.length > 1 ? "s" : ""}`);
          resetForm();
        },
      },
    );
  };

  const handleMarkAsPaid = () => {
    if (!confirmPaid) return;
    const paid = confirmPaid;
    markAsPaid.mutate(
      {
        sharedExpenseId: paid.id,
        debtorName: paid.name,
        amount: paid.amount,
        transactionDetail: paid.detail,
      },
      {
        onSuccess: () => {
          const reducedAmount = effectiveAmount - paid.amount;
          if (reducedAmount >= 0) setFormData((prev) => ({ ...prev, value: String(reducedAmount) }));
          setConfirmPaid(null);
        },
      },
    );
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM, date: toLocalInput(new Date()) });
    setTxExpanded(false);
    setAllCategories(false);
    setNewCategory(null);
    setTxError("");
    setDetailText("");
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

    setFormData({
      ...EMPTY_FORM,
      value: String(Math.abs(transaction.amount)),
      date: toLocalInput(new Date(transaction.date)),
      category_name: transaction.category_name,
      type: transaction.type,
      card_id: transaction.card_id,
      isLoss: transaction.amount < 0,
    });
    setDetailText(getCleanDetail(transaction.detail));
    // Monto, fecha y cuenta casi nunca cambian: parten cerrados.
    setTxExpanded(false);
    setTxError("");

    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    armEditGuard();
    setDeleteId(id);
  };

  const handleDeleteMultiple = (ids: string[]) => {
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
          <h1 className="text-xl font-medium">Movimientos</h1>
          {/* Casi todo llega solo: anotar a mano es secundario */}
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => useGlobalDrawers.getState().openQuickAdd("Gasto")} aria-label="Agregar movimiento">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Agregar</span>
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
                  // Sin foco automático: en el celular no abre el teclado.
                  onOpenAutoFocus={(event) => event.preventDefault()}
                >
                  <Dialog.Title className="sr-only">Editar movimiento</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Toca una categoría para corregirla y guardar. El nombre se edita en el título; monto, fecha y cuenta, en detalles.
                  </Dialog.Description>
                  <Dialog.Close className="whisper-close" aria-label="Cerrar">
                    <X size={16} />
                  </Dialog.Close>

                  <form id="transaction-form" onSubmit={handleSubmit} className="whisper-form edit-tx">
                    {/* Tipo */}
                    <div className="whisper-type">
                      <span className="whisper-dot" aria-hidden="true" />
                      <span aria-hidden="true">{formData.type}</span>
                      <select
                        aria-label="Tipo de movimiento"
                        value={formData.type}
                        onChange={(event) => changeType(event.target.value as TransactionType)}
                      >
                        {WHISPER_TYPES.map((t) => (
                          <option key={t.type}>{t.type}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} aria-hidden="true" />
                    </div>

                    {/* Qué movimiento es: el nombre (editable) y una línea con monto, fecha y cuenta */}
                    <div className="edit-tx-head">
                      <input
                        aria-label="Nombre del movimiento"
                        className={cn("edit-tx-title", isPrivacyMode && "privacy-blur")}
                        autoComplete="off"
                        maxLength={200}
                        value={detailText}
                        placeholder={editingTransaction.bank_description || "Sin nombre"}
                        onChange={(event) => setDetailText(event.target.value)}
                      />
                      <p className="edit-tx-meta">
                        <b className={cn(isPrivacyMode && "privacy-blur")}>
                          {formData.type === "Rendimiento" && formData.isLoss ? "−" : ""}
                          {formatCurrency(effectiveAmount)}
                        </b>
                        {Number.isFinite(new Date(formData.date).getTime()) && (
                          <span>{format(new Date(formData.date), "d MMM, HH:mm", { locale: es })}</span>
                        )}
                        {(() => {
                          const card = creditCards.find((c) => c.id === formData.card_id);
                          return card ? <span>{card.name}{card.last_4_digits ? ` ···${card.last_4_digits}` : ""}</span> : null;
                        })()}
                      </p>
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
                        <div className="whisper-categories" role="group" aria-label="Categoría (tocar guarda)">
                          {visibleCategories.map((category) => (
                            <button
                              key={category.id}
                              type="button"
                              className="whisper-category"
                              aria-pressed={formData.category_name === category.name}
                              disabled={updateTransaction.isPending}
                              // Corregir la categoría es la acción principal: un toque guarda y cierra.
                              onClick={() => saveEdit({ category_name: category.name })}
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
                              {allCategories ? "Menos" : `Ver todas (${availableCategories.length})`}
                            </button>
                          )}
                          {(allCategories || availableCategories.length <= 5) && (
                            <button
                              type="button"
                              className="whisper-more-categories"
                              onClick={() => setNewCategory({ name: "", icon: "🏷️", color: CATEGORY_COLORS[0] })}
                            >
                              <Plus size={11} aria-hidden="true" /> Nueva
                            </button>
                          )}
                        </div>
                      )}

                    </div>

                    {/* Gasto compartido: guarda y abre el reparto */}
                    {formData.type === "Gasto" && existingShared.length === 0 && (
                      <button
                        type="button"
                        className="whisper-more-categories edit-tx-split"
                        disabled={updateTransaction.isPending}
                        onClick={() => saveEdit({}, { split: true })}
                      >
                        <Users size={12} aria-hidden="true" /> Dividir gasto
                      </button>
                    )}

                    {/* Detalles: monto, fecha y cuenta. Casi nunca cambian, parten cerrados. */}
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
                            Monto
                            <input
                              inputMode="numeric"
                              aria-label="Monto"
                              className={cn(isPrivacyMode && "privacy-blur")}
                              value={formData.value}
                              onChange={(event) => {
                                setFormData((prev) => ({ ...prev, value: event.target.value.replace(/\D/g, "") }));
                                setTxError("");
                              }}
                            />
                          </label>
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
                                <option value="">Sin tarjeta</option>
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
                        onConfirm={() =>
                          linkExistingTransactionToDebts.mutate(
                            {
                              debts: debtsToLink.map((d) => ({
                                sharedExpenseId: d.id,
                                amount: d.amount,
                                debtorName: d.debtorName,
                                transactionDetail: d.transactionDetail,
                              })),
                              existingTransactionId: editingTransaction.id,
                            },
                            { onSuccess: closeComposer },
                          )
                        }
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
                            const saveAmount = () =>
                              updateSharedExpenseAmount.mutate(
                                { id: se.id, amount_owed: editAmount },
                                { onSuccess: () => setEditingDebtor(null) },
                              );

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
                                  onClick={() =>
                                    addSharedExpenses.mutate(
                                      [{
                                        transaction_id: editingTransaction.id,
                                        debtor_name: newDebtor.name.trim(),
                                        amount_owed: newAmount,
                                        detail: null,
                                      }],
                                      { onSuccess: () => setNewDebtor(null) },
                                    )
                                  }
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
                        onConfirm={() =>
                          settleDebtsIOwe.mutate(
                            {
                              debts: debtsIOweToSettle.map((d) => ({ sharedExpenseId: d.id })),
                              existingTransactionId: editingTransaction.id,
                            },
                            { onSuccess: closeComposer },
                          )
                        }
                      />
                    )}

                    {txError && (
                      <p id="tx-error" role="alert" className="whisper-error">
                        {txError}
                      </p>
                    )}

                    <div className="whisper-actions">
                      <button
                        type="button"
                        className="whisper-options-toggle"
                        aria-expanded={txExpanded}
                        onClick={() => setTxExpanded(!txExpanded)}
                      >
                        {txExpanded ? "Ocultar detalles" : "Monto, fecha y cuenta"}
                        <ChevronDown size={12} className={cn(txExpanded && "rotate-180")} />
                      </button>
                      <button type="submit" className="whisper-submit" disabled={updateTransaction.isPending}>
                        Guardar
                      </button>
                    </div>
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
          selecting={selecting}
          onSelectingChange={setSelecting}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <TransactionsTable
          transactions={showFuture ? [...transactions, ...futureTransactions] : transactions}
          categories={categories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpdateSilent={(id, updates) => updateTransaction.mutate({ id, ...updates })}
          onDeleteMultiple={handleDeleteMultiple}
          onUpdateMultiple={(ids, updates) => updateMultipleTransactions.mutate({ ids, updates })}
          onDuplicate={(ids) => duplicateTransactions.mutate(ids)}
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
          selecting={selecting}
          onSelectingChange={setSelecting}
          pageSize={pageSize}
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
        onConfirm={() => deleteId && deleteTransactions.mutate([deleteId])}
        title="¿Eliminar transacción?"
        description="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
      >
        {deleteId && (() => {
          const tx = transactions.find(t => t.id === deleteId);
          if (!tx) return null;
          return (
            <div className="rounded-card border p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{tx.detail || "Sin detalle"}</span>
                <span className={cn(
                  "font-medium font-mono tabular-nums",
                  typeAmountColors[tx.type]
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
        onConfirm={() => deleteTransactions.mutate(deleteIds)}
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
              <span className="font-medium">
                ${confirmPaid && new Intl.NumberFormat("es-CL").format(confirmPaid.amount)}
              </span>{" "}
              por el pago de <span className="font-medium">{confirmPaid?.name}</span>.
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
