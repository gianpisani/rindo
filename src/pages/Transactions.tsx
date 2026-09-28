import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ImportCSVModal } from "@/components/ImportCSVModal";
import { TransactionsTable, getCategoryIcon } from "@/components/TransactionsTable";
import { TransactionsToolbar } from "@/components/TransactionsToolbar";
import { Button } from "@/components/ui/button";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { categoryFrequency, parseWhisper, WHISPER_TYPES } from "@/lib/whisper";
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
import { format, parse } from "date-fns";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DateRangeValue } from "@/components/DateRangeFilter";
import { TransactionType, TRANSACTION_TYPES, allowsNegativeAmount } from "@/lib/ledger";

// ── Editor de movimientos: el composer del Whisper con el texto precargado ──

/** El color del monto en el diálogo de eliminar, por tipo. */
const AMOUNT_TEXT: Record<TransactionType, string> = {
  Gasto: "text-rose-500",
  Ingreso: "text-emerald-500",
  Inversión: "text-blue-500",
  Rescate: "text-cyan-500",
  Rendimiento: "text-violet-500",
  Reembolso: "text-amber-500",
};

/** Colores para una categoría nueva creada desde el composer. */
const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#10b981", "#14b8a6", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#64748b",
];

const LOSS_ACCENT = "#f87171";

/** Un instante como valor de <input type="datetime-local">, en hora local. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function Transactions() {
  const {
    transactions,
    futureTransactions,
    allTransactions,
    addTransaction,
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // El composer: opciones abiertas, todas las categorías, categoría nueva en línea, error.
  const [txExpanded, setTxExpanded] = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const [newCategory, setNewCategory] = useState<{ name: string; icon: string; color: string } | null>(null);
  const [txError, setTxError] = useState("");
  const txInputRef = useRef<HTMLInputElement>(null);
  const txCategoryGroupRef = useRef<HTMLDivElement>(null);
  const txOptionsToggleRef = useRef<HTMLButtonElement>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [sharedDrawerOpen, setSharedDrawerOpen] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{ id: string; amount: number } | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<{ id: string; name: string; amount: number; detail?: string } | null>(null);
  const [addingDebtor, setAddingDebtor] = useState(false);
  const [newDebtorName, setNewDebtorName] = useState("");
  const [newDebtorAmount, setNewDebtorAmount] = useState("");
  const [editingDebtorId, setEditingDebtorId] = useState<string | null>(null);
  const [editingDebtorAmount, setEditingDebtorAmount] = useState("");
  const [debtsToLink, setDebtsToLink] = useState<Array<{ id: string; debtorName: string; amount: number; transactionDetail?: string }>>([]);
  const [debtsIOweToSettle, setDebtsIOweToSettle] = useState<Array<{ id: string; debtorName: string; amount: number }>>([]);
  const [settleDebtToggle, setSettleDebtToggle] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [confirmDeleteMultiple, setConfirmDeleteMultiple] = useState<{ open: boolean; ids: string[] }>({
    open: false,
    ids: [],
  });
  const [formData, setFormData] = useState({
    // Fecha y hora como valor de datetime-local, en hora local.
    date: toLocalInput(new Date()),
    // "monto detalle" en una línea, como en el Whisper.
    value: "",
    category_name: "",
    type: "Gasto" as TransactionType,
    card_id: null as string | null,
    // Solo aplica al rendimiento, el único tipo que puede ser negativo.
    isLoss: false,
  });
  const parsedDraft = parseWhisper(formData.value);
  const draftAmount = parsedDraft?.amount ?? 0;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parsedDraft) {
      setTxError("Escribe un monto en pesos, seguido del detalle.");
      txInputRef.current?.focus();
      return;
    }
    if (!formData.date || !Number.isFinite(new Date(formData.date).getTime())) {
      setTxExpanded(true);
      setTxError("Elige una fecha válida.");
      return;
    }

    const magnitude = parsedDraft.amount;
    // Un rendimiento negativo es un mes malo, no un error: el resto de los
    // tipos siempre va en positivo.
    const parsedAmount =
      allowsNegativeAmount(formData.type) && formData.isLoss ? -magnitude : magnitude;
    const fields = {
      detail: parsedDraft.detail ?? "",
      category_name: formData.category_name,
      type: formData.type,
      card_id: formData.card_id,
    };

    if (editingTransaction) {
      await updateTransaction.mutateAsync({
        id: editingTransaction.id,
        ...fields,
        date: new Date(formData.date).toISOString(),
        amount: parsedAmount,
      });

      const existingShared = getSharedExpensesByTransaction(editingTransaction.id);
      if (isShared && formData.type === "Gasto" && existingShared.length === 0) {
        setPendingTransaction({ id: editingTransaction.id, amount: parsedAmount });
        setIsDialogOpen(false);
        setSharedDrawerOpen(true);
        return;
      }
    } else {
      const transaction = await addTransaction.mutateAsync({
        ...fields,
        date: new Date(formData.date).toISOString(),
        amount: parsedAmount,
      });

      if (debtsToLink.length > 0 && transaction?.id) {
        await linkExistingTransactionToDebts.mutateAsync({
          debts: debtsToLink.map((d) => ({
            sharedExpenseId: d.id,
            amount: d.amount,
            debtorName: d.debtorName,
            transactionDetail: d.transactionDetail,
          })),
          existingTransactionId: transaction.id,
        });
      } else if (debtsIOweToSettle.length > 0 && transaction?.id) {
        await settleDebtsIOwe.mutateAsync({
          debts: debtsIOweToSettle.map((d) => ({ sharedExpenseId: d.id })),
          existingTransactionId: transaction.id,
        });
      } else if (isShared && formData.type === "Gasto" && transaction?.id) {
        setPendingTransaction({ id: transaction.id, amount: parsedAmount });
        setIsDialogOpen(false);
        setSharedDrawerOpen(true);
        return;
      }
    }

    setIsDialogOpen(false);
    setEditingTransaction(null);
    resetForm();
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
    setEditingTransaction(null);
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
    // Actualizar el texto para que "Guardar cambios" no sobreescriba el monto reducido
    const newAmount = draftAmount - confirmPaid.amount;
    if (newAmount >= 0) {
      const detail = parsedDraft?.detail ?? "";
      setFormData((prev) => ({ ...prev, value: detail ? `${newAmount} ${detail}` : String(newAmount) }));
    }
    setConfirmPaid(null);
  };

  const resetForm = () => {
    setFormData({
      date: toLocalInput(new Date()),
      value: "",
      category_name: "",
      type: "Gasto",
      card_id: null,
      isLoss: false,
    });
    setTxExpanded(false);
    setAllCategories(false);
    setNewCategory(null);
    setTxError("");
    setIsShared(false);
    setPendingTransaction(null);
    setAddingDebtor(false);
    setNewDebtorName("");
    setNewDebtorAmount("");
    setEditingDebtorId(null);
    setEditingDebtorAmount("");
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
    if (confirmDelete.open || confirmDeleteMultiple.open) return;
    setEditingTransaction(transaction);
    const magnitude = Math.abs(transaction.amount);

    setFormData({
      date: toLocalInput(new Date(transaction.date)),
      value: transaction.detail ? `${magnitude} ${transaction.detail}` : String(magnitude),
      category_name: transaction.category_name,
      type: transaction.type,
      card_id: transaction.card_id,
      isLoss: transaction.amount < 0,
    });

    const shared = getSharedExpensesByTransaction(transaction.id);
    setIsShared(shared.length > 0);
    // Al editar, la fecha y la cuenta importan: las opciones parten abiertas.
    setTxExpanded(true);
    setTxError("");

    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    armEditGuard();
    setConfirmDelete({ open: true, id });
  };

  const confirmDeleteAction = async () => {
    if (confirmDelete.id) {
      await deleteTransaction.mutateAsync(confirmDelete.id);
    }
  };

  // Inline update handler (silent, no modal)
  const handleUpdateSilent = useCallback(async (id: string, updates: Partial<Transaction>) => {
    await updateTransactionSilent.mutateAsync({ id, ...updates });
  }, [updateTransactionSilent]);

  // Delete multiple handler
  const handleDeleteMultiple = useCallback(async (ids: string[]) => {
    armEditGuard();
    setConfirmDeleteMultiple({ open: true, ids });
  }, []);

  const confirmDeleteMultipleAction = async () => {
    if (confirmDeleteMultiple.ids.length > 0) {
      await deleteMultipleTransactions.mutateAsync(confirmDeleteMultiple.ids);
      setConfirmDeleteMultiple({ open: false, ids: [] });
    }
  };

  // Update multiple handler
  const handleUpdateMultiple = useCallback(async (ids: string[], updates: Partial<Pick<Transaction, "category_name" | "type">>) => {
    await updateMultipleTransactions.mutateAsync({ ids, updates });
  }, [updateMultipleTransactions]);

  // Duplicate handler
  const handleDuplicate = useCallback(async (ids: string[]) => {
    await duplicateTransactions.mutateAsync(ids);
  }, [duplicateTransactions]);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  const handleImportCSV = async (file: File) => {
    setIsImporting(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData.user) throw new Error("No user found");

          const rows = results.data as any[];
          
          if (rows.length === 0) {
            throw new Error("El archivo CSV está vacío");
          }

          const firstRow = rows[0];
          const requiredColumns = ["Fecha", "Categoría", "Tipo", "Monto"];
          const missingColumns = requiredColumns.filter(col => !(col in firstRow));
          
          if (missingColumns.length > 0) {
            throw new Error(`Faltan columnas requeridas: ${missingColumns.join(", ")}`);
          }

          let successCount = 0;
          let errorCount = 0;

          for (const row of rows) {
            try {
              if (!TRANSACTION_TYPES.includes(row.Tipo as TransactionType)) {
                console.error(`Tipo inválido en fila: ${row.Tipo}`);
                errorCount++;
                continue;
              }

              const dateParts = row.Fecha.split("/");
              if (dateParts.length !== 3) {
                console.error(`Formato de fecha inválido: ${row.Fecha}`);
                errorCount++;
                continue;
              }
              const parsedDate = parse(row.Fecha, "dd/MM/yyyy", new Date());
              
              const amountStr = row.Monto.toString().replace(/[$.\s]/g, "").replace(",", ".");
              const amount = Math.abs(parseFloat(amountStr));

              if (isNaN(amount) || amount <= 0) {
                console.error(`Monto inválido: ${row.Monto}`);
                errorCount++;
                continue;
              }

              // Un rendimiento importado en negativo es una pérdida, y se
              // guarda con signo: el resto de los tipos va siempre positivo.
              const isNegative = /^\s*-/.test(row.Monto.toString());
              const signedAmount =
                row.Tipo === "Rendimiento" && isNegative ? -amount : amount;

              const categoryExists = categories.find(
                cat => cat.name === row.Categoría && cat.type === row.Tipo
              );

              if (!categoryExists) {
                const colors: Record<string, string> = {
                  Ingreso: "#10b981",
                  Gasto: "#ef4444",
                  Inversión: "#3b82f6",
                  Rescate: "#06b6d4",
                  Rendimiento: "#8b5cf6",
                  Reembolso: "#f59e0b",
                };

                const { error: catError } = await supabase
                  .from("categories")
                  .insert({
                    name: row.Categoría,
                    type: row.Tipo,
                    color: colors[row.Tipo],
                    user_id: userData.user.id,
                  });

                if (catError) {
                  console.error("Error creando categoría:", catError);
                  errorCount++;
                  continue;
                }
              }

              const { error: txError } = await supabase
                .from("transactions")
                .insert({
                  date: format(parsedDate, "yyyy-MM-dd"),
                  detail: row.Detalle || null,
                  category_name: row.Categoría,
                  type: row.Tipo,
                  amount: signedAmount,
                  user_id: userData.user.id,
                });

              if (txError) {
                console.error("Error insertando transacción:", txError);
                errorCount++;
              } else {
                successCount++;
              }
            } catch (error) {
              console.error("Error procesando fila:", error);
              errorCount++;
            }
          }

          toast.success(`${successCount} transacciones importadas${errorCount > 0 ? `. ${errorCount} errores` : ""}`);

          setIsImportDialogOpen(false);
          window.location.reload();
        } catch (error: any) {
          toast.error(`Error en la importación: ${error.message}`);
        } finally {
          setIsImporting(false);
        }
      },
      error: (error) => {
        toast.error(`Error leyendo el archivo: ${error.message}`);
        setIsImporting(false);
      },
    });
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

          <Dialog.Root
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingTransaction(null);
                resetForm();
              }
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
                <Dialog.Title className="sr-only">
                  {editingTransaction ? "Editar movimiento" : "Nuevo movimiento"}
                </Dialog.Title>
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

                  {/* Monto y detalle en una línea */}
                  <div className="whisper-entry">
                    <input
                      ref={txInputRef}
                      aria-label="Monto y detalle"
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
                      placeholder={composerType.placeholder}
                      className={cn("whisper-input", isPrivacyMode && formData.value && "privacy-blur")}
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
                    <div className={cn("whisper-preview", isPrivacyMode && parsedDraft && "privacy-blur")} aria-hidden="true">
                      {parsedDraft && (
                        <span>
                          {formData.type === "Rendimiento" && formData.isLoss ? "−" : ""}
                          {formatCurrency(parsedDraft.amount)}
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
                      {formData.category_name
                        ? `Se guardará en ${formData.category_name}`
                        : !editingTransaction && ["Gasto", "Ingreso", "Inversión"].includes(formData.type)
                        ? "O deja que se categorice al guardar"
                        : "Elige una categoría"}
                    </p>
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
                  {showLinkPanel && (() => {
                    const txAmount = draftAmount;
                    const selectedTotal = debtsToLink.reduce((sum, d) => sum + d.amount, 0);
                    const totalMismatch = txAmount > 0 && debtsToLink.length > 0 && Math.abs(txAmount - selectedTotal) > 1;

                    const toggleDebt = (debt: typeof pendingDebts[number]) => {
                      setDebtsToLink((prev) => {
                        const exists = prev.some((d) => d.id === debt.id);
                        if (exists) return prev.filter((d) => d.id !== debt.id);
                        return [...prev, { id: debt.id, debtorName: debt.debtor_name, amount: debt.amount_owed, transactionDetail: debt.transaction_detail || undefined }];
                      });
                      if (!editingTransaction) {
                        setFormData((prev) => ({ ...prev, type: "Reembolso", category_name: "" }));
                      }
                    };

                    return (
                      <div className="whisper-tx-panel">
                        <div className="whisper-tx-panel-head">
                          <span><Users aria-hidden="true" /> Vincular a una deuda pendiente</span>
                        </div>
                        {pendingDebts.map((debt) => {
                          const isSelected = debtsToLink.some((d) => d.id === debt.id);
                          const amountMismatch = txAmount > 0 && Math.abs(txAmount - debt.amount_owed) > 1;
                          return (
                            <div
                              key={debt.id}
                              role="checkbox"
                              aria-checked={isSelected}
                              tabIndex={0}
                              onClick={() => toggleDebt(debt)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleDebt(debt);
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
                                <span>{debt.debtor_name}</span>
                                <small>
                                  {debt.transaction_detail || "Sin detalle"} · {new Date(debt.transaction_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                  {debtsToLink.length <= 1 && amountMismatch && " · monto distinto a la deuda"}
                                </small>
                              </span>
                              <span className={cn("amt", isPrivacyMode && "privacy-blur")}>{formatCurrency(debt.amount_owed)}</span>
                            </div>
                          );
                        })}
                        {debtsToLink.length > 0 && (
                          <>
                            <div className="whisper-tx-foot">
                              <span>
                                {debtsToLink.length} deuda{debtsToLink.length > 1 ? "s" : ""} seleccionada{debtsToLink.length > 1 ? "s" : ""}
                              </span>
                              <b className={cn(totalMismatch && "warn", isPrivacyMode && "privacy-blur")}>{formatCurrency(selectedTotal)}</b>
                            </div>
                            {editingTransaction ? (
                              <button
                                type="button"
                                className="whisper-tx-mini primary"
                                disabled={linkExistingTransactionToDebts.isPending}
                                onClick={async () => {
                                  await linkExistingTransactionToDebts.mutateAsync({
                                    debts: debtsToLink.map((d) => ({
                                      sharedExpenseId: d.id,
                                      amount: d.amount,
                                      debtorName: d.debtorName,
                                      transactionDetail: d.transactionDetail,
                                    })),
                                    existingTransactionId: editingTransaction.id,
                                  });
                                  setIsDialogOpen(false);
                                  setEditingTransaction(null);
                                  resetForm();
                                }}
                              >
                                <Check size={12} /> Vincular seleccionadas
                              </button>
                            ) : (
                              <p className="whisper-tx-note">
                                Al guardar, este movimiento queda como pago de {[...new Set(debtsToLink.map((d) => d.debtorName))].join(", ")} y se registra como Reembolso.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Gasto compartido ya dividido: se edita acá mismo */}
                  {formData.type === "Gasto" && existingShared.length > 0 && (() => {
                    const liveTxAmount = editingTransaction
                      ? (transactions.find((t) => t.id === editingTransaction.id)?.amount ?? draftAmount)
                      : draftAmount;
                    const alreadyAssignedAll = existingShared.reduce((sum, se) => sum + se.amount_owed, 0);
                    const alreadyAssignedPending = existingShared.filter((se) => !se.paid).reduce((sum, se) => sum + se.amount_owed, 0);
                    const myShare = liveTxAmount - alreadyAssignedPending;
                    const remaining = liveTxAmount - alreadyAssignedAll;
                    const newAmount = parseFloat(newDebtorAmount || "0");
                    const exceedsLimit = newAmount > remaining;
                    const isFormValid = newDebtorName.trim() && newDebtorAmount && !exceedsLimit;

                    return (
                      <div className="whisper-tx-panel">
                        <div className="whisper-tx-panel-head">
                          <span><Users aria-hidden="true" /> Gasto compartido</span>
                          {!addingDebtor && (
                            <button type="button" className="whisper-tx-mini" onClick={() => setAddingDebtor(true)}>
                              <Plus size={11} /> Persona
                            </button>
                          )}
                        </div>

                        {existingShared.map((se) => {
                          const isEditingThis = editingDebtorId === se.id;
                          const editAmount = parseFloat(editingDebtorAmount || "0");
                          const otherAssigned = existingShared.filter((s) => s.id !== se.id).reduce((sum, s) => sum + s.amount_owed, 0);
                          const editRemaining = draftAmount - otherAssigned;
                          const editExceeds = editAmount > editRemaining;
                          const editValid = editingDebtorAmount && editAmount > 0 && !editExceeds;

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
                                    value={editingDebtorAmount}
                                    onChange={(e) => setEditingDebtorAmount(e.target.value.replace(/\D/g, ""))}
                                    autoFocus
                                    onKeyDown={async (e) => {
                                      if (e.key === "Enter" && editValid) {
                                        e.preventDefault();
                                        await updateSharedExpenseAmount.mutateAsync({ id: se.id, amount_owed: editAmount });
                                        setEditingDebtorId(null);
                                        setEditingDebtorAmount("");
                                      }
                                      if (e.key === "Escape") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setEditingDebtorId(null);
                                        setEditingDebtorAmount("");
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="whisper-tx-icon-btn"
                                    aria-label="Guardar monto"
                                    disabled={!editValid}
                                    onClick={async () => {
                                      await updateSharedExpenseAmount.mutateAsync({ id: se.id, amount_owed: editAmount });
                                      setEditingDebtorId(null);
                                      setEditingDebtorAmount("");
                                    }}
                                  >
                                    <Check size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="whisper-tx-icon-btn"
                                    aria-label="Cancelar"
                                    onClick={() => {
                                      setEditingDebtorId(null);
                                      setEditingDebtorAmount("");
                                    }}
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
                                          onClick={() => {
                                            setEditingDebtorId(se.id);
                                            setEditingDebtorAmount(se.amount_owed.toString());
                                          }}
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
                                              detail: editingTransaction?.detail || undefined,
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

                        {addingDebtor && (
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
                                value={newDebtorName}
                                onChange={(e) => setNewDebtorName(e.target.value)}
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
                                value={newDebtorAmount}
                                onChange={(e) => setNewDebtorAmount(e.target.value.replace(/\D/g, ""))}
                              />
                              <button
                                type="button"
                                className="whisper-tx-mini primary"
                                disabled={!isFormValid}
                                onClick={async () => {
                                  await addSharedExpenses.mutateAsync([{
                                    transaction_id: editingTransaction!.id,
                                    debtor_name: newDebtorName.trim(),
                                    amount_owed: newAmount,
                                    detail: null,
                                  }]);
                                  setNewDebtorName("");
                                  setNewDebtorAmount("");
                                  setAddingDebtor(false);
                                }}
                              >
                                <Check size={12} /> Agregar
                              </button>
                              <button
                                type="button"
                                className="whisper-tx-icon-btn"
                                aria-label="Cancelar"
                                onClick={() => {
                                  setAddingDebtor(false);
                                  setNewDebtorName("");
                                  setNewDebtorAmount("");
                                }}
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
                  {formData.type === "Gasto" && settleDebtToggle && pendingIOwe.length > 0 && (() => {
                    const txAmount = draftAmount;
                    const selectedTotal = debtsIOweToSettle.reduce((sum, d) => sum + d.amount, 0);
                    const totalMismatch = txAmount > 0 && debtsIOweToSettle.length > 0 && Math.abs(txAmount - selectedTotal) > 1;

                    const toggleDebt = (debt: typeof pendingIOwe[number]) => {
                      setDebtsIOweToSettle((prev) => {
                        const exists = prev.some((d) => d.id === debt.id);
                        if (exists) return prev.filter((d) => d.id !== debt.id);
                        return [...prev, { id: debt.id, debtorName: debt.debtor_name, amount: debt.amount_owed }];
                      });
                    };

                    return (
                      <div className="whisper-tx-panel">
                        <div className="whisper-tx-panel-head">
                          <span><Users aria-hidden="true" /> Saldar una deuda que debo</span>
                          <button
                            type="button"
                            className="whisper-tx-icon-btn"
                            aria-label="Cerrar"
                            onClick={() => {
                              setSettleDebtToggle(false);
                              setDebtsIOweToSettle([]);
                            }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        {pendingIOwe.map((debt) => {
                          const isSelected = debtsIOweToSettle.some((d) => d.id === debt.id);
                          return (
                            <div
                              key={debt.id}
                              role="checkbox"
                              aria-checked={isSelected}
                              tabIndex={0}
                              onClick={() => toggleDebt(debt)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleDebt(debt);
                                }
                              }}
                              className="whisper-tx-row"
                            >
                              <span className="whisper-tx-check" aria-hidden="true">{isSelected && <Check size={10} />}</span>
                              <span className="name">
                                <span>{debt.debtor_name}</span>
                                <small>{debt.transaction_detail || debt.detail || "Sin detalle"}</small>
                              </span>
                              <span className={cn("amt", isPrivacyMode && "privacy-blur")}>{formatCurrency(debt.amount_owed)}</span>
                            </div>
                          );
                        })}
                        {debtsIOweToSettle.length > 0 && (
                          <>
                            <div className="whisper-tx-foot">
                              <span>
                                {debtsIOweToSettle.length} deuda{debtsIOweToSettle.length > 1 ? "s" : ""} seleccionada{debtsIOweToSettle.length > 1 ? "s" : ""}
                              </span>
                              <b className={cn(totalMismatch && "warn", isPrivacyMode && "privacy-blur")}>{formatCurrency(selectedTotal)}</b>
                            </div>
                            {editingTransaction && (
                              <button
                                type="button"
                                className="whisper-tx-mini primary"
                                disabled={settleDebtsIOwe.isPending}
                                onClick={async () => {
                                  await settleDebtsIOwe.mutateAsync({
                                    debts: debtsIOweToSettle.map((d) => ({ sharedExpenseId: d.id })),
                                    existingTransactionId: editingTransaction.id,
                                  });
                                  setIsDialogOpen(false);
                                  setEditingTransaction(null);
                                  resetForm();
                                }}
                              >
                                <Check size={12} /> Saldar seleccionadas
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

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
                      disabled={!parsedDraft || addTransaction.isPending || updateTransaction.isPending}
                      aria-label={editingTransaction ? "Guardar cambios" : "Guardar movimiento"}
                    >
                      {editingTransaction ? "Guardar cambios" : "Guardar"}
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
          onImport={() => setIsImportDialogOpen(true)}
          onExport={handleExportCSV}
        />

        <ImportCSVModal
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          isImporting={isImporting}
          onImport={handleImportCSV}
        />

        <TransactionsTable
          transactions={showFuture ? [...transactions, ...futureTransactions] : transactions}
          categories={categories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpdateSilent={handleUpdateSilent}
          onDeleteMultiple={handleDeleteMultiple}
          onUpdateMultiple={handleUpdateMultiple}
          onDuplicate={handleDuplicate}
          isUpdating={updateTransactionSilent.isPending}
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
        open={confirmDelete.open}
        onOpenChange={(open) => {
          if (!open) armEditGuard();
          setConfirmDelete({ open, id: open ? confirmDelete.id : null });
        }}
        onConfirm={confirmDeleteAction}
        title="¿Eliminar transacción?"
        description="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
      >
        {confirmDelete.id && (() => {
          const tx = transactions.find(t => t.id === confirmDelete.id);
          if (!tx) return null;
          return (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{tx.detail || "Sin detalle"}</span>
                <span className={cn(
                  "font-bold font-mono tabular-nums",
                  AMOUNT_TEXT[tx.type] ?? "text-rose-500"
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
        open={confirmDeleteMultiple.open}
        onOpenChange={(open) => {
          if (!open) armEditGuard();
          setConfirmDeleteMultiple({ open, ids: open ? confirmDeleteMultiple.ids : [] });
        }}
        onConfirm={confirmDeleteMultipleAction}
        title={`¿Eliminar ${confirmDeleteMultiple.ids.length} transacciones?`}
        description="Esta acción eliminará las transacciones seleccionadas. Podrás deshacerlo desde el toast de confirmación."
        confirmText={`Eliminar ${confirmDeleteMultiple.ids.length}`}
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
