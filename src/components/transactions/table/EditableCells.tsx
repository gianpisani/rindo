import type { ReactNode } from "react";
import type { Column } from "@tanstack/react-table";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Transaction } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";

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

export function SortHeader({ column, label, alignEnd }: { column: Column<Transaction>; label: string; alignEnd?: boolean }) {
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
