import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryOptions } from "@/hooks/useCategoryOptions";
import { useSharedExpenses, type SharedExpense } from "@/hooks/useSharedExpenses";
import { getCleanDetail, WHISPER_TYPES } from "@/lib/whisper";
import { toLocalInput } from "@/lib/format";
import { cardPaymentOption } from "@/lib/category-options";
import { allowsNegativeAmount, type TransactionType } from "@/lib/ledger";

const LOSS_ACCENT = "oklch(var(--destructive))";
const TOP_CATEGORIES = 5;

export const NEW_CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#10b981", "#14b8a6", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#64748b",
];

const EMPTY_FORM = {
  date: "",
  value: "",
  category_name: "",
  type: "Gasto" as TransactionType,
  card_id: null as string | null,
  isLoss: false,
};

export type TxForm = typeof EMPTY_FORM;
export type NewCategoryDraft = { name: string; icon: string; color: string };
type DebtToLink = { id: string; debtorName: string; amount: number; transactionDetail?: string };
type DebtIOwe = { id: string; debtorName: string; amount: number };
type PaidConfirmation = { id: string; name: string; amount: number; detail?: string };

const freshForm = (): TxForm => ({ ...EMPTY_FORM, date: toLocalInput(new Date()) });

const toggleById = <T extends { id: string }>(list: T[], item: T) =>
  list.some((d) => d.id === item.id) ? list.filter((d) => d.id !== item.id) : [...list, item];

export function useTxEditor() {
  const { updateTransaction } = useTransactions();
  const { addCategory } = useCategories();
  const categoryOptions = useCategoryOptions();
  const {
    addSharedExpenses,
    getSharedExpensesByTransaction,
    markAsPaid,
    linkExistingTransactionToDebts,
    settleDebtsIOwe,
    sharedExpenses,
    sharedExpensesWithTransaction,
    uniqueDebtorNames,
  } = useSharedExpenses();

  const [isOpen, setIsOpen] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [form, setForm] = useState(freshForm);
  const [detailText, setDetailText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [newCategory, setNewCategory] = useState<NewCategoryDraft | null>(null);
  const [error, setError] = useState("");
  const [debtsToLink, setDebtsToLink] = useState<DebtToLink[]>([]);
  const [debtsIOweToSettle, setDebtsIOweToSettle] = useState<DebtIOwe[]>([]);
  const [settleDebtToggle, setSettleDebtToggle] = useState(false);
  const [paidConfirmation, setPaidConfirmation] = useState<PaidConfirmation | null>(null);
  const [splitTarget, setSplitTarget] = useState<{ id: string; amount: number } | null>(null);
  const [splitDrawerOpen, setSplitDrawerOpen] = useState(false);

  const editingMagnitude = transaction ? Math.abs(transaction.amount) : 0;
  const effectiveAmount = Number(form.value.replace(/\D/g, "")) || editingMagnitude;
  const composerType = WHISPER_TYPES.find((t) => t.type === form.type) ?? WHISPER_TYPES[0];
  const accent = form.type === "Rendimiento" && form.isLoss ? LOSS_ACCENT : composerType.color;

  const availableCategories = categoryOptions(form.type);
  const visibleCategories = useMemo(() => {
    const top = showAllCategories ? availableCategories : availableCategories.slice(0, TOP_CATEGORIES);
    const current = availableCategories.find((c) => c.name === form.category_name);
    const shown = current && !top.includes(current) ? [...top, current] : top;
    const cardPayment = cardPaymentOption(availableCategories, form.type);
    return cardPayment && !shown.includes(cardPayment) ? [...shown, cardPayment] : shown;
  }, [availableCategories, showAllCategories, form.category_name, form.type]);
  const hasMoreCategories = availableCategories.length > TOP_CATEGORIES;

  const existingShared: SharedExpense[] = transaction ? getSharedExpensesByTransaction(transaction.id) : [];
  const pendingDebts = sharedExpensesWithTransaction.filter((se) => !se.paid && se.direction === "they_owe_me");
  const pendingIOwe = sharedExpensesWithTransaction.filter((se) => !se.paid && se.direction === "i_owe_them");
  const alreadyLinked = !!transaction && sharedExpenses.some((se) => se.paid_transaction_id === transaction.id);
  const showLinkPanel = (form.type === "Ingreso" || form.type === "Reembolso") && !alreadyLinked && pendingDebts.length > 0;
  const showSettlePanel = form.type === "Gasto" && settleDebtToggle && pendingIOwe.length > 0;
  const canSettleDebt = form.type === "Gasto" && pendingIOwe.length > 0;
  const canSplit = form.type === "Gasto" && existingShared.length === 0;
  const showSharedPanel = form.type === "Gasto" && existingShared.length > 0;

  const patchForm = (values: Partial<TxForm>) => setForm((prev) => ({ ...prev, ...values }));

  const resetForm = () => {
    setForm(freshForm());
    setExpanded(false);
    setShowAllCategories(false);
    setNewCategory(null);
    setError("");
    setDetailText("");
    setSplitTarget(null);
    setDebtsToLink([]);
    setDebtsIOweToSettle([]);
    setSettleDebtToggle(false);
  };

  const open = (tx: Transaction) => {
    setTransaction(tx);
    setForm({
      ...EMPTY_FORM,
      value: String(Math.abs(tx.amount)),
      date: toLocalInput(new Date(tx.date)),
      category_name: tx.category_name,
      type: tx.type,
      card_id: tx.card_id,
      isLoss: tx.amount < 0,
    });
    setDetailText(getCleanDetail(tx.detail));
    setExpanded(false);
    setError("");
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    resetForm();
  };

  const onOpenChange = (next: boolean) => {
    setIsOpen(next);
    if (!next) resetForm();
  };

  const changeType = (type: TransactionType) => {
    patchForm({ type, category_name: "" });
    if (type !== "Ingreso" && type !== "Reembolso") setDebtsToLink([]);
    if (type !== "Gasto") setDebtsIOweToSettle([]);
    setShowAllCategories(false);
    setNewCategory(null);
    setError("");
  };

  const changeAmount = (value: string) => {
    patchForm({ value: value.replace(/\D/g, "") });
    setError("");
  };

  const saveEdit = (overrides: Partial<TxForm> = {}, { split = false } = {}) => {
    if (!transaction || updateTransaction.isPending) return;
    const data = { ...form, ...overrides };
    if (!data.date || !Number.isFinite(new Date(data.date).getTime())) {
      setExpanded(true);
      setError("Elige una fecha válida.");
      return;
    }

    const amount = allowsNegativeAmount(data.type) && data.isLoss ? -effectiveAmount : effectiveAmount;
    const prefix = (transaction.detail || "").startsWith("🤖") ? "🤖 " : "";
    const newDetail = detailText.trim();
    const detailChanged = !!newDetail && newDetail !== getCleanDetail(transaction.detail);

    const transactionId = transaction.id;
    updateTransaction.mutate(
      {
        id: transactionId,
        category_name: data.category_name,
        type: data.type,
        card_id: data.card_id,
        ...(detailChanged ? { detail: prefix + newDetail } : {}),
        date: new Date(data.date).toISOString(),
        amount,
      },
      {
        onSuccess: () => {
          if (!split) {
            close();
            return;
          }
          setSplitTarget({ id: transactionId, amount });
          setIsOpen(false);
          setSplitDrawerOpen(true);
        },
      },
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    saveEdit();
  };

  const startNewCategory = () => setNewCategory({ name: "", icon: "🏷️", color: NEW_CATEGORY_COLORS[0] });

  const createCategory = () => {
    if (!newCategory || !newCategory.name.trim()) return;
    const name = newCategory.name.trim();
    addCategory.mutate(
      { name, type: form.type, color: newCategory.color, icon: newCategory.icon || "🏷️" },
      {
        onSuccess: () => {
          setNewCategory(null);
          saveEdit({ category_name: name });
        },
      },
    );
  };

  const toggleDebtToLink = (debt: DebtToLink) => setDebtsToLink((prev) => toggleById(prev, debt));
  const toggleDebtIOwe = (debt: DebtIOwe) => setDebtsIOweToSettle((prev) => toggleById(prev, debt));

  const changeSettleDebtToggle = (checked: boolean) => {
    setSettleDebtToggle(checked);
    if (!checked) setDebtsIOweToSettle([]);
  };

  const linkDebts = () => {
    if (!transaction) return;
    linkExistingTransactionToDebts.mutate(
      {
        debts: debtsToLink.map((d) => ({
          sharedExpenseId: d.id,
          amount: d.amount,
          debtorName: d.debtorName,
          transactionDetail: d.transactionDetail,
        })),
        existingTransactionId: transaction.id,
      },
      { onSuccess: close },
    );
  };

  const settleDebts = () => {
    if (!transaction) return;
    settleDebtsIOwe.mutate(
      {
        debts: debtsIOweToSettle.map((d) => ({ sharedExpenseId: d.id })),
        existingTransactionId: transaction.id,
      },
      { onSuccess: close },
    );
  };

  const confirmMarkAsPaid = () => {
    if (!paidConfirmation) return;
    const paid = paidConfirmation;
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
          if (reducedAmount >= 0) patchForm({ value: String(reducedAmount) });
          setPaidConfirmation(null);
        },
      },
    );
  };

  const confirmSplit = (debtors: Array<{ name: string; amount: number }>) => {
    if (!splitTarget) return;
    addSharedExpenses.mutate(
      debtors.map((d) => ({
        transaction_id: splitTarget.id,
        debtor_name: d.name,
        amount_owed: d.amount,
        detail: null,
      })),
      {
        onSuccess: () => toast.success(`Gasto compartido dividido entre ${debtors.length} persona${debtors.length > 1 ? "s" : ""}`),
        onSettled: resetForm,
      },
    );
  };

  return {
    isOpen,
    onOpenChange,
    open,
    close,
    transaction,
    form,
    patchForm,
    detailText,
    setDetailText,
    expanded,
    toggleExpanded: () => setExpanded((prev) => !prev),
    error,
    accent,
    effectiveAmount,
    isSaving: updateTransaction.isPending,
    changeType,
    changeAmount,
    saveEdit,
    submit,
    categories: {
      visible: visibleCategories,
      available: availableCategories,
      hasMore: hasMoreCategories,
      showAll: showAllCategories,
      toggleShowAll: () => setShowAllCategories((prev) => !prev),
    },
    newCategory: {
      draft: newCategory,
      start: startNewCategory,
      update: setNewCategory,
      cancel: () => setNewCategory(null),
      create: createCategory,
      isCreating: addCategory.isPending,
    },
    debts: {
      pendingDebts,
      pendingIOwe,
      debtsToLink,
      debtsIOweToSettle,
      toggleDebtToLink,
      toggleDebtIOwe,
      showLinkPanel,
      showSettlePanel,
      canSettleDebt,
      settleDebtToggle,
      changeSettleDebtToggle,
      linkDebts,
      linkPending: linkExistingTransactionToDebts.isPending,
      settleDebts,
      settlePending: settleDebtsIOwe.isPending,
    },
    shared: {
      existing: existingShared,
      canSplit,
      showPanel: showSharedPanel,
      startSplit: () => saveEdit({}, { split: true }),
      splitDrawerOpen,
      setSplitDrawerOpen,
      splitAmount: splitTarget?.amount || 0,
      confirmSplit,
      debtorSuggestions: uniqueDebtorNames("they_owe_me"),
    },
    paid: {
      confirmation: paidConfirmation,
      request: setPaidConfirmation,
      cancel: () => setPaidConfirmation(null),
      confirm: confirmMarkAsPaid,
    },
  };
}

export type TxEditorState = ReturnType<typeof useTxEditor>;
