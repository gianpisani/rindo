import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Info, AlertTriangle, Wand2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from "@tanstack/react-table";
import { 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
};

const typeColors = {
  Ingreso: "text-success bg-success/10",
  Gasto: "text-destructive bg-destructive/10",
  Inversión: "text-info bg-info/10",
};

export default function BulkRecategorize() {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true }
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [rowSelection, setRowSelection] = useState({});
  const [newCategory, setNewCategory] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Seleccionar todas"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "date",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer hover:bg-muted rounded px-2 py-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-xs font-semibold">Fecha</span>
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        );
      },
      cell: ({ row }) => {
        const date = new Date(row.original.date);
        return (
          <div className="font-medium text-sm">
            {format(date, "dd MMM yyyy", { locale: es })}
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.original.type;
        const Icon = typeIcons[type];
        return (
          <Badge
            variant="outline"
            className={cn("gap-1.5 font-medium", typeColors[type])}
          >
            <Icon className="h-3.5 w-3.5" />
            {type}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value === "all" || row.getValue(id) === value;
      },
    },
    {
      accessorKey: "category_name",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer hover:bg-muted rounded px-2 py-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-xs font-semibold">Categoría</span>
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        );
      },
      cell: ({ row }) => {
        return (
          <div className="font-medium text-sm">
            {row.original.category_name}
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value === "all" || row.getValue(id) === value;
      },
    },
    {
      accessorKey: "detail",
      header: "Detalle",
      cell: ({ row }) => {
        return (
          <div className="max-w-[300px] truncate text-sm text-muted-foreground">
            {row.original.detail || "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center justify-end cursor-pointer hover:bg-muted rounded px-2 py-1 ml-auto"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-xs font-semibold">Monto</span>
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        );
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
        const type = row.original.type;
        return (
          <div className={cn(
            "text-right font-semibold text-sm",
            type === "Ingreso" && "text-success",
            type === "Gasto" && "text-destructive",
            type === "Inversión" && "text-info"
          )}>
            {formatCurrency(amount)}
          </div>
        );
      },
    },
  ], [categories]);

  const columnFilters = useMemo(() => [
    { id: "type", value: typeFilter },
    { id: "category_name", value: categoryFilter },
  ], [typeFilter, categoryFilter]);

  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: "includesString",
    state: {
      sorting,
      globalFilter,
      columnFilters,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  // Obtener tipo de las transacciones seleccionadas
  const selectedTypes = new Set(
    selectedRows.map(row => row.original.type)
  );

  // Categorías disponibles según los tipos seleccionados
  const availableCategories = selectedTypes.size === 1
    ? categories.filter(c => c.type === Array.from(selectedTypes)[0])
    : categories;

  const applyRecategorization = async () => {
    setShowConfirm(false);
    setIsApplying(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      if (selectedCount === 0) {
        toast({
          title: "Sin selección",
          description: "Debes seleccionar al menos una transacción",
          variant: "destructive",
        });
        return;
      }

      if (!newCategory) {
        toast({
          title: "Sin categoría",
          description: "Debes seleccionar una categoría de destino",
          variant: "destructive",
        });
        return;
      }

      let success = 0;
      let errors = 0;

      // Actualizar cada transacción seleccionada
      for (const row of selectedRows) {
        try {
          const { error } = await supabase
            .from("transactions")
            .update({ category_name: newCategory })
            .eq("id", row.original.id)
            .eq("user_id", userData.user.id);

          if (error) {
            console.error("Error actualizando:", error);
            errors++;
          } else {
            success++;
          }
        } catch (error) {
          console.error("Error:", error);
          errors++;
        }
      }

      toast({
        title: "Recategorización completada",
        description: `${success} transacciones actualizadas${errors > 0 ? `, ${errors} errores` : ""}`,
      });

      // Limpiar selección y recargar
      setRowSelection({});
      setNewCategory("");
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Recategorización Masiva</h1>
            <p className="text-sm text-muted-foreground">
              Selecciona transacciones y cambia su categoría en lote
            </p>
          </div>
          <Button
            onClick={() => navigate("/recategorize")}
            variant="outline"
            className="rounded-full gap-2 border-purple-300 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          >
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">IA Auto-Categorizar</span>
          </Button>
        </div>

        <Alert className="rounded-2xl border-blue-200 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm">
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>Usa los filtros y búsqueda para encontrar transacciones</li>
              <li>Selecciona las filas con los checkboxes</li>
              <li>Elige la nueva categoría y aplica los cambios</li>
              <li>Solo tus transacciones serán modificadas</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Panel de acción masiva */}
        {selectedCount > 0 && (
          <Card className="rounded-2xl shadow-sm border-purple-300 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 sticky top-20 z-10 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{selectedCount}</p>
                    <p className="text-xs text-muted-foreground">Seleccionadas</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-2 block">Nueva Categoría</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger className="h-10 rounded-full min-w-[200px]">
                        <SelectValue placeholder="Selecciona categoría..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories
                          .filter(cat => cat.name && cat.name.trim().length > 0)
                          .map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {cat.type}
                                </Badge>
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={!newCategory || isApplying}
                  className="rounded-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg w-full md:w-auto"
                >
                  {isApplying ? (
                    <>Aplicando...</>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Aplicar Cambios
                    </>
                  )}
                </Button>
              </div>
              {selectedTypes.size > 1 && (
                <Alert className="mt-4 rounded-xl border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">
                    Has seleccionado transacciones de diferentes tipos. Asegúrate de elegir una categoría compatible.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabla de transacciones */}
        <Card className="rounded-2xl shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Transacciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en todas las columnas..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-9 pr-9 h-10 rounded-full"
                />
                {globalFilter && (
                  <button
                    onClick={() => setGlobalFilter("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px] h-10 rounded-full">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="Ingreso">Ingreso</SelectItem>
                  <SelectItem value="Gasto">Gasto</SelectItem>
                  <SelectItem value="Inversión">Inversión</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[200px] h-10 rounded-full">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
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

            {/* Tabla */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-border">
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            "hover:bg-muted/30 transition-colors",
                            row.getIsSelected() && "bg-purple-50/50 dark:bg-purple-950/10"
                          )}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="px-4 py-12 text-center text-muted-foreground"
                        >
                          No se encontraron transacciones
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} de{" "}
                {table.getFilteredRowModel().rows.length} fila(s) seleccionada(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded-full"
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {table.getState().pagination.pageIndex + 1} de{" "}
                  {table.getPageCount()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="rounded-full"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={applyRecategorization}
        title="¿Aplicar recategorización?"
        description={`Se cambiarán ${selectedCount} transacciones a la categoría "${newCategory}". Esta acción no se puede deshacer.`}
        confirmText="Aplicar cambios"
        cancelText="Cancelar"
      />
    </Layout>
  );
}
