import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, BarChart3, Receipt, FolderOpen, LogOut, Webhook, Layers } from "lucide-react";
import { Button } from "./ui/button";
import { CommandBar } from "./CommandBar";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { QuickAddDrawer } from "./QuickAddDrawer";
import { FloatingActionButton } from "./FloatingActionButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión exitosamente",
    });
  };

  const navItems = [
    { path: "/", label: "Inicio", icon: Home },
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/transactions", label: "Transacciones", icon: Receipt },
    { path: "/categories", label: "Categorías", icon: FolderOpen },
    { path: "/bulk-recategorize", label: "Recategorizar", icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Keyboard Shortcuts - Global */}
      <KeyboardShortcuts onAddTransaction={() => setDrawerOpen(true)} />

      {/* Command Bar - Global */}
      <CommandBar 
        onAddTransaction={() => setDrawerOpen(true)}
        onConciliate={() => {
          navigate("/");
          setTimeout(() => {
            document.getElementById("reconciliation-card")?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }}
      />

      {/* Floating Action Button - Mobile only */}
      <FloatingActionButton onClick={() => setDrawerOpen(true)} />

      {/* Quick Add Drawer - Global */}
      <QuickAddDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Desktop Navigation - Top Bar */}
      <nav className="hidden md:block border-b border-border bg-card shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2.5">
                <Webhook className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  Finanzas
                </span>
              </Link>
              <div className="flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link 
                      key={item.path} 
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md transition-colors duration-150",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <kbd className="hidden lg:inline-flex h-7 select-none items-center gap-1 rounded bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
              <Button 
                onClick={handleLogout} 
                variant="ghost" 
                size="sm" 
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline">Salir</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Top Bar - Minimal */}
      <div className="md:hidden sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="flex h-14 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative">
              <Webhook className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <span className="text-xl font-light tracking-tight text-foreground">
              Flux
            </span>
          </Link>
          <Button 
            onClick={handleLogout} 
            variant="ghost" 
            size="sm" 
            className="rounded-full h-9 w-9 p-0"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
        <div className="relative bg-card rounded-full shadow-lg border border-border p-2 shadow-lg">
          <div className="relative z-10 flex items-center justify-around">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-1 h-14 rounded-full transition-colors duration-200",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}