import { useState, useRef, useCallback, useEffect } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { BaseModal } from "@/components/BaseModal";
import { TransactionsTable, getCategoryIcon } from "@/components/TransactionsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Download, TrendingUp, TrendingDown, PiggyBank, Upload, X, Sparkles, Info, Trash2, Search, CalendarClock, Users, CheckCircle2, Clock, Pencil, ArrowLeftRight, Building2, RefreshCw, ChevronDown, Check } from "lucide-react";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
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
  const { creditCards } = useCreditCards();
  const { addSharedExpenses, updateSharedExpenseAmount, getSharedExpensesByTransaction, markAsPaid, linkExistingTransaction, deleteSharedExpense, sharedExpenses, sharedExpensesWithTransaction } = useSharedExpenses();
  const bankSync = useBankSyncContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFuture, setShowFuture] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCategoryList, setShowCategoryList] = useState(false);
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
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cardFilter, setCardFilter] = useState("all");
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
                setShowCategoryList(false);
              }
            }}
            title={`${editingTransaction ? "Editar" : "Agregar"} Transacción`}
            maxWidth="lg"
            footer={
              <Button 
                type="submit" 
                form="transaction-form"
                className="w-full" 
                disabled={addTransaction.isPending || updateTransaction.isPending}
              >
                {editingTransaction ? "Guardar Cambios" : "Agregar"}
              </Button>
            }
          >
            <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Fecha y Hora</Label>
                  <DateTimePicker
                    value={formData.date}
                    onChange={(date) => date && setFormData({ ...formData, date })}
                    showTime={true}
                    className="w-full h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-medium">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "Ingreso" | "Gasto" | "Inversión" | "Reembolso") => {
                      setFormData({ ...formData, type: value, category_name: "" });
                      setShowCategoryList(false);
                      if (value !== "Ingreso" && value !== "Reembolso") setDebtToLink(null);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl px-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ingreso">Ingreso</SelectItem>
                      <SelectItem value="Gasto">Gasto</SelectItem>
                      <SelectItem value="Inversión">Inversión</SelectItem>
                      <SelectItem value="Reembolso">Reembolso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">Categoría</Label>
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-6 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={() => setShowCategoryList(v => !v)}
                  >
                    <span className={formData.category_name ? "" : "text-muted-foreground"}>
                      {formData.category_name
                        ? `${filteredCategories.find(c => c.name === formData.category_name)?.icon || getCategoryIcon(formData.category_name)} ${formData.category_name}`
                        : "Selecciona una categoría"}
                    </span>
                    <ChevronDown className={`h-4 w-4 opacity-50 transition-transform duration-200 ${showCategoryList ? "rotate-180" : ""}`} />
                  </button>
                  {showCategoryList && (
                    <div className="rounded-lg border bg-popover text-popover-foreground shadow-md overflow-hidden">
                      {filteredCategories
                        .filter(cat => cat.name && cat.name.trim().length > 0)
                        .map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-6 py-2.5 text-sm hover:bg-accent text-left"
                            onClick={() => {
                              setFormData({ ...formData, category_name: cat.name });
                              setShowCategoryList(false);
                            }}
                          >
                            <span>{cat.icon || getCategoryIcon(cat.name)}</span>
                            <span>{cat.name}</span>
                            {formData.category_name === cat.name && <Check className="ml-auto h-4 w-4" />}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Monto</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="amount"
                    type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      value={formData.amount ? parseInt(formData.amount).toLocaleString("es-CL") : ""}
                    onChange={(e) => {
                      const number = e.target.value.replace(/\D/g, "");
                      setFormData({ ...formData, amount: number });
                    }}
                      className="h-10 rounded-xl pl-8 pr-6"
                    required
                  />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detail" className="text-sm font-medium">
                    Detalle {!formData.category_name && "(ayuda a categorizar)"}
                  </Label>
                  <Input
                    id="detail"
                    placeholder="Descripción de la transacción"
                    value={formData.detail}
                    onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                    className="h-10 rounded-xl px-6"
                  />
                  
                  {isAnalyzing && (
                    <Alert className="rounded-2xl border-blue-200 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 shadow-sm">
                      <div className="relative">
                        <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
                        <div className="absolute inset-0 h-4 w-4 bg-blue-400 rounded-full animate-ping opacity-20" />
                      </div>
                      <AlertDescription className="text-sm text-blue-900 dark:text-blue-100 font-medium flex items-center gap-2">
                        <span className="inline-block animate-pulse">🤖</span>
                        Analizando con IA...
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {!isAnalyzing && formData.detail && formData.detail.length >= 3 && !suggestion && !formData.category_name && !editingTransaction && (
                    <Alert className="rounded-2xl border-gray-200 bg-gray-50/50 dark:bg-gray-950/20">
                      <Info className="h-4 w-4 text-gray-600" />
                      <AlertDescription className="text-xs text-gray-700 dark:text-gray-300">
                        💡 No encontré una categoría sugerida. Intenta ser más específico o selecciona manualmente.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {suggestion && !isAnalyzing && (
                    <Alert className="rounded-2xl border-purple-300 bg-gradient-to-r from-purple-50/80 to-pink-50/80 dark:from-purple-950/30 dark:to-pink-950/30 relative shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="relative">
                        <Sparkles className="h-4 w-4 text-purple-600 animate-pulse" />
                        <div className="absolute -inset-1 bg-purple-400 rounded-full blur opacity-30 animate-pulse" />
                      </div>
                      <AlertDescription className="text-sm pr-8">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🎯</span>
                            <p className="font-bold text-purple-900 dark:text-purple-100">
                              Sugerencia IA ({suggestion.confidence}% confianza)
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            {!editingTransaction && !formData.type && (
                              <Badge variant="default" className="rounded-full bg-purple-600 hover:bg-purple-700 shadow-sm">
                                {suggestion.type}
                              </Badge>
                            )}
                            <Badge variant="default" className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-sm font-semibold">
                              {suggestion.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-purple-800 dark:text-purple-200 italic">
                            💡 {suggestion.reasons[0]}
                          </p>
                          {editingTransaction && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                              ⚠️ Solo se cambiará la categoría, no el tipo
                            </p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button
                              type="button"
                              size="sm"
                              onClick={applySuggestion}
                              className="rounded-full h-9 text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all"
                            >
                              ✨ Aplicar categoría
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={dismissSuggestion}
                              className="rounded-full h-9 text-xs hover:bg-purple-100 dark:hover:bg-purple-900"
                            >
                              Ignorar
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={dismissSuggestion}
                        className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Alert>
                  )}
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
          onReset={bankSync.reset}
        />

        {/* Toolbar unificada */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Acciones izq */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Importar</span>
              </Button>
            </DialogTrigger>
          </Dialog>

          <BaseModal
            open={isImportDialogOpen}
            onOpenChange={setIsImportDialogOpen}
            title="Importar Transacciones desde CSV"
            description="Sube tu archivo CSV con el formato indicado"
            maxWidth="md"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="font-medium text-sm">Formato requerido:</p>
                <div className="bg-muted p-3 rounded-xl text-xs font-mono">
                  Fecha,Detalle,Categoría,Tipo,Monto
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-sm">Descripción de columnas:</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li><strong>Fecha:</strong> formato DD/MM/YYYY</li>
                  <li><strong>Detalle:</strong> descripción opcional</li>
                  <li><strong>Categoría:</strong> se creará si no existe</li>
                  <li><strong>Tipo:</strong> Ingreso, Gasto o Inversión</li>
                  <li><strong>Monto:</strong> número positivo</li>
                </ul>
              </div>
              <div className="pt-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImportCSV(file); }}
                  className="h-12"
                  disabled={isImporting}
                />
                {isImporting && <p className="text-sm text-muted-foreground animate-pulse mt-2">Importando...</p>}
              </div>
            </div>
          </BaseModal>

          <Button onClick={handleExportCSV} variant="outline" size="sm" className="rounded-full gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
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
              {bankSync.isRunning ? "Sincronizando..." : "Sincronizar Banco"}
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
              placeholder="Buscar..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
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

          {/* Filtro tarjeta */}
          {creditCards.length > 0 && (
            <Select value={cardFilter} onValueChange={setCardFilter}>
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
        <AlertDialogContent>
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
