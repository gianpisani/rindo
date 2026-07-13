import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { BaseModal } from "@/components/BaseModal";
import { ImportCSVModal } from "@/components/ImportCSVModal";
import { TransactionsTable, getCategoryIcon } from "@/components/TransactionsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Plus, Download, TrendingUp, TrendingDown, PiggyBank, Upload, X, Sparkles, Trash2, Search, CalendarClock, Users, CheckCircle2, Clock, Pencil, ArrowLeftRight, Building2, RefreshCw } from "lucide-react";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useSearchFocusShortcut } from "@/hooks/useSearchFocusShortcut";
import { useCategories } from "@/hooks/useCategories";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useSharedExpenses } from "@/hooks/useSharedExpenses";
import { Checkbox } from "@/components/ui/checkbox";
import SharedExpenseDrawer from "@/components/SharedExpenseDrawer";
import { BankSyncModal } from "@/components/BankSyncModal";
import { useBankSyncContext } from "@/contexts/BankSyncContext";
import { format, parse } from "date-fns";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { categorizeTransaction, debounce } from "@/lib/categorizer";
import { cn } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-time-picker";

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
  Reembolso: ArrowLeftRight,
};

const typeColors = {
  Ingreso: "text-success",
  Gasto: "text-destructive",
  Inversión: "text-info",
  Reembolso: "text-amber-500",
};

const typeBg = {
  Ingreso: "bg-success/5",
  Gasto: "bg-destructive/5",
  Inversión: "bg-info/5",
  Reembolso: "bg-amber-500/5",
};

// ── Add/Edit modal: type segmented control + hero amount ───────────
type TransactionType = "Ingreso" | "Gasto" | "Inversión" | "Reembolso";

const TYPE_OPTIONS: {
  value: TransactionType;
  label: string;
  icon: typeof TrendingUp;
  active: string;
  amount: string;
}[] = [
  {
    value: "Gasto",
    label: "Gasto",
    icon: TrendingDown,
    active: "border-rose-500/40 bg-rose-500/10 text-rose-500",
    amount: "text-rose-500",
  },
  {
    value: "Ingreso",
    label: "Ingreso",
    icon: TrendingUp,
    active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    amount: "text-emerald-500",
  },
  {
    value: "Inversión",
    label: "Inversión",
    icon: PiggyBank,
    active: "border-blue-500/40 bg-blue-500/10 text-blue-500",
    amount: "text-blue-500",
  },
  {
    value: "Reembolso",
    label: "Reembolso",
    icon: ArrowLeftRight,
    active: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    amount: "text-amber-500",
  },
];

export default function Transactions() {
  const {
    transactions,
    futureTransactions,
    addTransaction,
    updateTransaction,
    updateTransactionSilent,
    deleteTransaction,
    deleteMultipleTransactions,
    updateMultipleTransactions,
    duplicateTransactions,
  } = useTransactions();
  const { categories } = useCategories();
  const { creditCards, isLoading: isLoadingCards } = useCreditCards();
  const { addSharedExpenses, updateSharedExpenseAmount, getSharedExpensesByTransaction, markAsPaid, linkExistingTransaction, deleteSharedExpense, sharedExpenses, sharedExpensesWithTransaction } = useSharedExpenses();
  const bankSync = useBankSyncContext();

  const [showFuture, setShowFuture] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
  const [debtToLink, setDebtToLink] = useState<{ id: string; debtorName: string; amount: number; transactionDetail?: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchFocusShortcut(searchInputRef);
  const [highlightId, setHighlightId] = useState<string | null>(searchParams.get("highlight"));
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cardFilter, setCardFilter] = useState("all");

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
  const [suggestion, setSuggestion] = useState<{
    category: string;
    type: "Ingreso" | "Gasto" | "Inversión" | "Reembolso";
    confidence: number;
    reasons: string[];
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date(),
    detail: "",
    category_name: "",
    type: "Gasto" as "Ingreso" | "Gasto" | "Inversión" | "Reembolso",
    amount: "",
    card_id: null as string | null,
  });


  const filteredCategories = categories.filter((cat) => cat.type === formData.type);

  // Función para categorizar con debounce
  const debouncedCategorize = useCallback(
    debounce(async (text: string) => {
      if (!text || text.trim().length < 3) {
        setSuggestion(null);
        setIsAnalyzing(false);
        return;
      }

      setIsAnalyzing(true);
      
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setIsAnalyzing(false);
          return;
        }

        // Pasar las categorías existentes para priorizar matches
        const categoryNames = categories.map(c => c.name);
        const result = await categorizeTransaction(text, userData.user.id, categoryNames);
        
        if (result.category && result.confidence > 30) {
          setSuggestion({
            category: result.category,
            type: result.type!,
            confidence: result.confidence,
            reasons: result.reasons,
          });
        } else {
          setSuggestion(null);
        }
      } catch (error) {
        console.error("Error categorizando:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }, 1300),
    [categories]
  );

  // Efecto para categorizar cuando cambia el detalle
  useEffect(() => {
    if (formData.detail && !formData.category_name && !editingTransaction) {
      debouncedCategorize(formData.detail);
    }
  }, [formData.detail, formData.category_name, editingTransaction, debouncedCategorize]);

  // Aplicar sugerencia
  const applySuggestion = () => {
    if (suggestion) {
      // Si hay una transacción en edición, NO cambiar el tipo
      // Si es una nueva transacción y no hay tipo seleccionado, usar el sugerido
      const newType = editingTransaction ? formData.type : 
                      (formData.type ? formData.type : suggestion.type);
      
      // Buscar la categoría exacta en las existentes (case-insensitive)
      const matchingCategory = categories.find(
        c => c.name.toLowerCase() === suggestion.category.toLowerCase()
      );
      
      setFormData({ 
        ...formData, 
        type: newType,
        category_name: matchingCategory?.name || suggestion.category 
      });
      setSuggestion(null);
    }
  };

  // Rechazar sugerencia
  const dismissSuggestion = () => {
    setSuggestion(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(formData.amount.replace(/\D/g, ""));

    if (editingTransaction) {
      await updateTransaction.mutateAsync({
        id: editingTransaction.id,
        ...formData,
        date: formData.date.toISOString(),
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
        ...formData,
        date: formData.date.toISOString(),
        amount: parsedAmount,
      });

      if (debtToLink && transaction?.id) {
        await linkExistingTransaction.mutateAsync({
          sharedExpenseId: debtToLink.id,
          existingTransactionId: transaction.id,
          amount: debtToLink.amount,
          debtorName: debtToLink.debtorName,
          transactionDetail: debtToLink.transactionDetail,
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
    // Actualizar formData para que "Guardar Cambios" no sobreescriba el monto reducido
    const currentAmount = parseFloat(formData.amount || "0");
    const newAmount = currentAmount - confirmPaid.amount;
    if (newAmount > 0) {
      setFormData(prev => ({ ...prev, amount: newAmount.toString() }));
    }
    setConfirmPaid(null);
  };

  const resetForm = () => {
    setFormData({
      date: new Date(),
      detail: "",
      category_name: "",
      type: "Gasto",
      amount: "",
      card_id: null,
    });
    setSuggestion(null);
    setIsAnalyzing(false);
    setIsShared(false);
    setPendingTransaction(null);
    setAddingDebtor(false);
    setNewDebtorName("");
    setNewDebtorAmount("");
    setEditingDebtorId(null);
    setEditingDebtorAmount("");
    setDebtToLink(null);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    const dateObj = new Date(transaction.date);

    setFormData({
      date: dateObj,
      detail: transaction.detail || "",
      category_name: transaction.category_name,
      type: transaction.type,
      amount: transaction.amount.toString(),
      card_id: transaction.card_id,
    });

    const existingShared = getSharedExpensesByTransaction(transaction.id);
    setIsShared(existingShared.length > 0);

    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
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
              if (!["Ingreso", "Gasto", "Inversión"].includes(row.Tipo)) {
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
              const amount = parseFloat(amountStr);
              
              if (isNaN(amount) || amount <= 0) {
                console.error(`Monto inválido: ${row.Monto}`);
                errorCount++;
                continue;
              }

              const categoryExists = categories.find(
                cat => cat.name === row.Categoría && cat.type === row.Tipo
              );

              if (!categoryExists) {
                const colors = {
                  Ingreso: "#10b981",
                  Gasto: "#ef4444",
                  Inversión: "#3b82f6"
                };

                const { error: catError } = await supabase
                  .from("categories")
                  .insert({
                    name: row.Categoría,
                    type: row.Tipo,
                    color: colors[row.Tipo as keyof typeof colors],
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
                  amount: amount,
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
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingTransaction(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-12 w-12 p-0 md:w-auto md:px-6">
                <Plus className="h-5 w-5 md:mr-2" />
                <span className="hidden md:inline">Agregar</span>
              </Button>
            </DialogTrigger>
          </Dialog>

          <BaseModal
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingTransaction(null);
                resetForm();
                setSuggestion(null);
              }
            }}
            title={editingTransaction ? "Editar transacción" : "Nueva transacción"}
            maxWidth="lg"
            footer={
              <Button
                type="submit"
                form="transaction-form"
                className="w-full h-11 text-[15px] font-semibold gap-2"
                disabled={addTransaction.isPending || updateTransaction.isPending}
              >
                <span>
                  {editingTransaction ? "Guardar cambios" : "Agregar"}
                  {formData.amount && (
                    <span className="font-mono tabular-nums">
                      {" "}· ${parseInt(formData.amount).toLocaleString("es-CL")}
                    </span>
                  )}
                </span>
                <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-primary-foreground/25 bg-primary-foreground/10 px-1.5 font-mono text-[10px] leading-none">
                  ⏎
                </kbd>
              </Button>
            }
          >
            <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
                {/* Tipo — segmented control */}
                <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Tipo de transacción">
                  {TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = formData.type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => {
                          setFormData({ ...formData, type: opt.value, category_name: "" });
                          if (opt.value !== "Ingreso" && opt.value !== "Reembolso") setDebtToLink(null);
                        }}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border py-2.5 px-1 transition-all",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isActive
                            ? cn(opt.active, "font-semibold")
                            : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/50"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[11px] leading-none">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Monto — protagonista */}
                <div className="py-1">
                  <Label htmlFor="amount" className="sr-only">Monto</Label>
                  <input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="$0"
                    required
                    value={formData.amount ? `$${parseInt(formData.amount).toLocaleString("es-CL")}` : ""}
                    onChange={(e) => {
                      const number = e.target.value.replace(/\D/g, "");
                      setFormData({ ...formData, amount: number });
                    }}
                    className={cn(
                      "w-full bg-transparent text-center font-mono text-4xl font-bold tabular-nums tracking-tight",
                      "border-0 outline-none placeholder:text-muted-foreground/25",
                      "transition-colors duration-200",
                      TYPE_OPTIONS.find((o) => o.value === formData.type)?.amount
                    )}
                  />
                </div>

                {/* Detalle + sugerencia IA */}
                <div className="space-y-2">
                  <Label htmlFor="detail" className="text-xs font-medium text-muted-foreground">
                    Detalle
                  </Label>
                  <Input
                    id="detail"
                    placeholder="¿En qué fue? (ayuda a categorizar)"
                    value={formData.detail}
                    onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                    className="h-10 rounded-xl px-4"
                  />

                  {isAnalyzing && (
                    <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
                      <span className="animate-pulse">Buscando categoría…</span>
                    </div>
                  )}

                  {suggestion && !isAnalyzing && (
                    <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 py-1.5 pl-3 pr-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-xs">
                        <span className="font-semibold">
                          {categories.find((c) => c.name === suggestion.category)?.icon || getCategoryIcon(suggestion.category)}{" "}
                          {suggestion.category}
                        </span>
                        <span className="text-muted-foreground"> · {suggestion.confidence}% seguro</span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={applySuggestion}
                        className="h-7 rounded-lg px-2.5 text-xs"
                      >
                        Aplicar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={dismissSuggestion}
                        className="h-7 w-7 shrink-0 rounded-lg p-0 text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Categoría + Tarjeta */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={cn(
                    "space-y-2",
                    (formData.type === "Inversión" || creditCards.length === 0) && "col-span-2"
                  )}>
                    <Label htmlFor="category" className="text-xs font-medium text-muted-foreground">Categoría</Label>
                    <Select
                      value={formData.category_name}
                      onValueChange={(value) => setFormData({ ...formData, category_name: value })}
                    >
                      <SelectTrigger className="h-10 rounded-xl px-3">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories
                          .filter(cat => cat.name && cat.name.trim().length > 0)
                          .map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              {cat.icon || getCategoryIcon(cat.name)} {cat.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.type !== "Inversión" && creditCards.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="card" className="text-xs font-medium text-muted-foreground">Tarjeta</Label>
                      <Select
                        value={formData.card_id ?? "none"}
                        onValueChange={(value) =>
                          setFormData({ ...formData, card_id: value === "none" ? null : value })
                        }
                      >
                        <SelectTrigger className="h-10 rounded-xl px-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Cuenta</SelectItem>
                          {creditCards
                            .filter((c) => c.is_active)
                            .map((card) => (
                              <SelectItem key={card.id} value={card.id}>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-3 w-3 rounded-full"
                                    style={{ backgroundColor: card.color || "#6366f1" }}
                                  />
                                  {card.name}
                                  {card.last_4_digits && (
                                    <span className="text-muted-foreground">···· {card.last_4_digits}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Fecha */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Fecha y hora</Label>
                  <DateTimePicker
                    value={formData.date}
                    onChange={(date) => date && setFormData({ ...formData, date })}
                    showTime={true}
                    className="w-full h-10 rounded-xl"
                  />
                </div>

                {/* Vincular a deuda pendiente — para Ingreso/Reembolso */}
                {(formData.type === "Ingreso" || formData.type === "Reembolso") && (() => {
                  // Al editar: ocultar si ya está vinculada
                  if (editingTransaction) {
                    const linkedTxIds = new Set(
                      sharedExpenses.filter(se => se.paid_transaction_id).map(se => se.paid_transaction_id!)
                    );
                    if (linkedTxIds.has(editingTransaction.id)) return null;
                  }

                  const pendingDebts = sharedExpensesWithTransaction.filter(se => !se.paid);
                  if (pendingDebts.length === 0) return null;

                  const txAmount = parseFloat(formData.amount || "0");

                  return (
                    <div className="space-y-3 rounded-xl border-2 border-amber-500/20 bg-amber-500/5 p-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-semibold">Vincular a deuda pendiente</span>
                      </div>
                      <div className="space-y-2">
                        {pendingDebts.map((debt) => {
                          const isSelected = debtToLink?.id === debt.id;
                          const amountMismatch = txAmount > 0 && Math.abs(txAmount - debt.amount_owed) > 1;
                          return (
                            <div
                              key={debt.id}
                              className={`flex items-center justify-between rounded-lg border bg-background p-3 gap-3 transition-colors ${isSelected ? "border-amber-500 bg-amber-500/5" : "border-border"}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium truncate">{debt.debtor_name}</span>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <span className="text-sm font-semibold text-amber-600">
                                    ${new Intl.NumberFormat("es-CL").format(debt.amount_owed)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {debt.transaction_detail || "Sin detalle"} · {new Date(debt.transaction_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                </p>
                                {amountMismatch && (
                                  <p className="text-xs text-amber-600 mt-0.5">
                                    Monto diferente a la deuda (${new Intl.NumberFormat("es-CL").format(debt.amount_owed)})
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                className="shrink-0 text-xs h-8"
                                disabled={linkExistingTransaction.isPending}
                                onClick={async () => {
                                  if (editingTransaction) {
                                    // Al editar: la mutación actualiza tipo, detalle y categoría
                                    await linkExistingTransaction.mutateAsync({
                                      sharedExpenseId: debt.id,
                                      existingTransactionId: editingTransaction.id,
                                      amount: debt.amount_owed,
                                      debtorName: debt.debtor_name,
                                      transactionDetail: debt.transaction_detail || undefined,
                                    });
                                    setIsDialogOpen(false);
                                    setEditingTransaction(null);
                                    resetForm();
                                  } else {
                                    // Al crear: marcar deuda seleccionada y forzar tipo Reembolso
                                    if (isSelected) {
                                      setDebtToLink(null);
                                    } else {
                                      setDebtToLink({ id: debt.id, debtorName: debt.debtor_name, amount: debt.amount_owed, transactionDetail: debt.transaction_detail || undefined });
                                      setFormData(prev => ({ ...prev, type: "Reembolso", category_name: "" }));
                                    }
                                  }
                                }}
                              >
                                {editingTransaction ? "Vincular" : isSelected ? "Seleccionado" : "Seleccionar"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                      {!editingTransaction && debtToLink && (
                        <p className="text-xs text-amber-600">
                          Al guardar, esta transacción se vinculará como pago de {debtToLink.debtorName} y quedará registrada como Reembolso.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Gasto Compartido — solo para Gastos */}
                {formData.type === "Gasto" && (() => {
                  const existingShared = editingTransaction
                    ? getSharedExpensesByTransaction(editingTransaction.id)
                    : [];
                  const hasExisting = existingShared.length > 0;

                  if (hasExisting) {
                    return (
                      <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Gasto compartido</span>
                          </div>
                          {!addingDebtor && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => setAddingDebtor(true)}
                            >
                              <Plus className="h-3 w-3" />
                              Agregar persona
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {existingShared.map((se) => {
                            const isEditingThis = editingDebtorId === se.id;
                            const editAmount = parseFloat(editingDebtorAmount || "0");
                            const otherAssigned = existingShared.filter(s => s.id !== se.id).reduce((sum, s) => sum + s.amount_owed, 0);
                            const editRemaining = parseFloat(formData.amount || "0") - otherAssigned;
                            const editExceeds = editAmount > editRemaining;
                            const editValid = editingDebtorAmount && editAmount > 0 && !editExceeds;

                            return (
                              <div key={se.id} className="rounded-lg border bg-background px-3 py-2 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {se.paid ? (
                                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                                    )}
                                    <div>
                                      <p className="text-sm font-medium">{se.debtor_name}</p>
                                      {se.paid && (
                                        <p className="text-xs text-muted-foreground">
                                          Pagado {se.paid_at ? new Date(se.paid_at).toLocaleDateString("es-CL") : ""}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {!isEditingThis && (
                                      <span className="text-sm font-bold">
                                        ${new Intl.NumberFormat("es-CL").format(se.amount_owed)}
                                      </span>
                                    )}
                                    {!se.paid && !isEditingThis && (
                                      <>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          onClick={() => {
                                            setEditingDebtorId(se.id);
                                            setEditingDebtorAmount(se.amount_owed.toString());
                                          }}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs px-2"
                                          onClick={() => setConfirmPaid({
                                            id: se.id,
                                            name: se.debtor_name,
                                            amount: se.amount_owed,
                                            detail: editingTransaction?.detail || undefined,
                                          })}
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Pagado
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => deleteSharedExpense.mutate(se.id)}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>

                                {isEditingThis && (
                                  <div className="space-y-1.5">
                                    <div className="flex gap-2 items-center">
                                      <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={editingDebtorAmount}
                                        onChange={(e) => setEditingDebtorAmount(e.target.value.replace(/\D/g, ""))}
                                        className={`h-8 text-sm flex-1 ${editExceeds ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                        autoFocus
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 px-3 text-xs"
                                        disabled={!editValid}
                                        onClick={async () => {
                                          await updateSharedExpenseAmount.mutateAsync({ id: se.id, amount_owed: editAmount });
                                          setEditingDebtorId(null);
                                          setEditingDebtorAmount("");
                                        }}
                                      >
                                        Guardar
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={() => { setEditingDebtorId(null); setEditingDebtorAmount(""); }}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                    {editExceeds && (
                                      <p className="text-xs text-destructive">
                                        Máximo disponible: ${new Intl.NumberFormat("es-CL").format(editRemaining)}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Tu parte */}
                        {(() => {
                          const liveTxAmount = editingTransaction
                            ? (transactions.find(t => t.id === editingTransaction.id)?.amount ?? parseFloat(formData.amount || "0"))
                            : parseFloat(formData.amount || "0");
                          const alreadyAssigned = existingShared.filter(se => !se.paid).reduce((sum, se) => sum + se.amount_owed, 0);
                          const myShare = liveTxAmount - alreadyAssigned;
                          return myShare >= 0 ? (
                            <div className="bg-info/10 text-info p-3 rounded-lg">
                              <div className="flex justify-between items-center text-sm">
                                <span>Tu parte:</span>
                                <span className="font-bold">
                                  ${new Intl.NumberFormat("es-CL").format(myShare)}
                                </span>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Formulario inline para agregar nueva persona */}
                        {addingDebtor && (() => {
                          const totalAmount = editingTransaction
                            ? (transactions.find(t => t.id === editingTransaction.id)?.amount ?? parseFloat(formData.amount || "0"))
                            : parseFloat(formData.amount || "0");
                          const alreadyAssigned = existingShared.reduce((sum, se) => sum + se.amount_owed, 0);
                          const remaining = totalAmount - alreadyAssigned;
                          const newAmount = parseFloat(newDebtorAmount || "0");
                          const exceedsLimit = newAmount > remaining;
                          const isFormValid = newDebtorName.trim() && newDebtorAmount && !exceedsLimit;

                          return (
                            <div className="space-y-2 pt-2 border-t border-primary/20">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Disponible para asignar:</span>
                                <span className={`font-semibold ${remaining <= 0 ? "text-destructive" : "text-success"}`}>
                                  ${new Intl.NumberFormat("es-CL").format(remaining)}
                                </span>
                              </div>
                              <div className="flex gap-2 items-center">
                                <Input
                                  placeholder="Nombre"
                                  value={newDebtorName}
                                  onChange={(e) => setNewDebtorName(e.target.value)}
                                  className="h-8 text-sm flex-1"
                                  autoFocus
                                />
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="Monto"
                                  value={newDebtorAmount}
                                  onChange={(e) => setNewDebtorAmount(e.target.value.replace(/\D/g, ""))}
                                  className={`h-8 text-sm w-28 ${exceedsLimit ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 px-3 text-xs"
                                  disabled={!isFormValid}
                                  onClick={async () => {
                                    await addSharedExpenses.mutateAsync([{
                                      transaction_id: editingTransaction!.id,
                                      debtor_name: newDebtorName.trim(),
                                      amount_owed: newAmount,
                                    }]);
                                    setNewDebtorName("");
                                    setNewDebtorAmount("");
                                    setAddingDebtor(false);
                                  }}
                                >
                                  Agregar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    setAddingDebtor(false);
                                    setNewDebtorName("");
                                    setNewDebtorAmount("");
                                  }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {exceedsLimit && (
                                <p className="text-xs text-destructive">
                                  El monto supera el disponible (${new Intl.NumberFormat("es-CL").format(remaining)})
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }

                  return (
                    <div className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-input hover:border-primary/50 transition-colors">
                      <Checkbox
                        id="shared-modal"
                        checked={isShared}
                        onCheckedChange={(checked) => setIsShared(checked as boolean)}
                      />
                      <label
                        htmlFor="shared-modal"
                        className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                      >
                        <Users className="h-4 w-4 text-primary" />
                        Gasto compartido con amigos
                      </label>
                    </div>
                  );
                })()}
              </form>
          </BaseModal>
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

        {/* Toolbar unificada */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Acciones izq */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full h-8 w-8">
                <Upload className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </Dialog>

          <ImportCSVModal
            open={isImportDialogOpen}
            onOpenChange={setIsImportDialogOpen}
            isImporting={isImporting}
            onImport={handleImportCSV}
          />

          <Button onClick={handleExportCSV} variant="outline" size="icon" className="rounded-full h-8 w-8">
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-2"
            onClick={() => setIsBankSyncOpen(true)}
          >
            {bankSync.isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {bankSync.isRunning ? "Sincronizando..." : "Sync Banco"}
            </span>
          </Button>

          {/* Cuotas futuras como botón compacto */}
          {futureTransactions.length > 0 && (
            <Button
              variant={showFuture ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFuture(!showFuture)}
              className="rounded-full gap-2 text-xs"
            >
              <CalendarClock className="h-4 w-4" />
              <span>{futureTransactions.length} cuota{futureTransactions.length > 1 ? "s" : ""} futura{futureTransactions.length > 1 ? "s" : ""}</span>
            </Button>
          )}

          {/* Separador */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Buscar..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") e.currentTarget.blur();
              }}
              className="pl-9 w-48 sm:w-64"
            />
            {searchValue && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchValue("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Filtro tarjeta */}
          {(isLoadingCards || creditCards.length > 0) && (
            <Select value={cardFilter} onValueChange={setCardFilter} disabled={isLoadingCards}>
              <SelectTrigger className="w-[160px] sm:w-[180px]">
                <SelectValue placeholder="Tarjeta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las tarjetas</SelectItem>
                <SelectItem value="none">Sin tarjeta</SelectItem>
                {creditCards.map(card => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}{card.last_4_digits ? ` ···${card.last_4_digits}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Filtro tipo */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] sm:w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="Ingreso">Ingresos</SelectItem>
              <SelectItem value="Gasto">Gastos</SelectItem>
              <SelectItem value="Inversión">Inversiones</SelectItem>
              <SelectItem value="Reembolso">Reembolsos</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro categoría */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] sm:w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {Array.from(new Set(
                [...transactions, ...(showFuture ? futureTransactions : [])].map(t => t.category_name)
              ))
                .filter(cat => cat && cat.trim().length > 0)
                .map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {categories.find(c => c.name === cat)?.icon || getCategoryIcon(cat)} {cat}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

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
          highlightId={highlightId}
        />
      </div>

      <SharedExpenseDrawer
        open={sharedDrawerOpen}
        onOpenChange={setSharedDrawerOpen}
        totalAmount={pendingTransaction?.amount || 0}
        onConfirm={handleSharedExpenseConfirm}
      />

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null })}
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
                <span className={`font-bold font-mono tabular-nums ${tx.type === "Ingreso" ? "text-success" : tx.type === "Inversión" ? "text-info" : "text-destructive"}`}>
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
        onOpenChange={(open) => setConfirmDeleteMultiple({ open, ids: open ? confirmDeleteMultiple.ids : [] })}
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
