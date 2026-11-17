import { type RefObject } from "react";
import {
  Building2,
  CalendarClock,
  CheckSquare,
  Download,
  MoreHorizontal,
  RefreshCw,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { DateRangeFilter, type DateRangeValue } from "./DateRangeFilter";
import { TRANSACTION_TYPES } from "@/lib/ledger";
import { cn } from "@/lib/utils";

/**
 * La barra de Movimientos: una línea, y una sola siempre, también en el celular.
 *
 *   [buscador ───] [chips de lo activo] [Filtros ·2] [⋯]
 *
 * Buscar es lo que se usa; Filtros guarda tipo, tarjeta, categoría y fecha (y
 * su contador dice cuántos hay activos); lo que se toca una vez al mes —sync
 * del banco, cuotas futuras, seleccionar, filas por página, exportar— vive en
 * el menú "⋯".
 *
 * El único elemento elástico es el buscador. Los chips tienen techo: del
 * tercero en adelante colapsan en uno que dice cuántos hay, misma regla que
 * los avisos del inicio.
 */

/** Chips visibles antes de colapsar al contador. Igual que HomeNotices. */
const MAX_CHIPS = 2;

const ALL = "all";

const PAGE_SIZES = [10, 20, 50, 100];

/** "3 nov – 9 nov", "Desde 3 nov", "Hasta 9 nov". */
const dateLabel = ({ from, to }: DateRangeValue) => {
  const d = (date: Date) => format(date, "d MMM", { locale: es });
  if (from && to) return from.toDateString() === to.toDateString() ? d(from) : `${d(from)} – ${d(to)}`;
  return from ? `Desde ${d(from)}` : `Hasta ${d(to!)}`;
};

export interface ToolbarCategory {
  name: string;
  emoji: string;
}

export interface ToolbarCard {
  id: string;
  label: string;
}

interface TransactionsToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchRef?: RefObject<HTMLInputElement>;

  dateRange: DateRangeValue;
  onDateRangeChange: (value: DateRangeValue) => void;

  typeFilter: string;
  onTypeFilterChange: (value: string) => void;

  cardFilter: string;
  onCardFilterChange: (value: string) => void;
  cards: ToolbarCard[];
  cardsLoading?: boolean;

  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: ToolbarCategory[];

  futureCount: number;
  showFuture: boolean;
  onToggleFuture: () => void;

  isSyncing: boolean;
  onSync: () => void;
  onExport: () => void;

  selecting: boolean;
  onSelectingChange: (value: boolean) => void;

  pageSize: number;
  onPageSizeChange: (value: number) => void;
}

/** Un filtro activo, con su forma de apagarse. */
interface ActiveFilter {
  key: string;
  label: string;
  emoji?: string;
  clear: () => void;
}

/** Opción de un filtro que se elige con chips, no con un select. */
function OptionChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-muted text-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

export function TransactionsToolbar({
  searchValue,
  onSearchChange,
  searchRef,
  dateRange,
  onDateRangeChange,
  typeFilter,
  onTypeFilterChange,
  cardFilter,
  onCardFilterChange,
  cards,
  cardsLoading = false,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  futureCount,
  showFuture,
  onToggleFuture,
  isSyncing,
  onSync,
  onExport,
  selecting,
  onSelectingChange,
  pageSize,
  onPageSizeChange,
}: TransactionsToolbarProps) {
  // Los filtros que viven dentro del botón, fecha incluida.
  const active: ActiveFilter[] = [];
  if (dateRange.from || dateRange.to) {
    active.push({ key: "date", label: dateLabel(dateRange), clear: () => onDateRangeChange({}) });
  }
  if (typeFilter !== ALL) {
    active.push({ key: "type", label: typeFilter, clear: () => onTypeFilterChange(ALL) });
  }
  if (cardFilter !== ALL) {
    active.push({
      key: "card",
      label:
        cardFilter === "none"
          ? "Sin tarjeta"
          : cards.find((c) => c.id === cardFilter)?.label ?? "Tarjeta",
      clear: () => onCardFilterChange(ALL),
    });
  }
  if (categoryFilter !== ALL) {
    active.push({
      key: "category",
      label: categoryFilter,
      emoji: categories.find((c) => c.name === categoryFilter)?.emoji,
      clear: () => onCategoryFilterChange(ALL),
    });
  }

  const clearAll = () => {
    onDateRangeChange({});
    onTypeFilterChange(ALL);
    onCardFilterChange(ALL);
    onCategoryFilterChange(ALL);
  };

  const chips: ActiveFilter[] =
    active.length > MAX_CHIPS ? [{ key: "all", label: `${active.length} filtros`, clear: clearAll }] : active;

  return (
    <div className="flex items-center gap-2">
      {/* Buscar — el único elástico */}
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder="Buscar..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.blur();
          }}
          className="pl-9 pr-9"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Lo que está filtrado, a la vista. Los chips piden ancho de verdad
          (hasta dos, con nombres largos), así que aparecen desde lg; más
          angosto, el contador del botón dice lo mismo en 20px. */}
      {chips.length > 0 && (
        <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
          {chips.map((chip) => (
            <div
              key={chip.key}
              className="flex h-7 max-w-[150px] items-center gap-1.5 rounded-full border pl-2.5 pr-2"
            >
              {chip.emoji && (
                <span className="shrink-0 text-xs leading-none">{chip.emoji}</span>
              )}
              <span className="truncate text-xs font-medium">{chip.label}</span>
              <button
                type="button"
                onClick={chip.clear}
                aria-label={`Quitar filtro ${chip.label}`}
                className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtros — fecha, tipo, tarjeta y categoría */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-10 shrink-0 gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {active.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-xs font-medium tabular-nums text-background">
                {active.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px] space-y-3.5 p-3">
          <FilterSection title="Fecha">
            <DateRangeFilter
              value={dateRange}
              onChange={onDateRangeChange}
              className="h-9 w-full sm:w-full"
            />
          </FilterSection>

          <FilterSection title="Tipo">
            <div className="flex flex-wrap gap-1.5">
              <OptionChip
                active={typeFilter === ALL}
                onClick={() => onTypeFilterChange(ALL)}
              >
                Todos
              </OptionChip>
              {TRANSACTION_TYPES.map((type) => (
                <OptionChip
                  key={type}
                  active={typeFilter === type}
                  onClick={() => onTypeFilterChange(type)}
                >
                  {type}
                </OptionChip>
              ))}
            </div>
          </FilterSection>

          {(cardsLoading || cards.length > 0) && (
            <FilterSection title="Tarjeta">
              <div className="flex flex-wrap gap-1.5">
                <OptionChip
                  active={cardFilter === ALL}
                  onClick={() => onCardFilterChange(ALL)}
                >
                  Todas
                </OptionChip>
                <OptionChip
                  active={cardFilter === "none"}
                  onClick={() => onCardFilterChange("none")}
                >
                  Sin tarjeta
                </OptionChip>
                {cards.map((card) => (
                  <OptionChip
                    key={card.id}
                    active={cardFilter === card.id}
                    onClick={() => onCardFilterChange(card.id)}
                  >
                    {card.label}
                  </OptionChip>
                ))}
              </div>
            </FilterSection>
          )}

          <FilterSection title="Categoría">
            {/* Lista con buscador: las categorías son muchas y crecen. Va
                inline (cmdk), no en otro popover. */}
            <Command className="rounded-lg border border-border/60">
              <CommandInput placeholder="Buscar categoría..." className="h-9" />
              <CommandList className="max-h-[168px]">
                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                  Sin resultados
                </CommandEmpty>
                <CommandItem
                  value="__todas__"
                  onSelect={() => onCategoryFilterChange(ALL)}
                  className="text-xs"
                >
                  <span
                    className={cn(
                      "truncate",
                      categoryFilter === ALL && "font-medium text-foreground"
                    )}
                  >
                    Todas las categorías
                  </span>
                </CommandItem>
                {categories.map((category) => (
                  <CommandItem
                    key={category.name}
                    value={category.name}
                    onSelect={() => onCategoryFilterChange(category.name)}
                    className="gap-2 text-xs"
                  >
                    <span className="shrink-0 leading-none">{category.emoji}</span>
                    <span
                      className={cn(
                        "truncate",
                        categoryFilter === category.name &&
                          "font-medium text-foreground"
                      )}
                    >
                      {category.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </FilterSection>

          {active.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-8 w-full text-xs"
            >
              Limpiar filtros
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Lo que se toca una vez al mes */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            aria-label={isSyncing ? "Más opciones (sincronizando)" : "Más opciones"}
          >
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuItem onClick={() => onSelectingChange(!selecting)}>
            <CheckSquare className="mr-2 h-4 w-4" />
            {selecting ? "Terminar selección" : "Seleccionar"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSync}>
            {isSyncing ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Building2 className="mr-2 h-4 w-4" />
            )}
            {isSyncing ? "Sincronizando..." : "Sync Banco"}
          </DropdownMenuItem>
          {futureCount > 0 && (
            <DropdownMenuItem onClick={onToggleFuture}>
              <CalendarClock className="mr-2 h-4 w-4" />
              {showFuture ? "Ocultar" : "Ver"} {futureCount} cuota{futureCount > 1 ? "s" : ""} futura{futureCount > 1 ? "s" : ""}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Rows3 className="mr-2 h-4 w-4" />
              {pageSize} por página
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={String(pageSize)}
                onValueChange={(value) => onPageSizeChange(Number(value))}
              >
                {PAGE_SIZES.map((size) => (
                  <DropdownMenuRadioItem key={size} value={String(size)}>
                    {size} filas
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
