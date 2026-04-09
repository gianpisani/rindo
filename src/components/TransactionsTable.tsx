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
  Undo2,
} from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { useCreditCards } from "@/hooks/useCreditCards";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnalyzingBadge } from "./AnalyzingBadge";
import { InlineDateTimePicker } from "./ui/date-time-picker";
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from "@heroicons/react/24/outline";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "./ui/command";

// ── Category icon map ──────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  comida: "🍔",
  alimentación: "🍔",
  restaurante: "🍽️",
  almuerzo: "🍽️",
  cena: "🍽️",
  café: "☕",
  coffee: "☕",
  bar: "🍺",
  bebida: "🥤",
  transporte: "🚗",
  movilización: "🚗",
  taxi: "🚕",
  metro: "🚇",
  bencina: "⛽",
  gasolina: "⛽",
  estacionamiento: "🅿️",
  ropa: "👕",
  vestuario: "👗",
  calzado: "👟",
  moda: "👗",
  salud: "💊",
  médico: "🏥",
  farmacia: "💊",
  clínica: "🏥",
  dental: "🦷",
  deporte: "🏋️",
  gimnasio: "🏋️",
  fitness: "🏋️",
  entretenimiento: "🎬",
  cine: "🎬",
  teatro: "🎭",
  concierto: "🎵",
  streaming: "📺",
  netflix: "📺",
  spotify: "🎵",
  música: "🎵",
  educación: "📚",
  universidad: "🎓",
  curso: "📚",
  libro: "📖",
  viaje: "✈️",
  viajes: "✈️",
  hotel: "🏨",
  turismo: "🗺️",
  hospedaje: "🏨",
  supermercado: "🛒",
  mercado: "🛒",
  almacén: "🛒",
  tecnología: "💻",
  electrónica: "💻",
  computación: "💻",
  celular: "📱",
  mascota: "🐾",
  mascotas: "🐾",
  veterinario: "🐾",
  hogar: "🏠",
  arriendo: "🏠",
  casa: "🏠",
  muebles: "🪑",
  servicios: "💡",
  agua: "💧",
  internet: "📶",
  suscripción: "🔄",
  suscripciones: "🔄",
  ahorro: "💰",
  inversión: "📈",
  fondos: "📈",
  fintual: "📈",
  sueldo: "💵",
  salario: "💵",
  ingreso: "💵",
  regalo: "🎁",
  cumpleaños: "🎂",
  deuda: "💳",
  crédito: "💳",
  seguro: "🛡️",
  peluquería: "✂️",
  belleza: "💅",
  "sin categoría": "❓",
  transferencia: "↔️",
};

export function getCategoryIcon(name: string): string {
  if (!name) return "🏷️";
  const lower = name.toLowerCase();
  if (CATEGORY_ICONS[lower]) return CATEGORY_ICONS[lower];
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "🏷️";
}

// ── Avatar helpers ─────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#f97316", "#14b8a6",
];

function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getCleanDetail(detail: string | null): string {
  if (!detail) return "";
  return detail.replace(/^🤖\s*/, "").trim();
}

// ── Date group helpers ─────────────────────────────────────────────────────

function formatGroupDate(dayKey: string): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  if (dayKey === today) return "Hoy";
  if (dayKey === yesterday) return "Ayer";
  // Parse safely
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

// ── Type config ────────────────────────────────────────────────────────────

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
};

const typeAmountColors = {
  Ingreso: "text-emerald-500",
  Gasto: "text-rose-500",
  Inversión: "text-blue-500",
};

// ── Editable cell components ───────────────────────────────────────────────

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
    if (editValue !== value) onSave(editValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    else if (e.key === "Escape") { setEditValue(value); setIsEditing(false); }
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
      <span className="truncate" title={value || undefined}>
        {value || <span className="text-muted-foreground italic">{placeholder || "Sin detalle"}</span>}
      </span>
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(amount);

  const formatEditValue = (val: string) => {
    const num = parseInt(val.replace(/\D/g, ""), 10);
    return isNaN(num) ? "" : num.toLocaleString("es-CL");
  };

  const handleSave = () => {
    const numValue = parseInt(editValue.replace(/\D/g, ""), 10);
    if (!isNaN(numValue) && numValue !== value) onSave(numValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    else if (e.key === "Escape") { setEditValue(value.toString()); setIsEditing(false); }
  };

  if (isEditing) {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <Input
          value={formatEditValue(editValue)}
          onChange={(e) => setEditValue(e.target.value.replace(/\D/g, ""))}
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
        "hover:bg-muted/80 group flex items-center justify-end gap-1 font-semibold font-mono tabular-nums",
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

function SelectableCell<T extends string>({ value, options, onSave, renderValue, className }: SelectableCellProps<T>) {
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
            onClick={() => { if (option.value !== value) onSave(option.value); setOpen(false); }}
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

// ── Category Combobox (searchable, scrollable, with emojis) ─────────────

interface CategoryComboboxOption {
  value: string;
  label: string;
  emoji?: string;
  color?: string | null;
}

interface CategoryComboboxProps {
  value: string;
  options: CategoryComboboxOption[];
  onSave: (value: string) => void;
  renderValue: (value: string) => React.ReactNode;
  className?: string;
  placeholder?: string;
}

function CategoryCombobox({ value, options, onSave, renderValue, className, placeholder = "Buscar categoría..." }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md transition-all",
            "hover:bg-muted/80 group cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            className
          )}
        >
          {renderValue(value)}
          <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 border-0 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-lg overflow-hidden" align="start" side="bottom" sideOffset={4}>
        <Command className="rounded-lg">
          <CommandInput placeholder={placeholder} className="h-8 text-xs border-0 ring-0 focus:ring-0" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              Sin resultados
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    if (option.value !== value) onSave(option.value);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {option.emoji && (
                    <span className="text-base leading-none flex-shrink-0">{option.emoji}</span>
                  )}
                  {option.color && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="truncate text-sm">{option.label}</span>
                  {option.value === value && (
                    <Check className="h-3.5 w-3.5 ml-auto flex-shrink-0 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface TransactionsTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdateSilent: (id: string, updates: Partial<Transaction>) => Promise<void>;
  onDeleteMultiple: (ids: string[]) => Promise<void>;
  onUpdateMultiple: (ids: string[], updates: Partial<Pick<Transaction, "category_name" | "type">>) => Promise<void>;
  onDuplicate: (ids: string[]) => Promise<void>;
  categories: Array<{ id?: string; name: string; type: string; color?: string | null; icon?: string | null }>;
  isUpdating?: boolean;
  // Controlled filters (lifted to parent)
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  typeFilter?: string;
  onTypeFilterChange?: (v: string) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (v: string) => void;
}

// ── Main component ─────────────────────────────────────────────────────────

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
  searchValue: externalSearch,
  onSearchChange,
  typeFilter: externalTypeFilter,
  onTypeFilterChange,
  categoryFilter: externalCategoryFilter,
  onCategoryFilterChange,
}: TransactionsTableProps) {
  const [searchParams] = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [internalSearch, setInternalSearch] = useState(searchParams.get("search") || "");
  const [internalTypeFilter, setInternalTypeFilter] = useState<string>("all");
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<string>("all");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { isPrivacyMode } = usePrivacyMode();
  const { creditCards } = useCreditCards();
  const isMobile = useIsMobile();

  const isControlled = externalSearch !== undefined;
  const globalFilter = isControlled ? externalSearch! : internalSearch;
  const setGlobalFilter = isControlled ? onSearchChange! : setInternalSearch;
  const typeFilter = isControlled ? externalTypeFilter! : internalTypeFilter;
  const setTypeFilter = isControlled ? onTypeFilterChange! : setInternalTypeFilter;
  const categoryFilter = isControlled ? externalCategoryFilter! : internalCategoryFilter;
  const setCategoryFilter = isControlled ? onCategoryFilterChange! : setInternalCategoryFilter;

  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl && !isControlled) setInternalSearch(searchFromUrl);
  }, [searchParams]);

  useEffect(() => {
    setRowSelection({});
  }, [transactions.length]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(amount);

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
      // ── Select ──────────────────────────────────────────────────────────
      {
        id: "select",
        size: 48, minSize: 48, maxSize: 48,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
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
      },

      // ── Fecha ────────────────────────────────────────────────────────────
      {
        accessorKey: "date",
        size: 150, minSize: 150, maxSize: 150,
        header: ({ column }) => (
          <div
            className="flex items-center cursor-pointer hover:bg-muted rounded px-2 py-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-xs font-semibold">Fecha</span>
            {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> :
              column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> :
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}
          </div>
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.date);
          return (
            <div className={cn("font-medium text-sm", isPrivacyMode && "privacy-blur-light")}>
              <InlineDateTimePicker
                value={date}
                onChange={(newDate) => handleInlineUpdate(row.original.id, "date", newDate.toISOString())}
                showTime={true}
              />
            </div>
          );
        },
      },

      // ── Detalle (avatar + texto limpio) ──────────────────────────────────
      {
        accessorKey: "detail",
        size: 280, minSize: 200,
        header: "Detalle",
        cell: ({ row }) => {
          const raw = row.original.detail || "";
          const clean = getCleanDetail(raw);
          const isBot = raw.startsWith("🤖");
          const initial = clean.charAt(0).toUpperCase() || "?";
          const avatarColor = getAvatarColor(clean || "default");

          return (
            <div className={cn("flex items-center gap-2.5 max-w-[300px]", isPrivacyMode && "privacy-blur")}>
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold select-none"
                  style={{ backgroundColor: avatarColor }}
                >
                  {initial}
                </div>
                {isBot && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background flex items-center justify-center"
                    title="Detectado por el bot"
                  >
                    <span className="text-[8px] leading-none">🤖</span>
                  </div>
                )}
              </div>
              {/* Text */}
              <EditableTextCell
                value={clean}
                onSave={(newDetail) => {
                  const prefix = isBot ? "🤖 " : "";
                  handleInlineUpdate(row.original.id, "detail", newDetail ? prefix + newDetail : null);
                }}
                placeholder="Agregar detalle..."
                className="text-sm text-muted-foreground flex-1 min-w-0"
              />
            </div>
          );
        },
      },

      // ── Categoría (icono + color dot + nombre + reimbursement link) ────
      {
        accessorKey: "category_name",
        size: 180, minSize: 160, maxSize: 220,
        header: ({ column }) => (
          <div
            className="flex items-center cursor-pointer hover:bg-muted rounded px-2 py-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-xs font-semibold">Categoría</span>
            {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> :
              column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> :
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}
          </div>
        ),
        cell: ({ row }) => {
          const categoryName = row.original.category_name;
          const type = row.original.type;
          const isMissing = categoryName === "Sin categoría";
          const isReimbursement = type === "Ingreso" && categoryName.toLowerCase().includes("reembolso");
          const linkedCategory = row.original.reimbursement_for_category;

          if (categoryName === "⚡ Analizando...") return <AnalyzingBadge />;

          const catData = categories.find(c => c.name === categoryName);
          const emoji = catData?.icon || getCategoryIcon(categoryName);
          const dotColor = catData?.color || null;
          const filteredCats = categories.filter(c => c.type === type);
          const expenseCategories = categories.filter(c => c.type === "Gasto");

          return (
            <div className={cn("overflow-hidden space-y-0.5", isPrivacyMode && "privacy-blur")}>
              <CategoryCombobox
                value={categoryName}
                options={filteredCats.map(c => ({
                  value: c.name,
                  label: c.name,
                  emoji: c.icon || getCategoryIcon(c.name),
                  color: c.color,
                }))}
                onSave={(newCategory) => handleInlineUpdate(row.original.id, "category_name", newCategory)}
                renderValue={(val) => (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base leading-none flex-shrink-0">{emoji}</span>
                    {dotColor && (
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                    )}
                    <span
                      className={cn(
                        "font-medium text-sm truncate",
                        isMissing && "text-amber-500"
                      )}
                      title={val}
                    >
                      {val}
                    </span>
                  </div>
                )}
                className="max-w-full overflow-hidden"
              />
              {/* Reimbursement link for Reembolsos */}
              {isReimbursement && (
                <CategoryCombobox
                  value={linkedCategory || ""}
                  options={[
                    { value: "", label: "Sin vincular", emoji: "🔗" },
                    ...expenseCategories.map(c => ({
                      value: c.name,
                      label: c.name,
                      emoji: c.icon || getCategoryIcon(c.name),
                      color: c.color,
                    })),
                  ]}
                  onSave={(val) => handleInlineUpdate(row.original.id, "reimbursement_for_category", val || null)}
                  placeholder="Buscar gasto..."
                  renderValue={(val) => (
                    <div className="flex items-center gap-1 min-w-0">
                      <Undo2 className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                      <span className={cn(
                        "text-[11px] truncate",
                        val ? "text-emerald-600 font-medium" : "text-muted-foreground/60 italic"
                      )}>
                        {val || "Vincular a gasto..."}
                      </span>
                    </div>
                  )}
                  className="max-w-full overflow-hidden px-1"
                />
              )}
            </div>
          );
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },

      // ── Tarjeta ──────────────────────────────────────────────────────────
      ...(creditCards.length > 0 ? [{
        id: "card",
        size: 110, minSize: 90, maxSize: 130,
        header: () => (
          <div className="flex items-center gap-1 text-xs font-semibold">
            <CreditCard className="h-3.5 w-3.5" />
            Tarjeta
          </div>
        ),
        cell: ({ row }: { row: { original: Transaction } }) => {
          const type = row.original.type;
          const cardId = row.original.card_id;
          if (type === "Inversión") return <span className="text-xs text-muted-foreground/50">—</span>;

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
                    <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      Cuenta
                    </span>
                  );
                }
                const digits = selectedCard.last_4_digits;
                return (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: selectedCard.color || "#6366f1" }}
                    />
                    <span className="text-xs font-mono font-medium">
                      {digits ? `****${digits}` : selectedCard.name}
                    </span>
                  </div>
                );
              }}
            />
          );
        },
      }] as ColumnDef<Transaction>[] : []),

      // ── Monto (coloreado + tipo inline) ──────────────────────────────────
      {
        accessorKey: "amount",
        size: 170, minSize: 150, maxSize: 180,
        header: ({ column }) => (
          <div
            className="flex items-center justify-end cursor-pointer hover:bg-muted rounded px-2 py-1 ml-auto"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-xs font-semibold">Monto</span>
            {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> :
              column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> :
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}
          </div>
        ),
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("amount"));
          const type = row.original.type;
          const TypeIcon = typeIcons[type];
          const amountColor = typeAmountColors[type];

          return (
            <div className={cn("flex items-center justify-end gap-1", isPrivacyMode && "privacy-blur")}>
              {/* Tipo como icono clickeable */}
              <SelectableCell
                value={type}
                options={typeOptions}
                onSave={(newType) => {
                  handleInlineUpdate(row.original.id, "type", newType);
                  if (!categories.some(c => c.name === row.original.category_name && c.type === newType)) {
                    const matchingCategory = categories.find(c => c.type === newType);
                    handleInlineUpdate(row.original.id, "category_name", matchingCategory?.name || "Sin categoría");
                  }
                }}
                renderValue={(val) => {
                  const Icon = typeIcons[val];
                  return <Icon className={cn("h-3.5 w-3.5", typeAmountColors[val])} />;
                }}
                className="p-1 opacity-40 hover:opacity-100"
              />
              {/* Monto coloreado */}
              <EditableAmountCell
                value={amount}
                onSave={(newAmount) => handleInlineUpdate(row.original.id, "amount", newAmount)}
                className={cn("text-sm font-semibold", amountColor)}
              />
            </div>
          );
        },
      },

      // ── Acciones ─────────────────────────────────────────────────────────
      {
        id: "actions",
        size: 60, minSize: 60, maxSize: 60,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-40 hover:opacity-100"
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
        ),
      },
    ];
  }, [onEdit, onDelete, onDuplicate, categories, creditCards, isPrivacyMode, handleInlineUpdate]);

  // ── Filtering ────────────────────────────────────────────────────────────

  const fuzzyResults = useFuzzySearch(transactions, globalFilter);

  const filteredData = useMemo(() => {
    let data = globalFilter ? fuzzyResults : transactions;
    if (typeFilter !== "all") data = data.filter(t => t.type === typeFilter);
    if (categoryFilter !== "all") data = data.filter(t => t.category_name === categoryFilter);
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
    state: { sorting, rowSelection },
    initialState: { pagination: { pageSize: 100 } },
    enableRowSelection: true,
    autoResetPageIndex: false,
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);
  const hasSelection = selectedIds.length > 0;

  const uniqueCategories = Array.from(new Set(transactions.map((t) => t.category_name)));

  // ── Batch handlers ────────────────────────────────────────────────────────

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
    await onUpdateMultiple(selectedIds, { type, category_name: matchingCategory?.name || "Sin categoría" });
    setRowSelection({});
  };

  const handleBatchDuplicate = async () => {
    await onDuplicate(selectedIds);
    setRowSelection({});
  };

  // ── Date grouping ─────────────────────────────────────────────────────────

  const isDateSorted = sorting.length === 0 || sorting[0].id === "date";

  const groupedRows = useMemo(() => {
    const rows = table.getRowModel().rows;
    if (!isDateSorted) return null;

    const groups: { dayKey: string; rows: typeof rows }[] = [];
    for (const row of rows) {
      const dayKey = format(new Date(row.original.date), "yyyy-MM-dd");
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.dayKey === dayKey) {
        lastGroup.rows.push(row);
      } else {
        groups.push({ dayKey, rows: [row] });
      }
    }
    return groups;
  }, [table.getRowModel().rows, isDateSorted]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 mx-auto">
      {/* Filters — solo se renderizan si no están controlados externamente */}
      {!isControlled && (
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
                    {categories.find(c => c.name === cat)?.icon || getCategoryIcon(cat)} {cat}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Selection Toolbar */}
      {hasSelection && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <Badge variant="secondary" className="font-semibold">
              {selectedIds.length} seleccionada{selectedIds.length > 1 ? "s" : ""}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setRowSelection({})} className="h-7 px-2 text-xs">
              <X className="h-3 w-3 mr-1" />
              <span className="hidden xs:inline">Deseleccionar</span>
            </Button>
          </div>

          <div className="hidden sm:block flex-1" />

          <div className="grid grid-cols-4 sm:flex sm:items-center gap-2">
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
                    <DropdownMenuItem key={cat.name + cat.type} onClick={() => handleBatchCategoryChange(cat.name)}>
                      <span className="mr-2">{cat.icon || getCategoryIcon(cat.name)}</span>
                      {cat.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 sm:h-8 px-2 sm:px-3">
                  <ArrowRightLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Tipo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleBatchTypeChange("Ingreso")}>
                  <TrendingUp className="h-4 w-4 mr-2 text-emerald-500" /> Ingreso
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBatchTypeChange("Gasto")}>
                  <TrendingDown className="h-4 w-4 mr-2 text-rose-500" /> Gasto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBatchTypeChange("Inversión")}>
                  <PiggyBank className="h-4 w-4 mr-2 text-blue-500" /> Inversión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" className="h-9 sm:h-8 px-2 sm:px-3" onClick={handleBatchDuplicate}>
              <Copy className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Duplicar</span>
            </Button>

            <Button variant="destructive" size="sm" className="h-9 sm:h-8 px-2 sm:px-3" onClick={handleBatchDelete}>
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Eliminar</span>
            </Button>
          </div>
        </div>
      )}

      {/* ── Mobile Card List ─────────────────────────────────────────────── */}
      {isMobile ? (
        <>
          <div className="mobile-tx-list">
            {table.getRowModel().rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No se encontraron transacciones
              </div>
            ) : groupedRows ? (
              groupedRows.map((group) => (
                <React.Fragment key={group.dayKey}>
                  {/* Date sticky header */}
                  <div className="mobile-tx-date-header">
                    {formatGroupDate(group.dayKey)}
                  </div>
                  {/* Transaction cards */}
                  {group.rows.map((row) => {
                    const t = row.original;
                    const clean = getCleanDetail(t.detail);
                    const initial = clean.charAt(0).toUpperCase() || "?";
                    const avatarColor = getAvatarColor(clean || "default");
                    const isBot = (t.detail || "").startsWith("🤖");
                    const catData = categories.find(c => c.name === t.category_name);
                    const emoji = catData?.icon || getCategoryIcon(t.category_name);
                    const amountColor = typeAmountColors[t.type];
                    const time = format(new Date(t.date), "HH:mm");
                    const isMissing = t.category_name === "Sin categoría";
                    const isSelected = row.getIsSelected();

                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "mobile-tx-card",
                          isSelected && "mobile-tx-card-selected",
                          isMissing && "mobile-tx-card-missing"
                        )}
                        onClick={() => onEdit(t)}
                      >
                        {/* Selection checkbox */}
                        <div
                          className="mobile-tx-checkbox"
                          onClick={(e) => {
                            e.stopPropagation();
                            row.toggleSelected(!isSelected);
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="h-4 w-4"
                            tabIndex={-1}
                          />
                        </div>

                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold select-none"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initial}
                          </div>
                          {isBot && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                              <span className="text-[9px] leading-none">🤖</span>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 ml-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn(
                              "text-sm font-semibold truncate",
                              isPrivacyMode && "privacy-blur"
                            )}>
                              {clean || <span className="text-muted-foreground/50 italic font-normal">Sin detalle</span>}
                            </span>
                            <span className={cn(
                              "text-sm font-bold tabular-nums whitespace-nowrap font-mono",
                              amountColor,
                              isPrivacyMode && "privacy-blur"
                            )}>
                              {t.type === "Ingreso" ? "+" : t.type === "Gasto" ? "−" : ""}
                              {formatCurrency(t.amount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {t.category_name === "⚡ Analizando..." ? (
                                <AnalyzingBadge />
                              ) : (
                                <>
                                  <span className="text-xs leading-none">{emoji}</span>
                                  <span className={cn(
                                    "text-xs truncate",
                                    isMissing ? "text-amber-500" : "text-muted-foreground"
                                  )}>
                                    {t.category_name}
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground/50 tabular-nums flex-shrink-0">
                              {time}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 ml-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="mobile-tx-actions-btn"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEdit(t)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDuplicate([t.id])}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDelete(t.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))
            ) : (
              // Flat list
              table.getRowModel().rows.map((row) => {
                const t = row.original;
                const clean = getCleanDetail(t.detail);
                const initial = clean.charAt(0).toUpperCase() || "?";
                const avatarColor = getAvatarColor(clean || "default");
                const isBot = (t.detail || "").startsWith("🤖");
                const catData = categories.find(c => c.name === t.category_name);
                const emoji = catData?.icon || getCategoryIcon(t.category_name);
                const amountColor = typeAmountColors[t.type];
                const dateStr = format(new Date(t.date), "d MMM HH:mm", { locale: es });
                const isMissing = t.category_name === "Sin categoría";
                const isSelected = row.getIsSelected();

                return (
                  <div
                    key={row.id}
                    className={cn(
                      "mobile-tx-card",
                      isSelected && "mobile-tx-card-selected",
                      isMissing && "mobile-tx-card-missing"
                    )}
                    onClick={() => onEdit(t)}
                  >
                    <div
                      className="mobile-tx-checkbox"
                      onClick={(e) => {
                        e.stopPropagation();
                        row.toggleSelected(!isSelected);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="h-4 w-4"
                        tabIndex={-1}
                      />
                    </div>

                    <div className="relative flex-shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold select-none"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {initial}
                      </div>
                      {isBot && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                          <span className="text-[9px] leading-none">🤖</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 ml-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "text-sm font-semibold truncate",
                          isPrivacyMode && "privacy-blur"
                        )}>
                          {clean || <span className="text-muted-foreground/50 italic font-normal">Sin detalle</span>}
                        </span>
                        <span className={cn(
                          "text-sm font-bold tabular-nums whitespace-nowrap font-mono",
                          amountColor,
                          isPrivacyMode && "privacy-blur"
                        )}>
                          {t.type === "Ingreso" ? "+" : t.type === "Gasto" ? "−" : ""}
                          {formatCurrency(t.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs leading-none">{emoji}</span>
                          <span className={cn(
                            "text-xs truncate",
                            isMissing ? "text-amber-500" : "text-muted-foreground"
                          )}>
                            {t.category_name}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground/50 tabular-nums flex-shrink-0">
                          {dateStr}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 ml-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="mobile-tx-actions-btn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(t)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDuplicate([t.id])}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(t.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Mobile Pagination */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {table.getFilteredRowModel().rows.length} movimientos
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-8 px-2 text-xs"
              >
                <ChevronUp className="h-4 w-4 rotate-[-90deg] mr-1" />
                Ant
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-2">
                {table.getState().pagination.pageIndex + 1}/{table.getPageCount()}
              </span>
              <Button
                variant="ghost" size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-8 px-2 text-xs"
              >
                Sig
                <ChevronDown className="h-4 w-4 rotate-[-90deg] ml-1" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── Desktop Table ──────────────────────────────────────────────── */}
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px]">
              <table className="w-full table-fixed">
                <thead className="bg-card border-b border-border sticky top-0 z-10 shadow-sm">
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
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-border/50 bg-card">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No se encontraron transacciones
                      </td>
                    </tr>
                  ) : groupedRows ? (
                    groupedRows.map((group) => (
                      <React.Fragment key={group.dayKey}>
                        <tr>
                          <td
                            colSpan={columns.length}
                            className="px-4 py-1 bg-muted/30 border-t border-border/30 first:border-t-0"
                          >
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {formatGroupDate(group.dayKey)}
                            </span>
                          </td>
                        </tr>
                        {group.rows.map((row) => {
                          const isMissing = row.original.category_name === "Sin categoría";
                          return (
                            <tr
                              key={row.id}
                              data-state={row.getIsSelected() && "selected"}
                              className={cn(
                                "hover:bg-muted/40 transition-colors",
                                row.getIsSelected() && "bg-primary/5 hover:bg-primary/10",
                                isMissing && "border-l-2 border-l-amber-400/70"
                              )}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className={cn("px-4 py-1.5 overflow-hidden", isMissing && "bg-amber-400/5")}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  ) : (
                    table.getRowModel().rows.map((row) => {
                      const isMissing = row.original.category_name === "Sin categoría";
                      return (
                        <tr
                          key={row.id}
                          data-state={row.getIsSelected() && "selected"}
                          className={cn(
                            "hover:bg-muted/40 transition-colors",
                            row.getIsSelected() && "bg-primary/5 hover:bg-primary/10",
                            isMissing && "border-l-2 border-l-amber-400/70"
                          )}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className={cn("px-4 py-1.5 overflow-hidden", isMissing && "bg-amber-400/5")}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Desktop Pagination */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              {hasSelection ? (
                <span className="mr-2 font-medium text-primary">
                  {selectedIds.length} de {table.getFilteredRowModel().rows.length} seleccionada(s)
                </span>
              ) : (
                <span>{table.getFilteredRowModel().rows.length} transacción(es)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                  variant="outline" size="sm"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="h-8 w-8 p-0"
                >
                  <ChevronDoubleLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="h-8 px-2"
                >
                  <ChevronUp className="h-4 w-4 rotate-[-90deg]" />
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">Pág.</span>
                <Input
                  type="number"
                  min={1}
                  max={table.getPageCount()}
                  value={table.getState().pagination.pageIndex + 1}
                  onChange={(e) => {
                    const page = e.target.value ? Number(e.target.value) - 1 : 0;
                    if (page >= 0 && page < table.getPageCount()) table.setPageIndex(page);
                  }}
                  className="h-8 w-14 text-center"
                />
                <span className="text-sm text-muted-foreground">de {table.getPageCount()}</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="h-8 px-2"
                >
                  <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="h-8 w-8 p-0"
                >
                  <ChevronDoubleRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
