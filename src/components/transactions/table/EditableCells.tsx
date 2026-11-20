import type { ReactNode } from "react";
import type { Column, Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Transaction } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";
import { isDefaultSort, nextSort } from "@/lib/table-sort";

interface SelectableCellProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onSave: (value: T) => void;
  label: string;
  children: ReactNode;
}

export function SelectableCell<T extends string>({ value, options, onSave, label, children }: SelectableCellProps<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inicio-editable inicio-pick" aria-label={label}>
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => { if (option.value !== value) onSave(option.value); }}
            className="flex items-center gap-2"
          >
            {option.label}
            {option.value === value && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SortHeader({ column, table, label, alignEnd }: {
  column: Column<Transaction>;
  table: Table<Transaction>;
  label: string;
  alignEnd?: boolean;
}) {
  const sorting = table.getState().sorting;
  const active = !isDefaultSort(sorting) && sorting[0].id === column.id;
  const Arrow = active && !sorting[0].desc ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => table.setSorting(nextSort(sorting, column.id))}
      className={cn(
        "group -mx-2 inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        alignEnd && "flex-row-reverse"
      )}
    >
      {label}
      <Arrow className={cn("size-3 transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60")} />
    </button>
  );
}
