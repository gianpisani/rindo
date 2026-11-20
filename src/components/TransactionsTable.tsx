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
  Column,
  Row,
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
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  X,
  Copy,
  Check,
  Tag,
  ArrowRightLeft,
  CreditCard,
  Undo2,
  ArrowLeftRight,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  ArrowDownToLine,
  LineChart,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Transaction } from "@/hooks/useTransactions";
import {
  TRANSACTION_TYPES,
  INVESTMENT_TYPES,
  allowsNegativeAmount,
  displaySign,
  signPrefix,
  isCardPayment,
  isCardPaymentCategory,
  CARD_PAYMENT_ICON,
  type TransactionType,
} from "@/lib/ledger";
import { getCleanDetail } from "@/lib/whisper";
import NumberFlow, { type Format } from "@number-flow/react";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { useCreditCards } from "@/hooks/useCreditCards";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnalyzingBadge } from "./AnalyzingBadge";
import { InlineDateTimePicker } from "./ui/date-time-picker";
import { useCategories } from "@/hooks/useCategories";
import { CategoryComposer } from "./CategoryComposer";
import { QuickCategoryPicker } from "./QuickCategoryPicker";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "./ui/command";
import type { DateRangeValue } from "./DateRangeFilter";
import { tintColor } from "@/lib/category-color";

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
  if (isCardPaymentCategory(name)) return CARD_PAYMENT_ICON;
  const lower = name.toLowerCase();
  if (CATEGORY_ICONS[lower]) return CATEGORY_ICONS[lower];
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "🏷️";
}

// ── Avatar helpers ─────────────────────────────────────────────────────────

// The avatar shows what the movement *is*: its category icon on a wash of the
// category color. Uncolored categories fall back to the neutral muted tone.
function categoryAvatar(name: string, categories: { name: string; icon?: string | null; color?: string | null }[]) {
  const category = categories.find(c => c.name === name);
  const analyzing = name === "⚡ Analizando...";
  return {
    emoji: analyzing ? "⚡" : category?.icon || getCategoryIcon(name),
    style: { backgroundColor: tintColor(category?.color) },
  };
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

const typeIcons: Record<TransactionType, typeof TrendingUp> = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
  Rescate: ArrowDownToLine,
  Rendimiento: LineChart,
  Reembolso: ArrowLeftRight,
};

export const typeAmountColors: Record<TransactionType, string> = {
  Ingreso: "text-success",
  Gasto: "text-foreground",
  // Montos como texto: un tono más oscuro en claro para llegar a 4.5:1.
  Inversión: "text-blue-600 dark:text-blue-500",
  Rescate: "text-cyan-700 dark:text-cyan-500",
  Rendimiento: "text-violet-600 dark:text-violet-500",
  Reembolso: "text-success",
};

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(amount);

const signColor = (amount: number) =>
  amount > 0 ? "text-success" : "";

// Formato con signo: NumberFlow en el panel de selección y la suma del pie.
const SIGNED_CLP: Format = {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
};
const formatSignedCLP = new Intl.NumberFormat("es-CL", SIGNED_CLP).format;

// ── Editable cell components ───────────────────────────────────────────────

function EditableTextCell({ value, onSave, className, placeholder }: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
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
        "px-2 py-1 rounded-card cursor-pointer transition-all",
        "group flex items-center gap-1",
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

function EditableAmountCell({
  value,
  onSave,
  className,
  allowNegative = false,
}: {
  value: number;
  onSave: (value: number) => void;
  className?: string;
  /** El rendimiento puede ser negativo: editarlo no debe comerse el signo. */
  allowNegative?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  // El signo sobrevive al tipeo solo donde tiene sentido; el resto son dígitos.
  const sanitize = (raw: string) => {
    const isNegative = allowNegative && /^\s*[-−]/.test(raw);
    return (isNegative ? "-" : "") + raw.replace(/\D/g, "");
  };

  const formatEditValue = (val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return val === "-" ? "-" : "";
    return num.toLocaleString("es-CL");
  };

  const handleSave = () => {
    const numValue = parseInt(editValue, 10);
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
          onChange={(e) => setEditValue(sanitize(e.target.value))}
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
        "px-2 py-1 rounded-card cursor-pointer transition-all text-right",
        "group flex items-center justify-end gap-1 font-medium font-mono tabular-nums",
        className
      )}
    >
      <span>{formatCLP(value)}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </div>
  );
}

/** Clases del botón que abre un editor inline de celda. */
const CELL_TRIGGER =
  "flex items-center gap-1 px-2 py-1 rounded-card transition-all group cursor-pointer";

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
        <button className={cn(CELL_TRIGGER, className)}>
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

/** Encabezado que ordena la columna al hacer click. */
function SortHeader({ column, label, alignEnd }: { column: Column<Transaction>; label: string; alignEnd?: boolean }) {
  const sorted = column.getIsSorted();
  return (
    <div
      className={cn("flex items-center cursor-pointer hover:bg-muted rounded-card px-2 py-1", alignEnd && "justify-end ml-auto")}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      <span className="text-xs font-medium">{label}</span>
      {sorted === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> :
        sorted === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> :
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────

function TableEmpty({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return hasFilters ? (
    <EmptyState action={{ label: "Limpiar filtros", onClick: onClear }}>Nada con estos filtros</EmptyState>
  ) : (
    <EmptyState>Sin movimientos todavía: agrega el primero con + o la tecla N</EmptyState>
  );
}

// ── Category Combobox: a qué gasto devuelve un reembolso ─────────────

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
  /** El botón que abre la lista. */
  trigger: React.ReactNode;
  placeholder?: string;
}

function CategoryCombobox({ value, options, onSave, trigger, placeholder = "Buscar categoría..." }: CategoryComboboxProps) {
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
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 border-0 rounded-card overflow-hidden" align="start" side="bottom" sideOffset={4}>
        <Command className="rounded-card">
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={placeholder}
            className="h-8 text-xs border-0 ring-0 focus:ring-0"
          />
          <CommandList>
            <CommandEmpty className="p-4 text-center text-sm text-muted-foreground">
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
                    <span className="text-sm leading-none flex-shrink-0">{option.emoji}</span>
                  )}
                  {option.color && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="truncate text-sm">{option.label}</span>
                  {option.value === value && (
                    <Check className="h-3.5 w-3.5 ml-auto flex-shrink-0 text-foreground" />
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
  onUpdateSilent: (id: string, updates: Partial<Transaction>) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onUpdateMultiple: (ids: string[], updates: Partial<Pick<Transaction, "category_name" | "type">>) => void;
  onDuplicate: (ids: string[]) => void;
  categories: Array<{ id?: string; name: string; type: string; color?: string | null; icon?: string | null }>;
  // Los filtros viven en la página (los edita TransactionsToolbar).
  searchValue: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  cardFilter: string;
  onCardFilterChange: (v: string) => void;
  dateRange: DateRangeValue;
  onDateRangeChange: (v: DateRangeValue) => void;
  /** Modo selección: solo entonces se ven los checkboxes y se puede marcar filas. */
  selecting: boolean;
  onSelectingChange: (v: boolean) => void;
  pageSize: number;
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
  searchValue,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  cardFilter,
  onCardFilterChange,
  dateRange,
  onDateRangeChange,
  selecting,
  onSelectingChange,
  pageSize,
}: TransactionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [panelY, setPanelY] = useState<number | null>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const { isPrivacyMode } = usePrivacyMode();
  const { creditCards, isLoading: isLoadingCards } = useCreditCards();
  const { addCategory } = useCategories();
  const isMobile = useIsMobile();

  // Crear categoría desde la celda: guarda a qué transacción asignarla,
  // con qué tipo nace y el nombre tecleado en la búsqueda.
  const [categoryDraft, setCategoryDraft] = useState<{
    transactionId: string;
    type: TransactionType;
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
    if (!t.isPending) onEdit(t);
  };

  const hasActiveFilters =
    Boolean(searchValue) || typeFilter !== "all" || categoryFilter !== "all" || cardFilter !== "all" ||
    Boolean(dateRange.from || dateRange.to);
  const clearFilters = () => {
    onSearchChange("");
    onTypeFilterChange("all");
    onCategoryFilterChange("all");
    onCardFilterChange("all");
    onDateRangeChange({});
  };

  useEffect(() => {
    setRowSelection({});
  }, [transactions.length]);

  // Salir del modo selección suelta lo marcado.
  useEffect(() => {
    if (!selecting) setRowSelection({});
  }, [selecting]);

  useEffect(() => {
    setPageIndex(0);
  }, [pageSize]);

  const handleInlineUpdate = useCallback((id: string, field: keyof Transaction, value: unknown) => {
    if (id.startsWith("pending-")) return;
    onUpdateSilent(id, { [field]: value });
  }, [onUpdateSilent]);

  // Cambiar la categoría es el mismo selector que en el inicio, y optimista:
  // la fila cambia al tocar y la red va detrás.
  const { save: saveInline, categoryOptions } = useInlineEdit();
  const withCategoryPicker = useCallback((t: Transaction, trigger: React.ReactElement) =>
    t.isPending || t.category_name === ANALYZING_CATEGORY ? trigger : (
      <QuickCategoryPicker
        value={t.category_name}
        options={categoryOptions(t.type)}
        title={getCleanDetail(t.detail) || undefined}
        onPick={(name) => saveInline(t, { category_name: name })}
        onCreate={(name) => setCategoryDraft({ transactionId: t.id, type: t.type, name })}
        // Mismo resguardo que los menús: el toque que cierra no abre la card de abajo.
        onOpenChange={(open) => { if (!open) lastMenuCloseRef.current = Date.now(); }}
      >
        {trigger}
      </QuickCategoryPicker>
    ), [categoryOptions, saveInline]);

  const columns = useMemo<ColumnDef<Transaction>[]>(() => {
    return [
      // ── Select (solo en modo selección) ─────────────────────────────────
      ...(selecting ? [{
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
      }] as ColumnDef<Transaction>[] : []),

      // ── Fecha ────────────────────────────────────────────────────────────
      {
        accessorKey: "date",
        size: 120, minSize: 120, maxSize: 120,
        header: ({ column }) => <SortHeader column={column} label="Fecha" />,
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
          const raw = row.original.detail || "";
          const clean = getCleanDetail(raw);
          const isBot = raw.startsWith("🤖");
          const avatar = categoryAvatar(row.original.category_name, categories);

          return (
            <div className={cn("flex items-center gap-2 max-w-[300px]", isPrivacyMode && "privacy-blur")}>
              {/* Avatar: tocarlo cambia la categoría */}
              <div className="relative flex-shrink-0">
                {withCategoryPicker(row.original, (
                  <button
                    type="button"
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm leading-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={avatar.style}
                    aria-label={`Cambiar categoría (${row.original.category_name})`}
                  >
                    {avatar.emoji}
                  </button>
                ))}
                {isBot && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background flex items-center justify-center"
                    title="Detectado por el bot"
                  >
                    <span className="text-xs leading-none scale-75">🤖</span>
                  </div>
                )}
              </div>
              {/* Text */}
              <div className="flex flex-col min-w-0 flex-1">
                <EditableTextCell
                  value={clean}
                  onSave={(newDetail) => {
                    const prefix = isBot ? "🤖 " : "";
                    handleInlineUpdate(row.original.id, "detail", newDetail ? prefix + newDetail : null);
                  }}
                  placeholder="Agregar detalle..."
                  className="text-sm text-muted-foreground"
                />
                {row.original.bank_description && row.original.bank_description !== clean && (
                  <p
                    className="text-xs truncate leading-none mt-0.5"
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
        header: ({ column }) => <SortHeader column={column} label="Categoría" />,
        cell: ({ row }) => {
          const categoryName = row.original.category_name;
          const type = row.original.type;
          const isMissing = categoryName === "Sin categoría";
          const isReimbursement = type === "Ingreso" && categoryName.toLowerCase().includes("reembolso");
          const linkedCategory = row.original.reimbursement_for_category;

          if (row.original.isPending || categoryName === "⚡ Analizando...") return <AnalyzingBadge saving={row.original.isPending} />;

          const dotColor = categories.find(c => c.name === categoryName)?.color;
          const optionsOfType = (t: string) =>
            categories.filter(c => c.type === t).map(c => ({
              value: c.name,
              label: c.name,
              emoji: c.icon || getCategoryIcon(c.name),
              color: c.color,
            }));

          return (
            <div className={cn("flex items-center gap-1 overflow-hidden", isPrivacyMode && "privacy-blur")}>
              {withCategoryPicker(row.original, (
                  <button className={cn(CELL_TRIGGER, "max-w-full overflow-hidden")}>
                    <div className="flex items-center gap-1.5 min-w-0">
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
                        title={categoryName}
                      >
                        {categoryName}
                      </span>
                    </div>
                    <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </button>
              ))}
              {/* Reembolso: a qué categoría de gasto devuelve, en una píldora con su propio popover */}
              {isReimbursement && (
                <CategoryCombobox
                  value={linkedCategory || ""}
                  options={[{ value: "", label: "Sin vincular", emoji: "🔗" }, ...optionsOfType("Gasto")]}
                  onSave={(val) => handleInlineUpdate(row.original.id, "reimbursement_for_category", val || null)}
                  placeholder="Buscar gasto..."
                  trigger={
                    <button
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs leading-none flex-shrink-0",
                        "cursor-pointer transition-all hover:brightness-125",
                        linkedCategory
                          ? "bg-success/15 text-success font-medium"
                          : "bg-white/5 italic"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Undo2 className="h-2 w-2 flex-shrink-0" />
                      {linkedCategory || "vincular"}
                    </button>
                  }
                />
              )}
            </div>
          );
        },
      },

      // ── Tarjeta ──────────────────────────────────────────────────────────
      ...((isLoadingCards || creditCards.length > 0) ? [{
        id: "card",
        size: 90, minSize: 80, maxSize: 110,
        header: () => (
          <div className="flex items-center gap-1 text-xs font-medium">
            <CreditCard className="h-3.5 w-3.5" />
            Tarjeta
          </div>
        ),
        cell: ({ row }: { row: { original: Transaction } }) => {
          const type = row.original.type;
          const cardId = row.original.card_id;
          if (INVESTMENT_TYPES.includes(type)) return <span className="text-xs">—</span>;

          const selectedCard = creditCards.find(c => c.id === cardId);

          return (
            <SelectableCell
              value={cardId || ""}
              options={[
                { value: "", label: "Cuenta" },
                ...creditCards.map(c => ({ value: c.id, label: c.name })),
              ]}
              onSave={(newCardId) => handleInlineUpdate(row.original.id, "card_id", newCardId || null)}
              renderValue={() => {
                if (!selectedCard) {
                  return (
                    <span className="text-xs flex items-center gap-1">
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
                    <span className="text-xs font-medium">
                      {digits ? `****${digits}` : selectedCard.name}
                    </span>
                  </div>
                );
              }}
            />
          );
        },
      }] as ColumnDef<Transaction>[] : []),

      // ── Monto (coloreado; el tipo se cambia en el editor) ───────────────
      {
        accessorKey: "amount",
        size: 170, minSize: 150, maxSize: 180,
        header: ({ column }) => <SortHeader column={column} label="Monto" alignEnd />,
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("amount"));
          const type = row.original.type;
          const amountColor = typeAmountColors[type];

          return (
            <div className={cn("flex items-center justify-end", isPrivacyMode && "privacy-blur")}>
              <EditableAmountCell
                value={amount}
                allowNegative={allowsNegativeAmount(type)}
                onSave={(newAmount) => handleInlineUpdate(row.original.id, "amount", newAmount)}
                className={cn("text-sm font-medium", amountColor)}
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
                size="icon"
                className="size-9 opacity-40 hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
                aria-label="Opciones del movimiento"
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
  }, [selecting, onEdit, onDelete, onDuplicate, categories, creditCards, isPrivacyMode, handleInlineUpdate, withCategoryPicker]);

  // ── Filtering ────────────────────────────────────────────────────────────

  const fuzzyResults = useFuzzySearch(transactions, searchValue);

  const filteredData = useMemo(() => {
    let data = searchValue ? fuzzyResults : transactions;
    if (typeFilter !== "all") data = data.filter(t => t.type === typeFilter);
    if (categoryFilter !== "all") data = data.filter(t => t.category_name === categoryFilter);
    if (cardFilter !== "all") data = data.filter(t => (cardFilter === "none" ? !t.card_id : t.card_id === cardFilter));
    if (dateRange.from || dateRange.to) {
      data = data.filter(t => {
        const date = new Date(t.date);
        if (dateRange.from && date < dateRange.from) return false;
        if (dateRange.to && date > dateRange.to) return false;
        return true;
      });
    }
    return data;
  }, [fuzzyResults, transactions, searchValue, typeFilter, categoryFilter, cardFilter, dateRange]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) =>
      setPageIndex((typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater).pageIndex),
    state: { sorting, rowSelection, pagination: { pageIndex, pageSize } },
    enableRowSelection: row => !row.original.isPending,
    autoResetPageIndex: false,
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);
  const hasSelection = selectedIds.length > 0;

  // ── Drag-to-select (Excel-like) ─────────────────────────────────────────
  const handleRowMouseDown = (e: React.MouseEvent, startIdx: number) => {
    // Solo en modo selección, con click izquierdo y fuera de controles
    if (!selecting || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [role="menuitem"], [role="combobox"], [role="listbox"], [data-radix-collection-item], [type="checkbox"]')) return;

    const initialSelection = { ...rowSelection };
    const allRows = table.getRowModel().rows;
    let currentIdx = startIdx;

    const handleMove = (ev: MouseEvent) => {
      if (!tbodyRef.current) return;
      // La fila con data-row-index bajo el cursor
      const tr = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("tr[data-row-index]");
      const idx = tr ? parseInt(tr.getAttribute("data-row-index") || "", 10) : NaN;
      if (isNaN(idx) || idx === currentIdx) return;
      currentIdx = idx;

      // Build selection: keep initial + add drag range
      const newSelection: RowSelectionState = { ...initialSelection };
      for (let i = Math.min(startIdx, idx); i <= Math.max(startIdx, idx); i++) {
        if (allRows[i]) newSelection[allRows[i].id] = true;
      }
      setRowSelection(newSelection);
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      // Re-enable text selection
      document.body.style.userSelect = "";
    };

    // Disable text selection during drag
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // Suma con signo de lo filtrado: Gasto/Inversión restan, Ingreso/Reembolso suman
  const filteredSum = filteredData.reduce((sum, t) => sum + displaySign(t.type) * t.amount, 0);

  // ── Stats de la selección (panel flotante) ──────────────────────────────
  const summaryStats = (() => {
    const rows = selectedRows.map(r => r.original);
    if (rows.length === 0) return null;
    // Montos con signo: Gasto/Inversión restan, Ingreso/Reembolso suman.
    // El pago de tarjeta no es gasto ni ingreso (sus compras ya contaron): vale 0.
    const amounts = rows.map(r => isCardPayment(r) ? 0 : displaySign(r.type) * r.amount);
    const sum = amounts.reduce((a, b) => a + b, 0);
    const income = amounts.reduce((a, v) => a + Math.max(0, v), 0);
    const expense = amounts.reduce((a, v) => a + Math.max(0, -v), 0);
    return {
      sum,
      avg: Math.round(sum / amounts.length),
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      income,
      expense,
      mixed: income > 0 && expense > 0,
    };
  })();

  // ── Batch handlers: aplican a lo seleccionado y limpian la selección ──────
  const runBatch = (action: () => void) => {
    action();
    setRowSelection({});
  };

  const handleBatchTypeChange = (type: Transaction["type"]) => {
    const matchingCategory = categories.find(c => c.type === type);
    runBatch(() => onUpdateMultiple(selectedIds, { type, category_name: matchingCategory?.name || "Sin categoría" }));
  };

  // ── Panel drag handlers ──────────────────────────────────────────────────
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startTop = panelY ?? 160;

    const handleMove = (ev: MouseEvent) => {
      setPanelY(Math.max(60, Math.min(window.innerHeight - 100, startTop + ev.clientY - startY)));
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

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

    // `start`: índice de la primera fila del grupo en la página, para el drag-to-select.
    const groups: { dayKey: string; start: number; rows: typeof rows }[] = [];
    rows.forEach((row, i) => {
      const dayKey = format(new Date(row.original.date), "yyyy-MM-dd");
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.dayKey === dayKey) {
        lastGroup.rows.push(row);
      } else {
        groups.push({ dayKey, start: i, rows: [row] });
      }
    });
    return groups;
  }, [table.getRowModel().rows, isDateSorted]);

  // Card de la lista móvil. Agrupada por día basta la hora; sin agrupar, va la fecha.
  const renderMobileCard = (row: Row<Transaction>, timeLabel: string) => {
    const t = row.original;
    const clean = getCleanDetail(t.detail);
    const avatar = categoryAvatar(t.category_name, categories);
    const isBot = (t.detail || "").startsWith("🤖");
    const catData = categories.find(c => c.name === t.category_name);
    const isMissing = t.category_name === "Sin categoría";
    const isSelected = row.getIsSelected();
    const avatarButton = (
      <button
        type="button"
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl leading-none select-none"
        style={avatar.style}
        aria-label={`Cambiar categoría (${t.category_name})`}
        tabIndex={selecting ? -1 : undefined}
      >
        {avatar.emoji}
      </button>
    );

    return (
      <div
        key={row.id}
        className={cn(
          "mobile-tx-card",
          t.isPending && "pointer-events-none opacity-60",
          isSelected && "mobile-tx-card-selected",
          isMissing && "mobile-tx-card-missing"
        )}
        // En modo selección tocar la card la marca; si no, abre el editor.
        onClick={() => (selecting ? row.toggleSelected(!isSelected) : guardedEdit(t))}
      >
        {selecting && (
          <div className="mobile-tx-checkbox">
            <Checkbox checked={isSelected} className="h-4 w-4" tabIndex={-1} />
          </div>
        )}

        {/* Avatar: tocarlo cambia la categoría (fuera del modo selección) */}
        <div className="relative flex-shrink-0">
          {selecting ? avatarButton : withCategoryPicker(t, avatarButton)}
          {isBot && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
              <span className="text-xs leading-none scale-75">🤖</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 ml-3">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-sm font-medium truncate", isPrivacyMode && "privacy-blur")}>
              {clean || <span className="italic font-normal">Sin detalle</span>}
            </span>
            <span className={cn(
              "text-sm font-medium tabular-nums whitespace-nowrap font-mono",
              typeAmountColors[t.type],
              isPrivacyMode && "privacy-blur"
            )}>
              {signPrefix(t.type, t.amount)}
              {formatCLP(Math.abs(t.amount))}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {t.isPending || t.category_name === "⚡ Analizando..." ? (
                <AnalyzingBadge saving={t.isPending} />
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: catData?.color || "currentColor" }} aria-hidden="true" />
                  <span className={cn("text-xs truncate", isMissing ? "text-amber-500" : "text-muted-foreground")}>
                    {t.category_name}
                  </span>
                </>
              )}
            </div>
            <span className="text-xs tabular-nums flex-shrink-0">
              {timeLabel}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 ml-1">
          <DropdownMenu onOpenChange={trackMenuClose}>
            <DropdownMenuTrigger asChild>
              <button className="mobile-tx-actions-btn" onClick={(e) => e.stopPropagation()} aria-label="Opciones del movimiento">
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
  };

  // Fila de la tabla de escritorio; `index` es su posición en la página.
  const renderDesktopRow = (row: Row<Transaction>, index: number) => {
    const isMissing = row.original.category_name === "Sin categoría";
    return (
      <tr
        key={row.id}
        data-row-index={index}
        data-transaction-id={row.original.id}
        data-state={row.getIsSelected() && "selected"}
        className={cn(
          "transition-colors",
          row.original.isPending && "pointer-events-none opacity-60",
          isMissing && "border-l-2 border-l-amber-400/70"
        )}
        onMouseDown={(e) => handleRowMouseDown(e, index)}
      >
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id} className={cn("px-3 py-1.5 overflow-hidden", isMissing && "bg-amber-400/5")}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 mx-auto">
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
                "flex flex-col items-center gap-1 py-2 px-1 rounded-card",
                "backdrop-blur-xl border",
                "shadow-float"
              )}
            >
              {/* Drag handle */}
              <div
                className="cursor-grab active:cursor-grabbing p-0.5 transition-colors"
                onMouseDown={handleDragStart}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>

              {/* Count badge */}
              <button
                onClick={() => setPanelExpanded(true)}
                className="size-9 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-medium transition-colors"
              >
                {selectedIds.length}
              </button>

              {/* Expand arrow */}
              <button
                onClick={() => setPanelExpanded(true)}
                className="size-9 grid place-items-center"
                aria-label="Expandir acciones"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
          )}

          {/* Expanded panel */}
          {panelExpanded && (
            <div
              className={cn(
                "rounded-card overflow-hidden",
                "backdrop-blur-xl border",
                "shadow-float",
                "animate-in slide-in-from-right-3 fade-in-0 duration-200"
              )}
            >
              {/* Header with drag handle */}
              <div className="flex items-center gap-2 px-3 py-2 border-b">
                <div
                  className="cursor-grab active:cursor-grabbing transition-colors"
                  onMouseDown={handleDragStart}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
                <Badge variant="secondary" className="font-medium text-xs h-5 px-1.5">
                  {selectedIds.length}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  seleccionada{selectedIds.length > 1 ? "s" : ""}
                </span>
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className="size-9" aria-label="Minimizar" onClick={() => setPanelExpanded(false)}>
                  <Minimize2 />
                </Button>
              </div>

              {/* Actions */}
              <div className="p-2 space-y-0.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-card text-sm transition-colors text-left">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">Cambiar categoría</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="left" className="max-h-[300px] overflow-auto">
                    {categories
                      .filter(c => c.name && c.name.trim().length > 0)
                      .map((cat) => (
                        <DropdownMenuItem key={cat.name + cat.type} onClick={() => runBatch(() => onUpdateMultiple(selectedIds, { category_name: cat.name }))}>
                          <span className="mr-2">{cat.icon || getCategoryIcon(cat.name)}</span>
                          {cat.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-card text-sm transition-colors text-left">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">Cambiar tipo</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="left">
                    {TRANSACTION_TYPES.filter((type) => type !== "Reembolso").map((type) => {
                      const Icon = typeIcons[type];
                      return (
                        <DropdownMenuItem key={type} onClick={() => handleBatchTypeChange(type)}>
                          <Icon className={cn("h-4 w-4 mr-2", typeAmountColors[type])} /> {type}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  onClick={() => runBatch(() => onDuplicate(selectedIds))}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-card text-sm transition-colors text-left"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">Duplicar</span>
                </button>

                <div className="my-1 border-t" />

                <button
                  onClick={() => runBatch(() => onDeleteMultiple(selectedIds))}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-card text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="text-sm">Eliminar</span>
                </button>
              </div>

              {/* Quick summary */}
              {summaryStats && (
                <div className="px-3 py-2 border-t">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {([
                      ["Suma", summaryStats.sum, "font-medium"],
                      ["Prom", summaryStats.avg, "font-medium"],
                      ["Min", summaryStats.min, ""],
                      ["Max", summaryStats.max, ""],
                    ] as const).map(([label, value, weight]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs">{label}</span>
                        <span className={cn("text-xs font-mono tabular-nums", weight, signColor(value), isPrivacyMode && "privacy-blur")}>
                          <NumberFlow value={value} locales="es-CL" format={SIGNED_CLP} />
                        </span>
                      </div>
                    ))}
                  </div>
                  {summaryStats.mixed && (
                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t">
                      <span className={cn("text-xs font-mono tabular-nums text-success", isPrivacyMode && "privacy-blur")}>
                        +{formatCLP(summaryStats.income)}
                      </span>
                      <span className={cn("text-xs font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                        −{formatCLP(summaryStats.expense)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Deselect */}
              <div className="px-2 py-1.5 border-t">
                <Button variant="ghost" size="xs" className="w-full text-muted-foreground" onClick={() => setRowSelection({})}>
                  <X />
                  Deseleccionar todo
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modo selección: cuántas van y cómo salir ─────────────────────── */}
      {selecting && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {hasSelection
              ? `${selectedIds.length} seleccionado${selectedIds.length > 1 ? "s" : ""}`
              : "Toca los movimientos para seleccionarlos"}
          </span>
          <Button variant="ghost" size="xs" onClick={() => onSelectingChange(false)}>
            Listo
          </Button>
        </div>
      )}

      {/* ── Lista: cards en el celular, tabla en escritorio ──────────────── */}
      {isMobile ? (
        <div className="mobile-tx-list">
          {table.getRowModel().rows.length === 0 ? (
            <TableEmpty hasFilters={hasActiveFilters} onClear={clearFilters} />
          ) : groupedRows ? (
            groupedRows.map((group) => (
              <React.Fragment key={group.dayKey}>
                <div className="mobile-tx-date-header">
                  {formatGroupDate(group.dayKey)}
                </div>
                {group.rows.map((row) => renderMobileCard(row, format(new Date(row.original.date), "HH:mm")))}
              </React.Fragment>
            ))
          ) : (
            table.getRowModel().rows.map((row) =>
              renderMobileCard(row, format(new Date(row.original.date), "d MMM HH:mm", { locale: es }))
            )
          )}
        </div>
      ) : (
        <div className="border rounded-card overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px]">
            <table className="w-full table-fixed">
              <thead className="bg-card border-b border-border sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-3 py-1.5 text-left text-xs font-medium text-foreground"
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
              <tbody ref={tbodyRef} className="divide-y bg-card">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <TableEmpty hasFilters={hasActiveFilters} onClear={clearFilters} />
                    </td>
                  </tr>
                ) : groupedRows ? (
                  groupedRows.map((group) => (
                    <React.Fragment key={group.dayKey}>
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="px-4 py-1 border-t first:border-t-0"
                        >
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatGroupDate(group.dayKey)}
                          </span>
                        </td>
                      </tr>
                      {group.rows.map((row, i) => renderDesktopRow(row, group.start + i))}
                    </React.Fragment>
                  ))
                ) : (
                  table.getRowModel().rows.map(renderDesktopRow)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pie: cuántos, su suma y la página ───────────────────────────── */}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {filteredData.length} movimiento{filteredData.length === 1 ? "" : "s"}
          {filteredData.length > 0 && (
            <>
              {" · Suma "}
              <span className={cn("font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                {formatSignedCLP(filteredSum)}
              </span>
            </>
          )}
        </span>
        {table.getPageCount() > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="size-9"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">
              {pageIndex + 1} de {table.getPageCount()}
            </span>
            <Button
              variant="ghost" size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="size-9"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Crear categoría desde una celda y asignarla a esa transacción */}
      <CategoryComposer
        open={categoryDraft !== null}
        onOpenChange={(open) => !open && setCategoryDraft(null)}
        initialName={categoryDraft?.name}
        fixedType={categoryDraft?.type}
        pending={addCategory.isPending}
        onSave={async (category) => {
          if (!categoryDraft) return;
          await addCategory.mutateAsync({
            name: category.name,
            type: category.type,
            color: category.color,
            icon: category.icon,
          });
          handleInlineUpdate(categoryDraft.transactionId, "category_name", category.name);
        }}
      />
    </div>
  );
}
