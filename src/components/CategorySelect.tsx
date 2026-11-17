import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface CategorySelectOption {
  value: string;
  label: string;
  emoji?: string;
}

interface CategorySelectProps {
  value: string;
  options: CategorySelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  /** En mobile, en vez de abrir un popover, delega la apertura (p. ej.
   * para mostrar un picker inline dentro del modal, que scrollea con
   * el contenedor del modal y evita overlays anidados). */
  onOpenMobile?: () => void;
  /** Si se entrega, muestra la acción de crear categoría. Recibe el texto
   * escrito en la búsqueda para prellenar el nombre. */
  onCreate?: (name: string) => void;
}

/**
 * Acción de crear categoría, fuera de CommandList para que no la filtre
 * la búsqueda de cmdk y siga visible cuando no hay resultados.
 */
function CreateCategoryAction({
  search,
  onCreate,
  size = "sm",
}: {
  search: string;
  onCreate: (name: string) => void;
  size?: "sm" | "lg";
}) {
  const name = search.trim();
  return (
    <button
      type="button"
      onClick={() => onCreate(name)}
      className={cn(
        "flex w-full items-center gap-2 text-left text-foreground transition-colors",
        // En mobile va bajo el buscador (la lista no tiene scroll propio);
        // en desktop cierra el popover, bajo la lista.
        size === "lg" ? "mt-1 gap-3 rounded-card px-3 py-3 text-sm" : "border-t px-3 py-2 text-sm"
      )}
    >
      <Plus className={cn("shrink-0", size === "lg" ? "h-5 w-5" : "h-4 w-4")} />
      <span className="truncate">
        {name ? <>Crear “{name}”</> : "Crear categoría"}
      </span>
    </button>
  );
}

/**
 * Selector de categoría con búsqueda. En desktop es un combobox
 * (popover); en mobile delega a un picker inline vía onOpenMobile.
 */
export function CategorySelect({
  value,
  options,
  onChange,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar categoría...",
  className,
  onOpenMobile,
  onCreate,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const isMobile = useIsMobile();

  const selected = options.find((o) => o.value === value);

  const triggerContent = (
    <>
      <span className="truncate">
        {selected ? (
          <>
            {selected.emoji && <span className="mr-1.5">{selected.emoji}</span>}
            {selected.label}
          </>
        ) : (
          placeholder
        )}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </>
  );

  const triggerClasses = cn(
    "flex h-10 w-full items-center justify-between rounded-card border border-input bg-background px-3 text-sm",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    !selected && "text-muted-foreground",
    className
  );

  if (isMobile && onOpenMobile) {
    return (
      <button type="button" className={triggerClasses} onClick={onOpenMobile}>
        {triggerContent}
      </button>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
      modal
    >
      <PopoverTrigger asChild>
        <button type="button" role="combobox" aria-expanded={open} className={triggerClasses}>
          {triggerContent}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] rounded-card p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
            className="h-9 text-sm"
          />
          <CommandList className="max-h-[280px] overscroll-contain">
            <CommandEmpty className="p-4 text-center text-sm text-muted-foreground">
              Sin resultados
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 py-2 text-sm"
                >
                  {option.emoji && (
                    <span className="shrink-0 text-sm leading-none">{option.emoji}</span>
                  )}
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-foreground" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {onCreate && (
            <CreateCategoryAction
              search={search}
              onCreate={(name) => {
                setOpen(false);
                setSearch("");
                onCreate(name);
              }}
            />
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface CategoryPickerInlineProps {
  value: string;
  options: CategorySelectOption[];
  onSelect: (value: string) => void;
  onBack: () => void;
  searchPlaceholder?: string;
  /** Si se entrega, muestra la acción de crear categoría. */
  onCreate?: (name: string) => void;
}

/**
 * Picker inline para mobile: se renderiza en el flujo normal del modal
 * (sin portal ni overlay), así la lista scrollea con el contenedor del
 * modal, que sí funciona en iOS. La lista no tiene scroll propio.
 */
export function CategoryPickerInline({
  value,
  options,
  onSelect,
  onBack,
  searchPlaceholder = "Buscar categoría...",
  onCreate,
}: CategoryPickerInlineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  // El nudge de BaseModal corre solo al abrir el modal, cuando el form
  // suele caber sin scroll. Al montar el picker el contenido crece, así
  // que hay que reactivar el contexto de scroll de iOS WebKit en el
  // ancestro scrolleable para que react-remove-scroll permita el touch.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      let el: HTMLElement | null = rootRef.current?.parentElement ?? null;
      while (el) {
        const overflowY = getComputedStyle(el).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") {
          el.scrollTop = 1;
          el.scrollTop = 0;
          break;
        }
        el = el.parentElement;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="pt-1">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="mb-2 gap-2 text-muted-foreground">
        <ArrowLeft />
        Volver
      </Button>
      <Command className="bg-transparent">
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder={searchPlaceholder}
          className="h-11 text-sm"
        />
        {onCreate && (
          <CreateCategoryAction
            search={search}
            size="lg"
            onCreate={(name) => {
              setSearch("");
              onCreate(name);
            }}
          />
        )}
        {/* max-h-full (parent altura auto) = sin tope: la lista crece y
            scrollea el contenedor del modal, no ella misma. Ojo: la
            versión de tailwind-merge del proyecto NO resuelve el
            conflicto max-h-[300px] vs max-h-none, por eso max-h-full. */}
        <CommandList className="max-h-full pt-1">
          <CommandEmpty className="p-4 text-center text-sm text-muted-foreground">
            Sin resultados
          </CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => onSelect(option.value)}
                className="flex cursor-pointer items-center gap-3 rounded-card px-3 py-3 text-sm"
              >
                {option.emoji && (
                  <span className="shrink-0 text-xl leading-none">{option.emoji}</span>
                )}
                <span className="truncate">{option.label}</span>
                {option.value === value && (
                  <Check className="ml-auto h-4 w-4 shrink-0 text-foreground" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
