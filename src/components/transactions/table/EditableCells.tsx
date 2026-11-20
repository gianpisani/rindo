import { useEffect, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import type { Column } from "@tanstack/react-table";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Transaction } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";
import { CELL_TRIGGER } from "./cell-trigger";

export function EditableTextCell({ value, onSave, className, placeholder }: {
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

  const handleKeyDown = (e: KeyboardEvent) => {
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

export function EditableAmountCell({
  value,
  onSave,
  className,
  allowNegative = false,
}: {
  value: number;
  onSave: (value: number) => void;
  className?: string;
  allowNegative?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

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

  const handleKeyDown = (e: KeyboardEvent) => {
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
      <span>{clp(value)}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </div>
  );
}

interface SelectableCellProps<T extends string> {
  value: T;
  options: { value: T; label: string; icon?: ComponentType<{ className?: string }> }[];
  onSave: (value: T) => void;
  renderValue?: (value: T) => ReactNode;
  className?: string;
}

export function SelectableCell<T extends string>({ value, options, onSave, renderValue, className }: SelectableCellProps<T>) {
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
