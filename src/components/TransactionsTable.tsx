import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  ArrowLeftRight,
  GripVertical,
  ChevronRight,
  Minimize2,
  SearchX,
  Inbox,
  Plus,
} from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import NumberFlow, { type Format } from "@number-flow/react";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { useCreditCards } from "@/hooks/useCreditCards";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getCleanDetail, getImportSourceBadge } from "@/lib/import-source";
import { useSearchParams } from "react-router-dom";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnalyzingBadge } from "./AnalyzingBadge";
import { InlineDateTimePicker } from "./ui/date-time-picker";
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from "@heroicons/react/24/outline";
import { useCategories } from "@/hooks/useCategories";
import { BaseModal } from "./BaseModal";
import { CategoryCreateInline, CATEGORY_FORM_ID } from "./CategoryCreateInline";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "./ui/command";
import { DateRangeFilter, DateRangeValue } from "./DateRangeFilter";

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
  Reembolso: ArrowLeftRight,
};

const typeAmountColors = {
  Ingreso: "text-emerald-500",
  Gasto: "text-rose-500",
  Inversión: "text-blue-500",
  Reembolso: "text-amber-500",
};

// Signo contable de cada tipo (mismo criterio que balance = ingresos − gastos − inversiones)
const typeSign = (type: Transaction["type"]) =>
  type === "Gasto" || type === "Inversión" ? -1 : 1;

// Formato para NumberFlow en las stats del resumen (dígitos animados)
const SIGNED_CLP: Format = {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
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
            "focus:outline-none focus-visible:bg-muted/80",
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

// ── Empty state ──────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  const Icon = hasFilters ? SearchX : Inbox;
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
        <Icon className="h-5 w-5 text-muted-foreground/70" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {hasFilters ? "Nada con estos filtros" : "Sin transacciones todavía"}
        </p>
        <p className="text-xs text-muted-foreground">
          {hasFilters
            ? "Prueba ajustar la búsqueda o los filtros"
            : "Agrega la primera con el botón + o la tecla N"}
        </p>
      </div>
      {hasFilters && (
        <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </div>
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
  /** Si se entrega, muestra la acción de crear categoría con el texto buscado. */
  onCreate?: (name: string) => void;
}

function CategoryCombobox({ value, options, onSave, renderValue, className, placeholder = "Buscar categoría...", onCreate }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md transition-all",
            "hover:bg-muted/80 group cursor-pointer",
            "focus:outline-none focus-visible:bg-muted/80",
            className
          )}
        >
          {renderValue(value)}
          <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 border-0 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-lg overflow-hidden" align="start" side="bottom" sideOffset={4}>
        <Command className="rounded-lg">
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={placeholder}
            className="h-8 text-xs border-0 ring-0 focus:ring-0"
          />
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
          {/* Fuera de CommandList a propósito: dentro, el filtro de cmdk la
              escondería justo cuando la búsqueda no tiene resultados. */}
          {onCreate && (
            <button
              type="button"
              onClick={() => {
                const name = search.trim();
                setOpen(false);
                setSearch("");
                onCreate(name);
              }}
              className="flex w-full items-center gap-2 border-t border-border/60 px-2 py-2 text-left text-xs text-primary transition-colors hover:bg-muted/60"
            >
              <Plus className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {search.trim() ? `Crear “${search.trim()}”` : "Crear categoría"}
              </span>
            </button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Reimbursement Pill (inline clickable badge with own popover) ─────────

interface ReimbursementPillProps {
  value: string;
  options: CategoryComboboxOption[];
  onSave: (value: string) => void;
}

function ReimbursementPill({ value, options, onSave }: ReimbursementPillProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none flex-shrink-0",
            "cursor-pointer transition-all hover:brightness-125",
            "focus:outline-none",
            value
              ? "bg-emerald-500/15 text-emerald-400 font-medium"
              : "bg-white/5 text-muted-foreground/40 italic hover:text-muted-foreground/60"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Undo2 className="h-2 w-2 flex-shrink-0" />
          {value || "vincular"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 border-0 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-lg overflow-hidden" align="start" side="bottom" sideOffset={4}>
        <Command className="rounded-lg">
          <CommandInput placeholder="Buscar gasto..." className="h-8 text-xs border-0 ring-0 focus:ring-0" />
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
  highlightId?: string | null;
  categoryFilter?: string;
  onCategoryFilterChange?: (v: string) => void;
  cardFilter?: string;
  onCardFilterChange?: (v: string) => void;
  dateRange?: DateRangeValue;
  onDateRangeChange?: (v: DateRangeValue) => void;
}

const EMPTY_DATE_RANGE: DateRangeValue = {};

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
  highlightId,
  categoryFilter: externalCategoryFilter,
  onCategoryFilterChange,
  cardFilter: externalCardFilter,
  onCardFilterChange,
  dateRange: externalDateRange,
  onDateRangeChange,
}: TransactionsTableProps) {
  const [searchParams] = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [internalSearch, setInternalSearch] = useState(searchParams.get("search") || "");
  const [internalTypeFilter, setInternalTypeFilter] = useState<string>("all");
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<string>("all");
  const [internalCardFilter, setInternalCardFilter] = useState<string>("all");
  const [internalDateRange, setInternalDateRange] = useState<DateRangeValue>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [panelY, setPanelY] = useState<number | null>(null);
  const panelDragRef = React.useRef<{ startY: number; startTop: number } | null>(null);
  const rowDragRef = React.useRef<{ active: boolean; startIdx: number; currentIdx: number; initialSelection: RowSelectionState } | null>(null);
  const tbodyRef = React.useRef<HTMLTableSectionElement>(null);
  const { isPrivacyMode } = usePrivacyMode();
  const { creditCards, isLoading: isLoadingCards } = useCreditCards();
  const { addCategory } = useCategories();
  const isMobile = useIsMobile();

  // Crear categoría desde la celda: guarda a qué transacción asignarla,
  // con qué tipo nace y el nombre tecleado en la búsqueda.
  const [categoryDraft, setCategoryDraft] = useState<{
    transactionId: string;
    type: "Ingreso" | "Gasto" | "Inversión" | "Reembolso";
    name: string;
  } | null>(null);

  // Touch-through guard: en iOS, al tocar un item del menú "..." el menú se
  // desmonta y el click del navegador aterriza en la card que quedó debajo,
  // abriendo el modal de editar sin querer. Ignoramos clicks en cards
  // durante una ventana corta después de cerrar cualquier menú.
  const lastMenuCloseRef = useRef(0);
  const trackMenuClose = (open: boolean) => {
    if (!open) lastMenuCloseRef.current = Date.now();
  };
  const guardedEdit = (t: Transaction) => {
    if (Date.now() - lastMenuCloseRef.current < 400) return;
    onEdit(t);
  };

  const isControlled = externalSearch !== undefined;
  const globalFilter = isControlled ? externalSearch! : internalSearch;
  const setGlobalFilter = isControlled ? onSearchChange! : setInternalSearch;
  const typeFilter = isControlled ? externalTypeFilter! : internalTypeFilter;
  const setTypeFilter = isControlled ? onTypeFilterChange! : setInternalTypeFilter;
  const categoryFilter = isControlled ? externalCategoryFilter! : internalCategoryFilter;
  const setCategoryFilter = isControlled ? onCategoryFilterChange! : setInternalCategoryFilter;
  const cardFilter = isControlled ? (externalCardFilter ?? "all") : internalCardFilter;
  const setCardFilter = isControlled ? (onCardFilterChange ?? setInternalCardFilter) : setInternalCardFilter;
  const dateRange = isControlled ? (externalDateRange ?? EMPTY_DATE_RANGE) : internalDateRange;
  const setDateRange = isControlled ? (onDateRangeChange ?? setInternalDateRange) : setInternalDateRange;

  const hasActiveFilters =
    Boolean(globalFilter) || typeFilter !== "all" || categoryFilter !== "all" || cardFilter !== "all" ||
    Boolean(dateRange.from || dateRange.to);
  const clearFilters = () => {
    setGlobalFilter("");
    setTypeFilter("all");
    setCategoryFilter("all");
    setCardFilter("all");
    setDateRange({});
  };

  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl && !isControlled) setInternalSearch(searchFromUrl);
  }, [searchParams]);

  useEffect(() => {
    setRowSelection({});
  }, [transactions.length]);

  // Scroll to highlighted row from ⌘K
  useEffect(() => {
    if (!highlightId || !tbodyRef.current) return;
    const timer = setTimeout(() => {
      const row = tbodyRef.current?.querySelector(`[data-transaction-id="${highlightId}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(amount);

  const signColor = (amount: number) =>
    amount > 0 ? "text-emerald-500" : amount < 0 ? "text-rose-500" : "";

  const handleInlineUpdate = useCallback(async (id: string, field: keyof Transaction, value: unknown) => {
    await onUpdateSilent(id, { [field]: value });
  }, [onUpdateSilent]);

  const columns = useMemo<ColumnDef<Transaction>[]>(() => {
    const typeOptions = [
      { value: "Ingreso" as const, label: "Ingreso", icon: TrendingUp },
      { value: "Gasto" as const, label: "Gasto", icon: TrendingDown },
      { value: "Inversión" as const, label: "Inversión", icon: PiggyBank },
      { value: "Reembolso" as const, label: "Reembolso", icon: ArrowLeftRight },
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
        size: 120, minSize: 120, maxSize: 120,
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
        size: 310, minSize: 220,
        header: "Detalle",
        cell: ({ row }) => {
          const clean = getCleanDetail(row.original.detail);
          const sourceBadge = getImportSourceBadge(row.original.import_source);
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
                {sourceBadge && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background flex items-center justify-center"
                    title={sourceBadge.label}
                  >
                    <span className="text-[8px] leading-none">{sourceBadge.emoji}</span>
                  </div>
                )}
              </div>
              {/* Text */}
              <div className="flex flex-col min-w-0 flex-1">
                <EditableTextCell
                  value={clean}
                  onSave={(newDetail) => {
                    handleInlineUpdate(row.original.id, "detail", newDetail || null);
                  }}
                  placeholder="Agregar detalle..."
                  className="text-sm text-muted-foreground"
                />
                {row.original.bank_description && row.original.bank_description !== clean && (
                  <p
                    className="text-[10px] text-muted-foreground/50 truncate leading-none mt-0.5"
                    title={row.original.bank_description}
                  >
                    {row.original.bank_description}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },

      // ── Categoría (icono + color dot + nombre + reimbursement link) ────
      {
        accessorKey: "category_name",
        size: 200, minSize: 170, maxSize: 240,
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

          const reimbursementOptions = isReimbursement ? [
            { value: "", label: "Sin vincular", emoji: "🔗" },
            ...expenseCategories.map(c => ({
              value: c.name,
              label: c.name,
              emoji: c.icon || getCategoryIcon(c.name),
              color: c.color,
            })),
          ] : [];

          return (
            <div className={cn("flex items-center gap-1 overflow-hidden", isPrivacyMode && "privacy-blur")}>
              <CategoryCombobox
                value={categoryName}
                options={filteredCats.map(c => ({
                  value: c.name,
                  label: c.name,
                  emoji: c.icon || getCategoryIcon(c.name),
                  color: c.color,
                }))}
                onSave={(newCategory) => handleInlineUpdate(row.original.id, "category_name", newCategory)}
                onCreate={(name) =>
                  setCategoryDraft({ transactionId: row.original.id, type, name })
                }
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
              {/* Reimbursement linked category — compact inline pill with its own popover */}
              {isReimbursement && (
                <ReimbursementPill
                  value={linkedCategory || ""}
                  options={reimbursementOptions}
                  onSave={(val) => handleInlineUpdate(row.original.id, "reimbursement_for_category", val || null)}
                />
              )}
            </div>
          );
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },

      // ── Tarjeta ──────────────────────────────────────────────────────────
      ...((isLoadingCards || creditCards.length > 0) ? [{
        id: "card",
        size: 90, minSize: 80, maxSize: 110,
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
    if (cardFilter !== "all") {
      if (cardFilter === "none") {
        data = data.filter(t => !t.card_id);
      } else {
        data = data.filter(t => t.card_id === cardFilter);
      }
    }
    if (dateRange.from || dateRange.to) {
      data = data.filter(t => {
        const date = new Date(t.date);
        if (dateRange.from && date < dateRange.from) return false;
        if (dateRange.to && date > dateRange.to) return false;
        return true;
      });
    }
    return data;
  }, [fuzzyResults, transactions, globalFilter, typeFilter, categoryFilter, cardFilter, dateRange]);

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

  // ── Drag-to-select (Excel-like) ─────────────────────────────────────────
  const getRowIndexFromEvent = useCallback((e: MouseEvent | React.MouseEvent): number | null => {
    const tbody = tbodyRef.current;
    if (!tbody) return null;
    // Find the <tr> with data-row-index under the cursor
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tr = el?.closest("tr[data-row-index]");
    if (!tr) return null;
    const idx = parseInt(tr.getAttribute("data-row-index") || "", 10);
    return isNaN(idx) ? null : idx;
  }, []);

  const handleRowMouseDown = useCallback((e: React.MouseEvent, rowIndex: number) => {
    // Only left-click, ignore interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [role="menuitem"], [role="combobox"], [role="listbox"], [data-radix-collection-item], [type="checkbox"]')) return;

    rowDragRef.current = {
      active: false,
      startIdx: rowIndex,
      currentIdx: rowIndex,
      initialSelection: { ...rowSelection },
    };

    const allRows = table.getRowModel().rows;

    const handleMove = (ev: MouseEvent) => {
      if (!rowDragRef.current) return;
      const idx = getRowIndexFromEvent(ev);
      if (idx === null || idx === rowDragRef.current.currentIdx) return;

      // Mark as actively dragging (past threshold of 1 row)
      if (!rowDragRef.current.active && idx !== rowDragRef.current.startIdx) {
        rowDragRef.current.active = true;
      }

      rowDragRef.current.currentIdx = idx;
      const start = Math.min(rowDragRef.current.startIdx, idx);
      const end = Math.max(rowDragRef.current.startIdx, idx);

      // Build selection: keep initial + add drag range
      const newSelection: RowSelectionState = { ...rowDragRef.current.initialSelection };
      for (let i = start; i <= end; i++) {
        if (allRows[i]) newSelection[allRows[i].id] = true;
      }
      setRowSelection(newSelection);
    };

    const handleUp = () => {
      rowDragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      // Re-enable text selection
      document.body.style.userSelect = "";
    };

    // Disable text selection during drag
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [table, rowSelection, getRowIndexFromEvent]);

  const uniqueCategories = Array.from(new Set(transactions.map((t) => t.category_name)));

  // ── Summary stats (selected rows or current page) ────────────────────────
  const summaryStats = useMemo(() => {
    const rows = hasSelection
      ? selectedRows.map(r => r.original)
      : table.getRowModel().rows.map(r => r.original);
    if (rows.length === 0) return null;
    // Montos con signo: Gasto/Inversión restan, Ingreso/Reembolso suman
    const amounts = rows.map(r => typeSign(r.type) * r.amount);
    const sum = amounts.reduce((a, b) => a + b, 0);
    const income = rows.reduce((a, r) => a + (typeSign(r.type) > 0 ? r.amount : 0), 0);
    const expense = rows.reduce((a, r) => a + (typeSign(r.type) < 0 ? r.amount : 0), 0);
    return {
      count: rows.length,
      sum,
      avg: Math.round(sum / amounts.length),
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      income,
      expense,
      mixed: income > 0 && expense > 0,
    };
  }, [hasSelection, selectedRows, table.getRowModel().rows]);

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

  // ── Panel drag handlers ──────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const currentTop = panelY ?? 160;
    panelDragRef.current = { startY: e.clientY, startTop: currentTop };

    const handleMove = (ev: MouseEvent) => {
      if (!panelDragRef.current) return;
      const delta = ev.clientY - panelDragRef.current.startY;
      const newTop = Math.max(60, Math.min(window.innerHeight - 100, panelDragRef.current.startTop + delta));
      setPanelY(newTop);
    };
    const handleUp = () => {
      panelDragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [panelY]);

  // Reset panel state when selection is cleared
  useEffect(() => {
    if (!hasSelection) {
      setPanelExpanded(false);
      setPanelY(null);
    }
  }, [hasSelection]);

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
              <SelectItem value="Reembolso">Reembolsos</SelectItem>
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

          <Select value={cardFilter} onValueChange={setCardFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tarjeta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las tarjetas</SelectItem>
              <SelectItem value="none">Sin tarjeta</SelectItem>
              {creditCards.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  {card.name}{card.last_4_digits ? ` ···${card.last_4_digits}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateRangeFilter value={dateRange} onChange={setDateRange} className="w-full sm:w-[200px]" />
        </div>
      )}

      {/* ── Floating Selection Panel (right side) ────────────────────────── */}
      {hasSelection && (
        <div
          className={cn(
            "fixed right-4 z-50 transition-all duration-300 ease-out",
            "animate-in slide-in-from-right-5 fade-in-0",
            panelExpanded ? "w-64" : "w-12"
          )}
          style={{ top: panelY ?? 160 }}
        >
          {/* Collapsed pill */}
          {!panelExpanded && (
            <div
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl",
                "bg-background/95 backdrop-blur-xl border border-border/60",
                "shadow-lg shadow-black/8 dark:shadow-black/25"
              )}
            >
              {/* Drag handle */}
              <div
                className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                onMouseDown={handleDragStart}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>

              {/* Count badge */}
              <button
                onClick={() => setPanelExpanded(true)}
                className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                {selectedIds.length}
              </button>

              {/* Expand arrow */}
              <button
                onClick={() => setPanelExpanded(true)}
                className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
          )}

          {/* Expanded panel */}
          {panelExpanded && (
            <div
              className={cn(
                "rounded-xl overflow-hidden",
                "bg-background/95 backdrop-blur-xl border border-border/60",
                "shadow-xl shadow-black/10 dark:shadow-black/30",
                "animate-in slide-in-from-right-3 fade-in-0 duration-200"
              )}
            >
              {/* Header with drag handle */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/30">
                <div
                  className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                  onMouseDown={handleDragStart}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
                <Badge variant="secondary" className="font-semibold text-[11px] h-5 px-1.5">
                  {selectedIds.length}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  seleccionada{selectedIds.length > 1 ? "s" : ""}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => setPanelExpanded(false)}
                  className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Actions */}
              <div className="p-2 space-y-0.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm hover:bg-muted/60 transition-colors text-left">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[13px]">Cambiar categoría</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="left" className="max-h-[300px] overflow-auto">
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
                    <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm hover:bg-muted/60 transition-colors text-left">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[13px]">Cambiar tipo</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="left">
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

                <button
                  onClick={handleBatchDuplicate}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm hover:bg-muted/60 transition-colors text-left"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[13px]">Duplicar</span>
                </button>

                <div className="my-1 border-t border-border/40" />

                <button
                  onClick={handleBatchDelete}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="text-[13px]">Eliminar</span>
                </button>
              </div>

              {/* Quick summary */}
              {summaryStats && (
                <div className="px-3 py-2 border-t border-border/40 bg-muted/20">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Suma</span>
                      <span className={cn("text-[11px] font-mono font-bold tabular-nums", signColor(summaryStats.sum), isPrivacyMode && "privacy-blur")}>
                        <NumberFlow value={summaryStats.sum} locales="es-CL" format={SIGNED_CLP} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Prom</span>
                      <span className={cn("text-[11px] font-mono font-semibold tabular-nums", signColor(summaryStats.avg), isPrivacyMode && "privacy-blur")}>
                        <NumberFlow value={summaryStats.avg} locales="es-CL" format={SIGNED_CLP} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Min</span>
                      <span className={cn("text-[11px] font-mono tabular-nums", signColor(summaryStats.min), isPrivacyMode && "privacy-blur")}>
                        <NumberFlow value={summaryStats.min} locales="es-CL" format={SIGNED_CLP} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Max</span>
                      <span className={cn("text-[11px] font-mono tabular-nums", signColor(summaryStats.max), isPrivacyMode && "privacy-blur")}>
                        <NumberFlow value={summaryStats.max} locales="es-CL" format={SIGNED_CLP} />
                      </span>
                    </div>
                  </div>
                  {summaryStats.mixed && (
                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/30">
                      <span className={cn("text-[10px] font-mono tabular-nums text-emerald-500", isPrivacyMode && "privacy-blur")}>
                        +{formatCurrency(summaryStats.income)}
                      </span>
                      <span className={cn("text-[10px] font-mono tabular-nums text-rose-500", isPrivacyMode && "privacy-blur")}>
                        −{formatCurrency(summaryStats.expense)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Deselect */}
              <div className="px-2 py-1.5 border-t border-border/40">
                <button
                  onClick={() => setRowSelection({})}
                  className="w-full flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Deseleccionar todo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile Card List ─────────────────────────────────────────────── */}
      {isMobile ? (
        <>
          <div className="mobile-tx-list">
            {table.getRowModel().rows.length === 0 ? (
              <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
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
                    const sourceBadge = getImportSourceBadge(t.import_source);
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
                        onClick={() => guardedEdit(t)}
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
                          {sourceBadge && (
                            <div
                              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center"
                              title={sourceBadge.label}
                            >
                              <span className="text-[9px] leading-none">{sourceBadge.emoji}</span>
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
                          <DropdownMenu onOpenChange={trackMenuClose}>
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
                const sourceBadge = getImportSourceBadge(t.import_source);
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
                    onClick={() => guardedEdit(t)}
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
                      {sourceBadge && (
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center"
                          title={sourceBadge.label}
                        >
                          <span className="text-[9px] leading-none">{sourceBadge.emoji}</span>
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
                      <DropdownMenu onOpenChange={trackMenuClose}>
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
                          className="px-3 py-1.5 text-left text-xs font-semibold text-foreground uppercase tracking-wide"
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
                <tbody ref={tbodyRef} className="divide-y divide-border/50 bg-card">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length}>
                        <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
                      </td>
                    </tr>
                  ) : groupedRows ? (
                    groupedRows.map((group) => {
                      // Calculate flat index offset for shift+click
                      let flatOffset = 0;
                      for (const g of groupedRows) {
                        if (g.dayKey === group.dayKey) break;
                        flatOffset += g.rows.length;
                      }
                      return (
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
                          {group.rows.map((row, i) => {
                            const isMissing = row.original.category_name === "Sin categoría";
                            const isHighlighted = highlightId === row.original.id;
                            return (
                              <tr
                                key={row.id}
                                data-row-index={flatOffset + i}
                                data-transaction-id={row.original.id}
                                data-state={row.getIsSelected() && "selected"}
                                className={cn(
                                  "hover:bg-muted/40 transition-colors",
                                  row.getIsSelected() && "bg-primary/5 hover:bg-primary/10",
                                  isMissing && "border-l-2 border-l-amber-400/70",
                                  isHighlighted && "tx-highlight-pulse"
                                )}
                                onMouseDown={(e) => handleRowMouseDown(e, flatOffset + i)}
                              >
                                {row.getVisibleCells().map((cell) => (
                                  <td key={cell.id} className={cn("px-3 py-1.5 overflow-hidden", isMissing && "bg-amber-400/5")}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    table.getRowModel().rows.map((row, i) => {
                      const isMissing = row.original.category_name === "Sin categoría";
                      const isHighlighted = highlightId === row.original.id;
                      return (
                        <tr
                          key={row.id}
                          data-row-index={i}
                          data-transaction-id={row.original.id}
                          data-state={row.getIsSelected() && "selected"}
                          className={cn(
                            "hover:bg-muted/40 transition-colors",
                            row.getIsSelected() && "bg-primary/5 hover:bg-primary/10",
                            isMissing && "border-l-2 border-l-amber-400/70",
                            isHighlighted && "tx-highlight-pulse"
                          )}
                          onMouseDown={(e) => handleRowMouseDown(e, i)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className={cn("px-3 py-1.5 overflow-hidden", isMissing && "bg-amber-400/5")}>
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

            {/* ── Summary Footer (Excel-style) ─────────────────────────────── */}
            {summaryStats && (
              <div className="border-t border-border/50 bg-muted/20 px-3 py-1.5 flex items-center justify-end gap-6">
                {hasSelection && (
                  <span className="text-[11px] text-muted-foreground/60 mr-auto">
                    {summaryStats.count} seleccionada{summaryStats.count > 1 ? "s" : ""}
                  </span>
                )}
                {summaryStats.mixed && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Ingresos</span>
                      <span className={cn("text-xs font-mono font-semibold tabular-nums text-emerald-500", isPrivacyMode && "privacy-blur")}>
                        +{formatCurrency(summaryStats.income)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Gastos</span>
                      <span className={cn("text-xs font-mono font-semibold tabular-nums text-rose-500", isPrivacyMode && "privacy-blur")}>
                        −{formatCurrency(summaryStats.expense)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Min</span>
                  <span className={cn("text-xs font-mono font-semibold tabular-nums", signColor(summaryStats.min), isPrivacyMode && "privacy-blur")}>
                    <NumberFlow value={summaryStats.min} locales="es-CL" format={SIGNED_CLP} />
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Max</span>
                  <span className={cn("text-xs font-mono font-semibold tabular-nums", signColor(summaryStats.max), isPrivacyMode && "privacy-blur")}>
                    <NumberFlow value={summaryStats.max} locales="es-CL" format={SIGNED_CLP} />
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Prom</span>
                  <span className={cn("text-xs font-mono font-semibold tabular-nums", signColor(summaryStats.avg), isPrivacyMode && "privacy-blur")}>
                    <NumberFlow value={summaryStats.avg} locales="es-CL" format={SIGNED_CLP} />
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Suma</span>
                  <span className={cn("text-xs font-mono font-bold tabular-nums", signColor(summaryStats.sum), isPrivacyMode && "privacy-blur")}>
                    <NumberFlow value={summaryStats.sum} locales="es-CL" format={SIGNED_CLP} />
                  </span>
                </div>
              </div>
            )}
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

      {/* Crear categoría desde una celda y asignarla a esa transacción */}
      <BaseModal
        open={categoryDraft !== null}
        onOpenChange={(open) => !open && setCategoryDraft(null)}
        title="Nueva categoría"
        maxWidth="sm"
        footer={
          <Button
            type="submit"
            form={CATEGORY_FORM_ID}
            className="w-full rounded-full"
            disabled={addCategory.isPending}
          >
            Crear categoría
          </Button>
        }
      >
        {categoryDraft && (
          <CategoryCreateInline
            initialName={categoryDraft.name}
            type={categoryDraft.type}
            backLabel="Cancelar"
            onBack={() => setCategoryDraft(null)}
            onSubmit={async (category) => {
              try {
                await addCategory.mutateAsync(category);
              } catch {
                // addCategory ya notifica el error; quedarse en el formulario.
                return;
              }
              await handleInlineUpdate(
                categoryDraft.transactionId,
                "category_name",
                category.name
              );
              setCategoryDraft(null);
            }}
          />
        )}
      </BaseModal>
    </div>
  );
}
