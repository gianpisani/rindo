import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  TrendingUp, 
  ArrowLeftRight, 
  Tag, 
  LogOut, 
  Eye, 
  EyeOff, 
  UsersRound,
  LayoutDashboard,
  BarChart3
} from "lucide-react";
import { Button } from "./ui/button";
import { CommandBar } from "./CommandBar";
import { QuickAddDrawer } from "./QuickAddDrawer";
import { ReconciliationDrawer } from "./ReconciliationDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión exitosamente",
    });
  };

  const navItems = [
    { path: "/", label: "Inicio", icon: Home, showInMobile: true },
    { path: "/dashboard", label: "Análisis", icon: TrendingUp, showInMobile: true },
    { path: "/transactions", label: "Movimientos", icon: ArrowLeftRight, showInMobile: true },
    { path: "/categories", label: "Categorías", icon: Tag, showInMobile: true },
    { path: "/category-insights", label: "Insights", icon: BarChart3, showInMobile: false },
    { path: "/pending-debts", label: "Deudas", icon: UsersRound, showInMobile: true },
    { path: "/bulk-recategorize", label: "Recategorizar", icon: LayoutDashboard, showInMobile: false },
  ];

  const routes = navItems.map(item => item.path);

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
    <div className="min-h-screen bg-background">
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
              <div className="hidden lg:block relative">
                <div 
                  data-shortcuts-trigger
                  className={cn(
                    "h-7 select-none items-center gap-1 rounded bg-sidebar-accent px-2 font-mono text-[11px] font-medium text-white border inline-flex cursor-pointer hover:bg-sidebar-accent/80 transition-all",
                    showShortcutsPopover && isFirstTimePopover
                      ? "border-primary animate-pulse" 
                      : "border-sidebar-border"
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
      <div className="md:hidden sticky top-0 z-50 bg-sidebar border-b border-sidebar-border backdrop-blur-xl">
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
      <main className="container mx-auto px-6 py-8 pb-8" data-scrollable>{children}</main>

      {/* Mobile Bottom Navigation - Fijo Siempre */}
      <nav 
        className="md:hidden fixed left-0 right-0 bottom-0 z-[60] bg-sidebar backdrop-blur-xl"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <div className="flex items-center justify-around h-16">
          {navItems.filter(item => item.showInMobile).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 h-full",
                  "transition-all duration-200 active:scale-95",
                  "touch-manipulation select-none"
                )}
                style={{
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <Icon 
                  className={cn(
                    "h-6 w-6 transition-colors duration-200",
                    isActive ? "text-blue" : "text-gray-200"
                  )} 
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span 
                  className={cn(
                    "text-[10px] font-semibold transition-colors duration-200",
                    isActive ? "text-blue" : "text-gray-200"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}