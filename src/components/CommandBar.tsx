import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Plus,
  Calculator,
  Search,
  Receipt,
  TrendingDown,
  PiggyBank,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { APP_ROUTES } from "@/lib/routes-config";

interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTransaction?: () => void;
  onConciliate?: () => void;
}

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversi\u00f3n: PiggyBank,
};

const typeColors = {
  Ingreso: "bg-success/10 text-success border-success/50",
  Gasto: "bg-destructive/10 text-destructive border-destructive/50",
  Inversi\u00f3n: "bg-info/10 text-info border-info/50",
};

export function CommandBar({ open, onOpenChange, onAddTransaction, onConciliate }: CommandBarProps) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { transactions } = useTransactions();

  // Fuzzy search
  const searchResults = useFuzzySearch(transactions, search);
  const showTransactions = search.length >= 2;

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center border-b px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <CommandInput
          placeholder="Busca transacciones o navega..."
          value={search}
          onValueChange={setSearch}
          className="border-0 focus:ring-0"
        />
      </div>
      <CommandList>
        <CommandEmpty>
          {showTransactions
            ? "No se encontraron transacciones con ese t\u00e9rmino"
            : "Escribe para buscar transacciones..."}
        </CommandEmpty>

        {/* Resultados de b\u00fasqueda de transacciones */}
        {showTransactions && searchResults.length > 0 && (
          <>
            <CommandGroup heading={`\uD83D\uDD0D Transacciones (${searchResults.length} encontradas)`}>
              {searchResults.slice(0, 8).map((transaction) => {
                const TypeIcon = typeIcons[transaction.type];
                return (
                  <CommandItem
                    key={transaction.id}
                    value={transaction.id}
                    onSelect={() =>
                      runCommand(() => navigate(`/transactions?search=${encodeURIComponent(search)}`))
                    }
                    className="flex items-start gap-3 py-3 cursor-pointer"
                  >
                    <Receipt className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {transaction.detail || transaction.category_name}
                        </span>
                        <Badge variant="outline" className={`text-xs shrink-0 ${typeColors[transaction.type]}`}>
                          <TypeIcon className="h-3 w-3 mr-1" />
                          {transaction.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(transaction.date), "dd MMM yyyy", { locale: es })}</span>
                        <span>&bull;</span>
                        <span className="truncate">{transaction.category_name}</span>
                        <span>&bull;</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}

              {searchResults.length > 8 && (
                <CommandItem
                  value="ver-todas"
                  onSelect={() =>
                    runCommand(() => navigate(`/transactions?search=${encodeURIComponent(search)}`))
                  }
                  className="justify-center text-sm text-primary font-medium cursor-pointer"
                >
                  Ver todas las {searchResults.length} transacciones
                  <ArrowRight className="ml-2 h-4 w-4" />
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Acciones y navegaci\u00f3n (siempre visible) */}
        <CommandGroup heading="Acciones">
          <CommandItem onSelect={() => runCommand(() => onAddTransaction?.())}>
            <Plus className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Agregar Gasto</span>
              <Kbd>N</Kbd>
            </div>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => onConciliate?.())}>
            <Calculator className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Conciliar Balance</span>
              <Kbd>R</Kbd>
            </div>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navegaci\u00f3n">
          {APP_ROUTES.map((route) => {
            const Icon = route.icon;
            return (
              <CommandItem key={route.url} onSelect={() => runCommand(() => navigate(route.url))}>
                {route.customIcon ? (
                  <img src={Icon as string} alt={route.title} className="mr-2 h-4 w-4" />
                ) : (
                  <Icon className="mr-2 h-4 w-4" />
                )}
                <div className="flex items-center justify-between flex-1">
                  <span>{route.title}</span>
                  {route.shortcut && (
                    <Kbd>{route.shortcut}</Kbd>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
