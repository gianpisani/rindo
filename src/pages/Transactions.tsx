import { useState, useRef, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Download, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, Filter, Upload, X, Sparkles, Info } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { categorizeTransaction, debounce } from "@/lib/categorizer";

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
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { categories } = useCategories();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [suggestion, setSuggestion] = useState<{
    category: string;
    type: "Ingreso" | "Gasto" | "Inversión";
    confidence: number;
    reasons: string[];
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    detail: "",
    category_name: "",
    type: "Gasto" as "Ingreso" | "Gasto" | "Inversión",
    amount: "",
  });

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesType = filterType === "all" || transaction.type === filterType;
    const matchesCategory = filterCategory === "all" || transaction.category_name === filterCategory;
    const matchesSearch = !searchTerm || 
      transaction.detail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.category_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesCategory && matchesSearch;
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
        amount: parseFloat(formData.amount.replace(/\D/g, "")),
      });
    } else {
      await addTransaction.mutateAsync({
        ...formData,
        amount: parseFloat(formData.amount.replace(/\D/g, "")),
      });
    }

    setIsDialogOpen(false);
    setEditingTransaction(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), "yyyy-MM-dd"),
      detail: "",
      category_name: "",
      type: "Gasto",
      amount: "",
    });
    setSuggestion(null);
    setIsAnalyzing(false);
  };

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setFormData({
      date: transaction.date,
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

  const handleExportCSV = () => {
    const csvData = filteredTransactions.map((t) => ({
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

              let categoryExists = categories.find(
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

          toast({
            title: "Importación completada",
            description: `${successCount} transacciones importadas. ${errorCount > 0 ? `${errorCount} errores.` : ""}`,
          });

          setIsImportDialogOpen(false);
          window.location.reload();
        } catch (error: any) {
          toast({
            title: "Error en la importación",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setIsImporting(false);
        }
      },
      error: (error) => {
        toast({
          title: "Error leyendo el archivo",
          description: error.message,
          variant: "destructive",
        });
        setIsImporting(false);
      },
    });
  };

  const hasActiveFilters = filterType !== "all" || filterCategory !== "all" || searchTerm;

  return (
    <Layout>
      <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Transacciones</h1>
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
              <Button className="rounded-full h-12 w-12 p-0 shadow-elevated md:w-auto md:px-6">
                <Plus className="h-5 w-5 md:mr-2" />
                <span className="hidden md:inline">Agregar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTransaction ? "Editar" : "Agregar"} Transacción
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-medium">Fecha</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="h-12 rounded-full px-6"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-medium">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value, category_name: "" })}
                  >
                    <SelectTrigger className="h-12 rounded-full px-6">
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
                    <SelectTrigger className="h-12 rounded-full px-6">
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
                  <Input
                    id="amount"
                    type="text"
                    placeholder="$0"
                    value={formData.amount}
                    onChange={(e) => {
                      const number = e.target.value.replace(/\D/g, "");
                      setFormData({ ...formData, amount: number });
                    }}
                    className="h-12 rounded-full px-6"
                    required
                  />
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
                    className="h-12 rounded-full px-6"
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
                <DialogFooter className="gap-2">
                  <Button type="submit" className="rounded-full h-12" disabled={addTransaction.isPending || updateTransaction.isPending}>
                    {editingTransaction ? "Guardar Cambios" : "Agregar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full gap-2"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filtros
            {hasActiveFilters && <Badge variant="default" className="ml-1 h-5 w-5 p-0 rounded-full text-xs">!</Badge>}
          </Button>
          
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Importar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Importar Transacciones desde CSV</DialogTitle>
                <DialogDescription className="space-y-4 pt-4">
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
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImportCSV(file);
                    }
                  }}
                  className="h-12 rounded-full"
                  disabled={isImporting}
                />
                {isImporting && (
                  <p className="text-sm text-muted-foreground animate-pulse">Importando...</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            onClick={handleExportCSV} 
            variant="outline" 
            size="sm" 
            className="rounded-full gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>

        {showFilters && (
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Buscar</Label>
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 rounded-full px-4"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tipo</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-10 rounded-full px-4">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Ingreso">Ingreso</SelectItem>
                      <SelectItem value="Gasto">Gasto</SelectItem>
                      <SelectItem value="Inversión">Inversión</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Categoría</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-10 rounded-full px-4">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories
                        .filter(cat => cat.name && cat.name.trim().length > 0)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 rounded-full"
                  onClick={() => {
                    setFilterType("all");
                    setFilterCategory("all");
                    setSearchTerm("");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <Card className="rounded-2xl shadow-sm border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                No se encontraron transacciones
              </CardContent>
            </Card>
          ) : (
            filteredTransactions.map((transaction) => {
              const Icon = typeIcons[transaction.type];
              const colorClass = typeColors[transaction.type];
              const bgClass = typeBg[transaction.type];

              return (
                <Card 
                  key={transaction.id} 
                  className="rounded-2xl shadow-sm border-border/50 hover:shadow-elevated transition-all duration-200"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${bgClass} flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${colorClass}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(transaction.date), "d MMM", { locale: es })}
                            </p>
                            <p className={`text-sm font-semibold ${colorClass}`}>
                              {formatCurrency(Number(transaction.amount))}
                            </p>
                          </div>
                          <Select 
                            value={transaction.category_name}
                            onValueChange={async (newCategory) => {
                              try {
                                await updateTransaction.mutateAsync({
                                  id: transaction.id,
                                  category_name: newCategory,
                                });
                              } catch (error) {
                                console.error("Error al actualizar categoría:", error);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-[140px] rounded-full text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories
                                .filter((cat) => cat.type === transaction.type)
                                .map((cat) => (
                                  <SelectItem key={cat.id} value={cat.name}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {transaction.detail && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {transaction.detail}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(transaction)}
                          className="h-8 w-8 p-0 rounded-full"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete({ open: true, id: transaction.id })}
                          className="h-8 w-8 p-0 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
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
    </Layout>
  );
}
