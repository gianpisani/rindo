import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnDef,
  RowSelectionState,
} from "@tanstack/react-table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  Copy,
  Check,
  Tag,
  ArrowRightLeft,
  CreditCard,
} from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { useCreditCards } from "@/hooks/useCreditCards";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { AnalyzingBadge } from "./AnalyzingBadge";
import { InlineDateTimePicker } from "./ui/date-time-picker";
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from "@heroicons/react/24/outline";

interface TransactionsTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdateSilent: (id: string, updates: Partial<Transaction>) => Promise<void>;
  onDeleteMultiple: (ids: string[]) => Promise<void>;
  onUpdateMultiple: (ids: string[], updates: Partial<Pick<Transaction, "category_name" | "type">>) => Promise<void>;
  onDuplicate: (ids: string[]) => Promise<void>;
  categories: Array<{ id?: string; name: string; type: string }>;
  isUpdating?: boolean;
}

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
};

const typeColors = {
  Ingreso: "text-success bg-success/10 hover:bg-success/20",
  Gasto: "text-destructive bg-destructive/10 hover:bg-destructive/20",
  Inversión: "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20",
};

// Editable cell components
interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  type?: "text" | "number";
  className?: string;
  placeholder?: string;
}

function EditableTextCell({ value, onSave, className, placeholder }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn("h-8 text-sm", className)}
        autoFocus
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        "px-2 py-1 rounded-md cursor-pointer transition-all",
        "hover:bg-muted/80 group flex items-center gap-1",
        className
      )}
    >
      <span className="truncate">{value || <span className="text-muted-foreground italic">{placeholder || "Sin detalle"}</span>}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </div>
  );
}

function EditableAmountCell({ value, onSave, className }: { value: number; onSave: (value: number) => void; className?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatEditValue = (val: string) => {
    const num = parseInt(val.replace(/\D/g, ""), 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("es-CL");
  };

  const handleSave = () => {
    const numValue = parseInt(editValue.replace(/\D/g, ""), 10);
    if (!isNaN(numValue) && numValue !== value) {
      onSave(numValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value.toString());
      setIsEditing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    setEditValue(rawValue);
  };

  if (isEditing) {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <Input
          value={formatEditValue(editValue)}
          onChange={handleChange}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={cn("h-8 text-sm text-right w-36 pl-7", className)}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        "px-2 py-1 rounded-md cursor-pointer transition-all text-right",
        "hover:bg-muted/80 group flex items-center justify-end gap-1 font-semibold",
        className
      )}
    >
      <span>{formatCurrency(value)}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </div>
  );
}

interface SelectableCellProps<T extends string> {
  value: T;
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onSave: (value: T) => void;
  renderValue?: (value: T) => React.ReactNode;
  className?: string;
}

function SelectableCell<T extends string>({ 
  value, 
  options, 
  onSave, 
  renderValue,
  className 
}: SelectableCellProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md transition-all",
            "hover:bg-muted/80 group cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            className
          )}
        >
          {renderValue ? renderValue(value) : value}
          <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => {
              if (option.value !== value) {
                onSave(option.value);
              }
              setOpen(false);
            }}
            className="flex items-center gap-2"
          >
            {option.icon && <option.icon className="h-4 w-4" />}
            {option.label}
            {option.value === value && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
  onUpdateSilent,
  onDeleteMultiple,
  onUpdateMultiple,
  onDuplicate,
  categories,
  isUpdating = false,
}: TransactionsTableProps) {
  const [searchParams] = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true }
  ]);
  const [globalFilter, setGlobalFilter] = useState(searchParams.get("search") || "");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { isPrivacyMode } = usePrivacyMode();
  const { creditCards } = useCreditCards();
  
  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setGlobalFilter(searchFromUrl);
    }
  }, [searchParams]);

  // Clear selection when transactions change significantly
  useEffect(() => {
    setRowSelection({});
  }, [transactions.length]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleInlineUpdate = useCallback(async (id: string, field: keyof Transaction, value: unknown) => {
    await onUpdateSilent(id, { [field]: value });
  }, [onUpdateSilent]);

  const columns = useMemo<ColumnDef<Transaction>[]>(() => {
    const typeOptions = [
      { value: "Ingreso" as const, label: "Ingreso", icon: TrendingUp },
      { value: "Gasto" as const, label: "Gasto", icon: TrendingDown },
      { value: "Inversión" as const, label: "Inversión", icon: PiggyBank },
    ];

    return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() 
              ? true 
              : table.getIsSomePageRowsSelected() 
                ? "indeterminate" 
                : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Seleccionar todo"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
      minSize: 48,
      maxSize: 48,
    },
    {
      accessorKey: "date",
      size: 170,
      minSize: 170,
      maxSize: 170,
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
          <div className={cn("font-medium text-sm", isPrivacyMode && "privacy-blur-light")}>
            <InlineDateTimePicker
              value={date}
              onChange={(newDate) => {
                handleInlineUpdate(row.original.id, "date", newDate.toISOString());
              }}
              showTime={true}
            />
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      size: 130,
      minSize: 130,
      maxSize: 130,
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.original.type;
        const Icon = typeIcons[type];
        
        return (
          <SelectableCell
            value={type}
            options={typeOptions}
            onSave={(newType) => {
              handleInlineUpdate(row.original.id, "type", newType);
              // Also need to clear category if type changes
              const matchingCategory = categories.find(c => c.type === newType);
              if (!categories.some(c => c.name === row.original.category_name && c.type === newType)) {
                handleInlineUpdate(row.original.id, "category_name", matchingCategory?.name || "Sin categoría");
              }
            }}
            renderValue={(val) => {
              const TypeIcon = typeIcons[val];
        return (
          <Badge
            variant="outline"
                  className={cn("gap-1.5 font-medium cursor-pointer", typeColors[val])}
          >
                  <TypeIcon className="h-3.5 w-3.5" />
                  {val}
          </Badge>
              );
            }}
          />
        );
      },
      filterFn: (row, id, value) => {
        return value === "all" || row.getValue(id) === value;
      },
    },
    {
      accessorKey: "category_name",
      size: 180,
      minSize: 180,
      maxSize: 180,
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
        const categoryName = row.original.category_name;
        const type = row.original.type;
        
        if (categoryName === "⚡ Analizando...") {
          return <AnalyzingBadge />;
        }

        const filteredCats = categories.filter(c => c.type === type);
        
        return (
          <div className={cn(isPrivacyMode && "privacy-blur")}>
            <SelectableCell
              value={categoryName}
              options={filteredCats.map(c => ({ value: c.name, label: c.name }))}
              onSave={(newCategory) => handleInlineUpdate(row.original.id, "category_name", newCategory)}
              renderValue={(val) => (
                <span className="font-medium text-sm">{val}</span>
              )}
            />
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value === "all" || row.getValue(id) === value;
      },
    },
    {
      accessorKey: "detail",
      size: 250,
      minSize: 200,
      header: "Detalle",
      cell: ({ row }) => {
        return (
          <div className={cn("max-w-[280px]", isPrivacyMode && "privacy-blur")}>
            <EditableTextCell
              value={row.original.detail || ""}
              onSave={(newDetail) => handleInlineUpdate(row.original.id, "detail", newDetail || null)}
              placeholder="Agregar detalle..."
              className="text-sm text-muted-foreground"
            />
          </div>
        );
      },
    },
    // Credit Card column - only for Gastos
    ...(creditCards.length > 0 ? [{
      id: "card",
      size: 120,
      minSize: 100,
      maxSize: 140,
      header: () => (
        <div className="flex items-center gap-1 text-xs font-semibold">
          <CreditCard className="h-3.5 w-3.5" />
          Tarjeta
        </div>
      ),
      cell: ({ row }: { row: { original: Transaction } }) => {
        const type = row.original.type;
        const cardId = row.original.card_id;
        
        // Mostrar para Gastos e Ingresos (reembolsos)
        // No mostrar para Inversión
        if (type === "Inversión") {
          return <span className="text-xs text-muted-foreground/50">—</span>;
        }

        const selectedCard = creditCards.find(c => c.id === cardId);
        
        const cardOptions = [
          { value: "", label: "Cuenta", color: null },
          ...creditCards.map(c => ({ value: c.id, label: c.name, color: c.color })),
        ];

        return (
          <SelectableCell
            value={cardId || ""}
            options={cardOptions.map(c => ({ value: c.value, label: c.label }))}
            onSave={(newCardId) => handleInlineUpdate(row.original.id, "card_id", newCardId || null)}
            renderValue={() => {
              if (!selectedCard) {
                return (
                  <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    <span className="hidden sm:inline">Cuenta</span>
                  </span>
                );
              }
              return (
                <Badge 
                  variant="outline" 
                  className="text-xs gap-1 cursor-pointer"
                  style={{ borderColor: selectedCard.color || undefined }}
                >
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: selectedCard.color || "#6366f1" }}
                  />
                  <span className="truncate max-w-[60px]">{selectedCard.name}</span>
                </Badge>
              );
            }}
          />
        );
      },
    }] : []),
    {
      accessorKey: "amount",
      size: 150,
      minSize: 150,
      maxSize: 150,
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
          <div className={cn(isPrivacyMode && "privacy-blur")}>
            <EditableAmountCell
              value={amount}
              onSave={(newAmount) => handleInlineUpdate(row.original.id, "amount", newAmount)}
              className="text-sm"
            />
          </div>
        );
      },
    },
    {
      id: "actions",
      size: 60,
      minSize: 60,
      maxSize: 60,
      cell: ({ row }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 opacity-50 hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar en modal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate([row.original.id])}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(row.original.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
  }, [onEdit, onDelete, onDuplicate, categories, creditCards, isPrivacyMode, handleInlineUpdate]);

  // Fuzzy search + filters
  const fuzzyResults = useFuzzySearch(transactions, globalFilter);
  
  const filteredData = useMemo(() => {
    let data = globalFilter ? fuzzyResults : transactions;
    
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
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    enableRowSelection: true,
    autoResetPageIndex: false,
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);
  const hasSelection = selectedIds.length > 0;

  const uniqueCategories = Array.from(
    new Set(transactions.map((t) => t.category_name))
  );

  // Batch action handlers
  const handleBatchDelete = async () => {
    await onDeleteMultiple(selectedIds);
    setRowSelection({});
  };

  const handleBatchCategoryChange = async (category: string) => {
    await onUpdateMultiple(selectedIds, { category_name: category });
    setRowSelection({});
  };

  const handleBatchTypeChange = async (type: Transaction["type"]) => {
    const matchingCategory = categories.find(c => c.type === type);
    await onUpdateMultiple(selectedIds, { 
      type, 
      category_name: matchingCategory?.name || "Sin categoría" 
    });
    setRowSelection({});
  };

  const handleBatchDuplicate = async () => {
    await onDuplicate(selectedIds);
    setRowSelection({});
  };

  return (
    <div className="space-y-4 mx-auto">
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

      {/* Selection Toolbar */}
      {hasSelection && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-in slide-in-from-top-2 duration-200">
          {/* Header row - always visible */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <Badge variant="secondary" className="font-semibold">
              {selectedIds.length} seleccionada{selectedIds.length > 1 ? "s" : ""}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRowSelection({})}
              className="h-7 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              <span className="hidden xs:inline">Deseleccionar</span>
            </Button>
          </div>

          <div className="hidden sm:block flex-1" />

          {/* Actions - grid on mobile, flex on desktop */}
          <div className="grid grid-cols-4 sm:flex sm:items-center gap-2">
            {/* Change Category */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 sm:h-8 px-2 sm:px-3">
                  <Tag className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Categoría</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[300px] overflow-auto">
                {categories
                  .filter(c => c.name && c.name.trim().length > 0)
                  .map((cat) => (
                    <DropdownMenuItem
                      key={cat.name + cat.type}
                      onClick={() => handleBatchCategoryChange(cat.name)}
                    >
                      <Badge variant="outline" className="mr-2 text-xs">
                        {cat.type}
                      </Badge>
                      {cat.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Change Type */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 sm:h-8 px-2 sm:px-3">
                  <ArrowRightLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Tipo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleBatchTypeChange("Ingreso")}>
                  <TrendingUp className="h-4 w-4 mr-2 text-success" />
                  Ingreso
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBatchTypeChange("Gasto")}>
                  <TrendingDown className="h-4 w-4 mr-2 text-destructive" />
                  Gasto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBatchTypeChange("Inversión")}>
                  <PiggyBank className="h-4 w-4 mr-2 text-blue-500" />
                  Inversión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Duplicate */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 sm:h-8 px-2 sm:px-3"
              onClick={handleBatchDuplicate}
            >
              <Copy className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Duplicar</span>
            </Button>

            {/* Delete */}
            <Button
              variant="destructive"
              size="sm"
              className="h-9 sm:h-8 px-2 sm:px-3"
              onClick={handleBatchDelete}
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Eliminar</span>
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-muted/50 border-b border-border">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wide"
                      style={{ 
                        width: header.column.columnDef.size,
                        minWidth: header.column.columnDef.minSize,
                        maxWidth: header.column.columnDef.maxSize,
                      }}
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
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      row.getIsSelected() && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2">
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          {hasSelection && (
            <span className="mr-2 font-medium text-primary">
              {selectedIds.length} de {table.getFilteredRowModel().rows.length} seleccionada(s)
            </span>
          )}
          {!hasSelection && (
            <span>{table.getFilteredRowModel().rows.length} transacción(es)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Page size selector */}
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 filas</SelectItem>
              <SelectItem value="20">20 filas</SelectItem>
              <SelectItem value="50">50 filas</SelectItem>
              <SelectItem value="100">100 filas</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Primera página</span>
              <ChevronDoubleLeftIcon className="h-4 w-4" />
            </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
              className="h-8 px-2"
          >
              <ChevronUp className="h-4 w-4 rotate-[-90deg]" />
          </Button>
          </div>

          {/* Page input */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Pág.</span>
            <Input
              type="number"
              min={1}
              max={table.getPageCount()}
              value={table.getState().pagination.pageIndex + 1}
              onChange={(e) => {
                const page = e.target.value ? Number(e.target.value) - 1 : 0;
                if (page >= 0 && page < table.getPageCount()) {
                  table.setPageIndex(page);
                }
              }}
              className="h-8 w-14 text-center"
            />
            <span className="text-sm text-muted-foreground">
              de {table.getPageCount()}
            </span>
          </div>

          <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
              className="h-8 px-2"
            >
              <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Última página</span>
              <ChevronDoubleRightIcon className="h-4 w-4" />
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
