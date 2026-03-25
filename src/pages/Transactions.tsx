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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Download, TrendingUp, TrendingDown, PiggyBank, Upload, X, Sparkles, Info, Trash2, Search, CalendarClock } from "lucide-react";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
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
};

const typeColors = {
  Ingreso: "text-success",
  Gasto: "text-destructive",
  Inversión: "text-info",
};

const typeBg = {
  Ingreso: "bg-success/5",
  Gasto: "bg-destructive/5",
  Inversión: "bg-info/5",
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFuture, setShowFuture] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
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
    type: "Ingreso" | "Gasto" | "Inversión";
    confidence: number;
    reasons: string[];
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date(),
    detail: "",
    category_name: "",
    type: "Gasto" as "Ingreso" | "Gasto" | "Inversión",
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
    
    if (editingTransaction) {
      await updateTransaction.mutateAsync({
        id: editingTransaction.id,
        ...formData,
        date: formData.date.toISOString(),
        amount: parseFloat(formData.amount.replace(/\D/g, "")),
      });
    } else {
      await addTransaction.mutateAsync({
        ...formData,
        date: formData.date.toISOString(),
        amount: parseFloat(formData.amount.replace(/\D/g, "")),
      });
    }

    setIsDialogOpen(false);
    setEditingTransaction(null);
    resetForm();
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
                    onValueChange={(value: "Ingreso" | "Gasto" | "Inversión") => setFormData({ ...formData, type: value, category_name: "" })}
                  >
                    <SelectTrigger className="h-10 rounded-xl px-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ingreso">Ingreso</SelectItem>
                      <SelectItem value="Gasto">Gasto</SelectItem>
                      <SelectItem value="Inversión">Inversión</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">Categoría</Label>
                  <Select
                    value={formData.category_name}
                    onValueChange={(value) => setFormData({ ...formData, category_name: value })}
                  >
                    <SelectTrigger className="h-10 rounded-lg px-6">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories
                        .filter(cat => cat.name && cat.name.trim().length > 0)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
              </form>
          </BaseModal>
        </div>

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
                    {getCategoryIcon(cat)} {cat}
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
        />
      </div>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null })}
        onConfirm={confirmDeleteAction}
        title="¿Eliminar transacción?"
        description="Esta acción no se puede deshacer. La transacción será eliminada permanentemente."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

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
    </Layout>
  );
}
