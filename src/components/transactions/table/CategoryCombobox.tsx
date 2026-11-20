import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
  trigger: ReactNode;
  placeholder?: string;
}

export function CategoryCombobox({ value, options, onSave, trigger, placeholder = "Buscar categoría..." }: CategoryComboboxProps) {
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
