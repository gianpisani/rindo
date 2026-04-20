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
  TrendingDown,
  PiggyBank,
  ArrowRight,
  TrendingUp,
  UserPen,
  ArrowLeftRight,
} from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { useSoundFX } from "@/hooks/useSoundFX";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Kbd } from "@/components/ui/kbd";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { getCategoryIcon } from "@/components/TransactionsTable";
import { cn } from "@/lib/utils";

interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTransaction?: () => void;
  onConciliate?: () => void;
  onEditProfile?: () => void;
}

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
  Reembolso: ArrowLeftRight,
};

const typeAmountColors: Record<string, string> = {
  Ingreso: "text-emerald-500",
  Gasto: "text-red-400",
  Inversión: "text-blue-400",
  Reembolso: "text-amber-400",
};

export function CommandBar({ open, onOpenChange, onAddTransaction, onConciliate, onEditProfile }: CommandBarProps) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { playSelect } = useSoundFX();
  const { getVisibleRoutes } = useNavPreferences();
  const navRoutes = getVisibleRoutes();

  const searchResults = useFuzzySearch(transactions, search);
  const showTransactions = search.length >= 2;

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const runCommand = (command: () => void) => {
    playSelect();
    onOpenChange(false);
    command();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(amount);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar transacciones, navegar, acciones..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="text-2xl">🔍</span>
            <span className="text-sm text-muted-foreground">
              {showTransactions
                ? "Sin resultados para esa búsqueda"
                : "Escribe para buscar transacciones..."}
            </span>
          </div>
        </CommandEmpty>

        {/* ── Transaction results ─────────────────────────────────── */}
        {showTransactions && searchResults.length > 0 && (
          <>
            <CommandGroup heading={`${searchResults.length} transacción${searchResults.length !== 1 ? "es" : ""}`}>
              {searchResults.slice(0, 8).map((t) => {
                const catData = categories.find(c => c.name === t.category_name);
                const emoji = catData?.icon || getCategoryIcon(t.category_name);
                const dotColor = catData?.color || null;
                const amountColor = typeAmountColors[t.type] || "text-foreground";

                return (
                  <CommandItem
                    key={t.id}
                    value={`${t.detail || ""} ${t.category_name} ${t.id}`}
                    onSelect={() =>
                      runCommand(() => navigate(`/transactions?search=${encodeURIComponent(search)}&highlight=${t.id}`))
                    }
                    className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-lg"
                  >
                    {/* Date column */}
                    <span className="text-[11px] text-muted-foreground/60 tabular-nums font-mono w-[52px] shrink-0">
                      {format(new Date(t.date), "dd MMM", { locale: es })}
                    </span>

                    {/* Detail */}
                    <span className="text-sm truncate flex-1 min-w-0 font-medium">
                      {t.detail || <span className="text-muted-foreground/50 italic font-normal">Sin detalle</span>}
                    </span>

                    {/* Category pill */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs leading-none">{emoji}</span>
                      {dotColor && (
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                      )}
                      <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                        {t.category_name}
                      </span>
                    </div>

                    {/* Amount */}
                    <span className={cn("text-sm font-semibold tabular-nums font-mono shrink-0", amountColor)}>
                      {t.type === "Ingreso" ? "+" : t.type === "Gasto" ? "−" : ""}
                      {formatCurrency(t.amount)}
                    </span>
                  </CommandItem>
                );
              })}

              {searchResults.length > 8 && (
                <CommandItem
                  value={`ver todas transacciones ${search}`}
                  onSelect={() =>
                    runCommand(() => navigate(`/transactions?search=${encodeURIComponent(search)}`))
                  }
                  className="justify-center text-sm text-primary font-medium cursor-pointer py-2.5"
                >
                  Ver las {searchResults.length} transacciones
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* ── Actions ─────────────────────────────────────────────── */}
        <CommandGroup heading="Acciones">
          <CommandItem onSelect={() => runCommand(() => onAddTransaction?.())} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
            <div className="flex items-center justify-between flex-1">
              <span>Agregar Gasto</span>
              <Kbd>N</Kbd>
            </div>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => onConciliate?.())} className="cursor-pointer">
            <Calculator className="mr-2 h-4 w-4 text-muted-foreground" />
            <div className="flex items-center justify-between flex-1">
              <span>Conciliar Balance</span>
              <Kbd>R</Kbd>
            </div>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => onEditProfile?.())} className="cursor-pointer">
            <UserPen className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Editar perfil</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── Navigation ──────────────────────────────────────────── */}
        <CommandGroup heading="Navegación">
          {navRoutes.map((route, index) => {
            const Icon = route.icon;
            const shortcut = index < 9 ? String(index + 1) : undefined;
            return (
              <CommandItem key={route.url} onSelect={() => runCommand(() => navigate(route.url))} className="cursor-pointer">
                {route.customIcon ? (
                  <img src={Icon as string} alt={route.title} className="mr-2 h-4 w-4 opacity-60" />
                ) : (
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex items-center justify-between flex-1">
                  <span>{route.title}</span>
                  {shortcut && <Kbd>{shortcut}</Kbd>}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
