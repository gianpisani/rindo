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
  Settings,
  Plus,
  Calculator,
  Search,
  DollarSign,
  BarChart3,
} from "lucide-react";

interface CommandBarProps {
  onAddTransaction?: () => void;
  onConciliate?: () => void;
}

export function CommandBar({ onAddTransaction, onConciliate }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="¿Qué quieres hacer?" />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
        
        <CommandGroup heading="Acciones">
          <CommandItem onSelect={() => runCommand(() => onAddTransaction?.())}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Agregar Transacción</span>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => onConciliate?.())}>
            <Calculator className="mr-2 h-4 w-4" />
            <span>Conciliar Balance</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navegación">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate("/transactions"))}>
            <DollarSign className="mr-2 h-4 w-4" />
            <span>Transacciones</span>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate("/categories"))}>
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Categorías</span>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate("/recategorize"))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Recategorizar</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Buscar">
          <CommandItem onSelect={() => runCommand(() => navigate("/transactions"))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Buscar Transacciones</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

