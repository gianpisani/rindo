import { type RefObject } from "react";
import {
  Building2,
  CalendarClock,
  Download,
  MoreHorizontal,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/ledger";
import { cn } from "@/lib/utils";

/**
 * La barra de Transacciones: una línea, y una sola siempre.
 *
 * La versión anterior ponía nueve controles en fila, cuatro de ellos selects
 * que decían "Todas las X": el 60% del ancho para informar que no estaban
 * filtrando nada. Una fila de N controles siempre visibles es una promesa que
 * no se puede cumplir —el quinto filtro la parte en dos— así que acá la barra
 * muestra **estado**, no controles:
 *
 *   [buscador ───] [chips de lo activo] [Fecha] [Filtros ·2] │ [acciones]
 *
 * El único elemento elástico es el buscador (con piso). Los chips tienen
 * techo: del tercero en adelante colapsan en uno que dice cuántos hay, misma
 * regla que los avisos del inicio. Así la cantidad de casilleros de la línea
 * es fija pase lo que pase.
 *
 * `Fecha` queda suelto a propósito: su panel es un popover con presets y
 * calendario, y meterlo dentro del de Filtros sería anidar overlays.
 */

/** Chips visibles antes de colapsar al contador. Igual que HomeNotices. */
const MAX_CHIPS = 2;

export const ALL = "all";

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
  onImport: () => void;
  onExport: () => void;
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
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
  onImport,
  onExport,
}: TransactionsToolbarProps) {
  // Los tres filtros que viven dentro del botón. La fecha no entra: se
  // muestra suelta y trae su propio botón de limpiar.
  const active: ActiveFilter[] = [];
  if (typeFilter !== ALL) {
    active.push({
      key: "type",
      label: typeFilter,
      clear: () => onTypeFilterChange(ALL),
    });
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
    onTypeFilterChange(ALL);
    onCardFilterChange(ALL);
    onCategoryFilterChange(ALL);
  };

  const chips: ActiveFilter[] =
    active.length > MAX_CHIPS
      ? [
          {
            key: "all",
            label: `${active.length} filtros`,
            clear: clearAll,
          },
        ]
      : active;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      {/* Buscar — el único elástico, con piso */}
      <div className="relative min-w-[150px] flex-1">
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
              className="flex h-7 max-w-[150px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.07] pl-2.5 pr-2"
            >
              {chip.emoji && (
                <span className="shrink-0 text-[11px] leading-none">{chip.emoji}</span>
              )}
              <span className="truncate text-[11px] font-medium">{chip.label}</span>
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

      {/* Fecha — suelto: su panel ya es un popover con presets y calendario */}
      <DateRangeFilter
        value={dateRange}
        onChange={onDateRangeChange}
        className="h-10 w-auto shrink-0 sm:w-[190px]"
      />

      {/* Filtros — tipo, tarjeta y categoría */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 shrink-0 gap-2",
              active.length > 0 && "border-primary/40 text-primary"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {active.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold tabular-nums text-primary-foreground">
                {active.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px] space-y-3.5 p-3">
          <FilterSection title="Tipo">
            <div className="flex flex-wrap gap-1.5">
              <OptionChip
                active={typeFilter === ALL}
                onClick={() => onTypeFilterChange(ALL)}
              >
                Todos
              </OptionChip>
              {TRANSACTION_TYPES.map((type: TransactionType) => (
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
                      categoryFilter === ALL && "font-semibold text-primary"
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
                          "font-semibold text-primary"
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

      <div className="mx-0.5 hidden h-6 w-px shrink-0 bg-border/60 sm:block" />

      {/* Acciones */}
      <Button
        variant="outline"
        size="sm"
        className="h-10 shrink-0 gap-2"
        onClick={onSync}
      >
        {isSyncing ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Building2 className="h-4 w-4" />
        )}
        <span className="hidden xl:inline">
          {isSyncing ? "Sincronizando..." : "Sync Banco"}
        </span>
      </Button>

      {futureCount > 0 && (
        <Button
          variant={showFuture ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleFuture}
          className="h-10 shrink-0 gap-2"
          title={`${futureCount} cuota${futureCount > 1 ? "s" : ""} futura${futureCount > 1 ? "s" : ""}`}
        >
          <CalendarClock className="h-4 w-4" />
          <span className="font-mono text-xs tabular-nums">{futureCount}</span>
          <span className="hidden xl:inline text-xs">
            cuota{futureCount > 1 ? "s" : ""} futura{futureCount > 1 ? "s" : ""}
          </span>
        </Button>
      )}

      {/* Lo que se toca una vez al mes */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onImport}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default TransactionsToolbar;
