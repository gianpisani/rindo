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
  Home,
  TrendingUp,
  FolderKanban,
  Plus,
  Calculator,
  Search,
  DollarSign,
  BarChart3,
  Receipt,
  TrendingDown,
  PiggyBank,
  ArrowRight,
  Users,
  BarChart2,
  ListChecks,
} from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";

interface CommandBarProps {
  onAddTransaction?: () => void;
  onConciliate?: () => void;
}

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
};

const typeColors = {
  Ingreso: "bg-success/10 text-success border-success/50",
  Gasto: "bg-destructive/10 text-destructive border-destructive/50",
  Inversión: "bg-info/10 text-info border-info/50",
};

export function CommandBar({ onAddTransaction, onConciliate }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { transactions } = useTransactions();
  
  // Fuzzy search
  const searchResults = useFuzzySearch(transactions, search);
  const showTransactions = search.length >= 2;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "m" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const runCommand = (command: () => void) => {
    setOpen(false);
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
    <CommandDialog open={open} onOpenChange={setOpen}>
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
            ? "No se encontraron transacciones con ese término" 
            : "Escribe para buscar transacciones..."}
        </CommandEmpty>
        
        {/* Resultados de búsqueda de transacciones */}
        {showTransactions && searchResults.length > 0 && (
          <>
            <CommandGroup heading={`🔍 Transacciones (${searchResults.length} encontradas)`}>
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
                        <span>•</span>
                        <span className="truncate">{transaction.category_name}</span>
                        <span>•</span>
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
        
        {/* Acciones y navegación (siempre visible) */}
        <CommandGroup heading="Acciones">
          <CommandItem onSelect={() => runCommand(() => onAddTransaction?.())}>
            <Plus className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Agregar Transacción</span>
              <div className="flex gap-1">
                <Kbd>⌘</Kbd><Kbd>K</Kbd>
              </div>
            </div>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => onConciliate?.())}>
            <Calculator className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Conciliar Balance</span>
              <div className="flex gap-1">
                <Kbd>⌘</Kbd><Kbd>B</Kbd>
              </div>
            </div>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navegación">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <Home className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Inicio</span>
              <div className="flex gap-1">
                <Kbd>⌘</Kbd><Kbd>1</Kbd>
              </div>
            </div>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate("/dashboard"))}>
            <TrendingUp className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Análisis</span>
              <div className="flex gap-1">
                <Kbd>⌘</Kbd><Kbd>2</Kbd>
              </div>
            </div>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate("/transactions"))}>
            <DollarSign className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Movimientos</span>
              <div className="flex gap-1">
                <Kbd>⌘</Kbd><Kbd>3</Kbd>
              </div>
            </div>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate("/categories"))}>
            <FolderKanban className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Categorías</span>
              <div className="flex gap-1">
                <Kbd>⌘</Kbd><Kbd>4</Kbd>
              </div>
            </div>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate("/pending-debts"))}>
            <Users className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Deudas Pendientes</span>
              <div className="flex gap-1">
                <Kbd>⌘</Kbd><Kbd>5</Kbd>
              </div>
            </div>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate("/category-insights"))}>
            <BarChart2 className="mr-2 h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Insights de Categorías</span>
              <div className="flex gap-1">
                <Kbd>⌘</Kbd><Kbd>6</Kbd>
              </div>
            </div>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate("/recategorize"))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Recategorizar</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate("/bulk-recategorize"))}>
            <ListChecks className="mr-2 h-4 w-4" />
            <span>Recategorizar Masivo</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

