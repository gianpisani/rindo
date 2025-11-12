import { useState, useRef } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, Filter, Upload } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
};

const typeColors = {
  Ingreso: "bg-success/10 text-success",
  Gasto: "bg-destructive/10 text-destructive",
  Inversión: "bg-info/10 text-info",
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

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta transacción?")) {
      await deleteTransaction.mutateAsync(id);
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
          
          // Validar columnas requeridas
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
              // Validar tipo
              if (!["Ingreso", "Gasto", "Inversión"].includes(row.Tipo)) {
                console.error(`Tipo inválido en fila: ${row.Tipo}`);
                errorCount++;
                continue;
              }

              // Parsear fecha (DD/MM/YYYY)
              const dateParts = row.Fecha.split("/");
              if (dateParts.length !== 3) {
                console.error(`Formato de fecha inválido: ${row.Fecha}`);
                errorCount++;
                continue;
              }
              const parsedDate = parse(row.Fecha, "dd/MM/yyyy", new Date());
              
              // Parsear monto (eliminar $ y puntos)
              const amountStr = row.Monto.toString().replace(/[$.\s]/g, "").replace(",", ".");
              const amount = parseFloat(amountStr);
              
              if (isNaN(amount) || amount <= 0) {
                console.error(`Monto inválido: ${row.Monto}`);
                errorCount++;
                continue;
              }

              // Verificar si la categoría existe, si no, crearla
              let categoryExists = categories.find(
                cat => cat.name === row.Categoría && cat.type === row.Tipo
              );

              if (!categoryExists) {
                // Crear nueva categoría
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

              // Insertar transacción
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
          window.location.reload(); // Refrescar para ver las nuevas categorías y transacciones
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Transacciones</h1>
            <p className="text-muted-foreground">
              Gestiona todas tus transacciones financieras
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Importar CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar Transacciones desde CSV</DialogTitle>
                  <DialogDescription className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <p className="font-medium">Formato requerido:</p>
                      <div className="bg-muted p-3 rounded-md text-sm font-mono">
                        Fecha,Detalle,Categoría,Tipo,Monto
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="font-medium">Descripción de columnas:</p>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        <li><strong>Fecha:</strong> formato DD/MM/YYYY (ej: 15/01/2024)</li>
                        <li><strong>Detalle:</strong> descripción opcional de la transacción</li>
                        <li><strong>Categoría:</strong> nombre de la categoría (se creará si no existe)</li>
                        <li><strong>Tipo:</strong> Ingreso, Gasto o Inversión</li>
                        <li><strong>Monto:</strong> número positivo (ej: 50000 o $50.000)</li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <p className="font-medium">Ejemplo:</p>
                      <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
                        15/01/2024,Supermercado,Comida,Gasto,45000<br/>
                        20/01/2024,Salario,Sueldo,Ingreso,1500000<br/>
                        25/01/2024,Fondo mutuo,Inversiones,Inversión,100000
                      </div>
                    </div>

                    <div className="bg-info/10 text-info p-3 rounded-md text-sm">
                      <strong>Nota:</strong> Si una categoría no existe, se creará automáticamente con el tipo especificado.
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
                    disabled={isImporting}
                  />
                  {isImporting && (
                    <p className="text-sm text-muted-foreground">Importando transacciones...</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
            <Button onClick={handleExportCSV} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingTransaction(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar Transacción
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? "Editar" : "Agregar"} Transacción
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Fecha</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: any) => setFormData({ ...formData, type: value, category_name: "" })}
                    >
                      <SelectTrigger>
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
                    <Label htmlFor="category">Categoría</Label>
                    <Select
                      value={formData.category_name}
                      onValueChange={(value) => setFormData({ ...formData, category_name: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Monto</Label>
                    <Input
                      id="amount"
                      type="text"
                      placeholder="$0"
                      value={formData.amount}
                      onChange={(e) => {
                        const number = e.target.value.replace(/\D/g, "");
                        setFormData({ ...formData, amount: number });
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="detail">Detalle (opcional)</Label>
                    <Input
                      id="detail"
                      placeholder="Descripción de la transacción"
                      value={formData.detail}
                      onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={addTransaction.isPending || updateTransaction.isPending}>
                      {editingTransaction ? "Guardar Cambios" : "Agregar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Buscar</Label>
                <Input
                  placeholder="Buscar en detalle o categoría..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
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
                <Label>Categoría</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(filterType !== "all" || filterCategory !== "all" || searchTerm) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterType("all");
                  setFilterCategory("all");
                  setSearchTerm("");
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No se encontraron transacciones
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => {
                    const Icon = typeIcons[transaction.type];
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(new Date(transaction.date), "d 'de' MMM, yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Badge className={`gap-1 ${typeColors[transaction.type]}`}>
                            <Icon className="h-3 w-3" />
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.category_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {transaction.detail || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(transaction.amount))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(transaction)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(transaction.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}