import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CommandBar } from "./CommandBar";
import { QuickAddDrawer } from "./QuickAddDrawer";
import { ReconciliationDrawer } from "./ReconciliationDrawer";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "./ui/button";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { ShortcutsPopover } from "@/components/ShortcutsPopover";

interface LayoutProps {
  children: ReactNode;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const cmdKey = isMac ? "⌘" : "Ctrl";

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const [showShortcutsPopover, setShowShortcutsPopover] = useState(false);
  const [isFirstTimePopover, setIsFirstTimePopover] = useState(false);
  
  // Auto-show shortcuts popover on desktop
  useEffect(() => {
    // Solo en desktop
    if (window.innerWidth < 1024) return;
    
    // Versión del popover - cambiar este número para forzar que se muestre de nuevo
    const POPOVER_VERSION = 'v1.0';
    const storageKey = `shortcuts-popover-shown-${POPOVER_VERSION}`;
    
    // Verificar si ya se mostró en localStorage
    const hasShownBefore = localStorage.getItem(storageKey);
    if (hasShownBefore) return;
    
    // Mostrar después de 2 segundos
    const showTimer = setTimeout(() => {
      setShowShortcutsPopover(true);
      setIsFirstTimePopover(true);
      localStorage.setItem(storageKey, 'true');
      
      // Ocultar después de 4 segundos (desaparece a los 6s en total)
      const hideTimer = setTimeout(() => {
        setShowShortcutsPopover(false);
        setIsFirstTimePopover(false);
      }, 4000);
      
      return () => clearTimeout(hideTimer);
    }, 2000);
    
    return () => clearTimeout(showTimer);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    if (!showShortcutsPopover) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // No cerrar si se hace click dentro del popover o en el botón
      if (target.closest('[data-shortcuts-popover]') || target.closest('[data-shortcuts-trigger]')) {
        return;
      }
      setShowShortcutsPopover(false);
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShortcutsPopover]);
  
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

  const routes = ["/", "/dashboard", "/transactions", "/categories", "/category-insights", "/pending-debts", "/bulk-recategorize"];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Cmd+K para agregar transacción rápida
      if ((e.metaKey || e.ctrlKey) && e.key === "k" && !e.shiftKey && !isInputField) {
        e.preventDefault();
        setDrawerOpen(true);
        return;
      }

      // Cmd+B para conciliar
      if ((e.metaKey || e.ctrlKey) && e.key === "b" && !isInputField) {
        e.preventDefault();
        setReconciliationOpen(true);
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
    <SidebarProvider>
      {/* Command Bar - Global */}
      <CommandBar 
        onAddTransaction={() => setDrawerOpen(true)}
        onConciliate={() => setReconciliationOpen(true)}
      />

      {/* Quick Add Drawer - Global */}
      <QuickAddDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Reconciliation Drawer - Global */}
      <ReconciliationDrawer open={reconciliationOpen} onOpenChange={setReconciliationOpen} />

      {/* Desktop Sidebar */}
      <AppSidebar />

      <SidebarInset>
        {/* Top Bar with Trigger and Actions */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">
                Rindo<span className="text-primary">.</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={togglePrivacyMode}
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full h-8 w-8 p-0 transition-all duration-200",
                  isPrivacyMode 
                    ? "bg-primary/20 text-primary hover:bg-primary/30" 
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
              <div className="hidden lg:block relative">
                <div 
                  data-shortcuts-trigger
                  className={cn(
                    "h-7 select-none items-center gap-1 rounded bg-muted px-2 font-mono text-[11px] font-medium border inline-flex cursor-pointer hover:bg-muted/80 transition-all",
                    showShortcutsPopover && isFirstTimePopover
                      ? "border-primary animate-pulse" 
                      : "border-border"
                  )}
                  onClick={() => {
                    setShowShortcutsPopover(!showShortcutsPopover);
                    setIsFirstTimePopover(false);
                  }}
                >
                  <span className="text-xs">{isMac ? "⌘" : "Ctrl"}</span>M
                </div>
                <div data-shortcuts-popover>
                  <ShortcutsPopover 
                    isVisible={showShortcutsPopover}
                    isFirstTime={isFirstTimePopover}
                    onClose={() => setShowShortcutsPopover(false)}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex flex-1 flex-col gap-4 p-6" data-scrollable>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}