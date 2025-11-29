import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, BarChart3, Receipt, FolderOpen, LogOut, Layers, Eye, EyeOff } from "lucide-react";
import { Button } from "./ui/button";
import { CommandBar } from "./CommandBar";
import { QuickAddDrawer } from "./QuickAddDrawer";
import { ReconciliationDrawer } from "./ReconciliationDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  
  // Prevenir zoom en iOS con double-tap y optimizar scroll
  useEffect(() => {
    let lastTouchEnd = 0;
    const preventZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    
    document.addEventListener('touchend', preventZoom, { passive: false });
    
    // Prevenir elastic scroll en iOS (bounce effect)
    const preventPullToRefresh = (e: TouchEvent) => {
      const element = e.target as HTMLElement;
      const scrollable = element.closest('[data-scrollable]');
      
      if (!scrollable && window.scrollY === 0) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });
    
    return () => {
      document.removeEventListener('touchend', preventZoom);
      document.removeEventListener('touchmove', preventPullToRefresh);
    };
  }, []);

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

  const routes = navItems.map(item => item.path);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Cmd+C para agregar transacción rápida
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && !e.shiftKey && !isInputField) {
        e.preventDefault();
        setDrawerOpen(true);
        return;
      }

      // Cmd + ← / → para navegar entre tabs
      if ((e.metaKey || e.ctrlKey) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const currentIndex = routes.indexOf(location.pathname);
        
        if (e.key === "ArrowLeft" && currentIndex > 0) {
          navigate(routes[currentIndex - 1]);
        } else if (e.key === "ArrowRight" && currentIndex < routes.length - 1) {
          navigate(routes[currentIndex + 1]);
        }
      }

      // Cmd + 1-5 para navegar directo
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (routes[index]) {
          navigate(routes[index]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, location.pathname, routes]);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Command Bar - Global */}
      <CommandBar 
        onAddTransaction={() => setDrawerOpen(true)}
        onConciliate={() => setReconciliationOpen(true)}
      />

      {/* Quick Add Drawer - Global */}
      <QuickAddDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Reconciliation Drawer - Global */}
      <ReconciliationDrawer open={reconciliationOpen} onOpenChange={setReconciliationOpen} />

      {/* Desktop Navigation - Top Bar */}
      <nav className="hidden md:block border-b border-sidebar-border bg-sidebar shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">
                  Rindo<span className="text-blue">.</span>
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
                        "flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-150",
                        isActive
                          ? "bg-blue text-white shadow-lg"
                          : "text-gray-400 hover:text-white hover:bg-sidebar-accent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-semibold text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={togglePrivacyMode}
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full h-8 w-8 p-0 transition-all duration-200",
                  isPrivacyMode 
                    ? "bg-blue/20 text-blue hover:bg-blue/30" 
                    : "bg-muted/10 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={isPrivacyMode ? "Desactivar modo privado" : "Activar modo privado"}
              >
                {isPrivacyMode ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <kbd className="hidden lg:inline-flex h-7 select-none items-center gap-1 rounded bg-sidebar-accent px-2 font-mono text-[11px] font-medium text-white border border-sidebar-border">
                <span className="text-xs">⌘</span>K
              </kbd>
              <Button 
                onClick={handleLogout} 
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-sidebar-accent" 
                size="sm" 
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline">Salir</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Top Bar - Minimal */}
      <div className="md:hidden sticky top-0 z-50 bg-sidebar border-b border-sidebar-border shadow-lg backdrop-blur-xl bg-opacity-95">
        <div className="flex h-14 items-center justify-between px-6" style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}>
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 active:scale-95 transition-transform">
              <span className="text-xl font-bold tracking-tight text-white">
                Rindo<span className="text-blue">.</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2"> 
            <Button
                onClick={togglePrivacyMode}
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full h-9 w-9 p-0 active:scale-90 transition-all duration-200",
                  isPrivacyMode 
                    ? "bg-blue/20 text-blue hover:bg-blue/30" 
                    : "bg-muted/10 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={isPrivacyMode ? "Desactivar modo privado" : "Activar modo privado"}
              >
                {isPrivacyMode ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              size="sm" 
              className="rounded-full h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-sidebar-accent active:scale-90 transition-transform"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8" data-scrollable>{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}>
        <div className="relative bg-sidebar rounded-full shadow-2xl border border-sidebar-border px-2 backdrop-blur-xl bg-opacity-95">
          <div className="relative z-10 flex items-center justify-around">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-1 h-14 rounded-full transition-all duration-200 active:scale-90",
                    isActive
                      ? "text-blue scale-105"
                      : "text-gray-300"
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-all", isActive && "scale-110")} />
                  <span className="text-[9px] font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}