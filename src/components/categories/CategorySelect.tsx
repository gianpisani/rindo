import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

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
}

export function CategorySelect({
  value,
  options,
  onChange,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar categoría...",
  className,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

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
        </Command>
      </PopoverContent>
    </Popover>
  );
}
