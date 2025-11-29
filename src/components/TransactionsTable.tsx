import React, { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from "@tanstack/react-table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Search,
  X,
} from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";

interface TransactionsTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  categories: Array<{ name: string; type: string }>;
}

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
};

const typeColors = {
  Ingreso: "text-success bg-success/10",
  Gasto: "text-destructive bg-destructive/10",
  Inversión: "text-blue bg-blue/10",
};

export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
  categories,
}: TransactionsTableProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true }
  ]);
  const [globalFilter, setGlobalFilter] = useState(searchParams.get("search") || "");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Sincronizar con URL params
  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setGlobalFilter(searchFromUrl);
    }
  }, [searchParams]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
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
        const category = categories.find(
          (c) => c.name === row.original.category_name
        );
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
        return (
          <div className="text-right font-semibold text-sm">
            {formatCurrency(amount)}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const handleEdit = (e: React.MouseEvent) => {
          e.stopPropagation();
          onEdit(row.original);
        };

        const handleDelete = (e: React.MouseEvent) => {
          e.stopPropagation();
          onDelete(row.original.id);
        };

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [onEdit, onDelete, categories]);

  // Aplicar fuzzy search + filtros
  const fuzzyResults = useFuzzySearch(transactions, globalFilter);
  
  const filteredData = useMemo(() => {
    // Usar fuzzy si hay búsqueda, sino todas
    let data = globalFilter ? fuzzyResults : transactions;
    
    // Aplicar filtros adicionales
    if (typeFilter !== "all") {
      data = data.filter(t => t.type === typeFilter);
    }
    if (categoryFilter !== "all") {
      data = data.filter(t => t.category_name === categoryFilter);
    }
    
    return data;
  }, [fuzzyResults, transactions, globalFilter, typeFilter, categoryFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  const uniqueCategories = Array.from(
    new Set(transactions.map((t) => t.category_name))
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar transacciones..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
          {globalFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setGlobalFilter("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="Ingreso">Ingresos</SelectItem>
            <SelectItem value="Gasto">Gastos</SelectItem>
            <SelectItem value="Inversión">Inversiones</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {uniqueCategories
              .filter((cat) => cat && cat.trim().length > 0)
              .map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wide"
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
            <tbody className="divide-y divide-border bg-card">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron transacciones
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} transacción(es)
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <div className="text-sm text-muted-foreground">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

