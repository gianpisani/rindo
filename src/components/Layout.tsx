import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BarChart3, Receipt, FolderOpen, LogOut, Sparkles, Webhook, Wand2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { toast } = useToast();
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);

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
    { path: "/recategorize", label: "IA Categorías", icon: Wand2 },
  ];

  useEffect(() => {
    const activeIndex = navItems.findIndex((item) => item.path === location.pathname);
    const activeElement = navRefs.current[activeIndex];
    
    if (activeElement) {
      const { offsetLeft, offsetWidth } = activeElement;
      setIndicatorStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Desktop Navigation - Top Bar */}
      <nav className="hidden md:block border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2">
                <div className="relative">
                  <Webhook className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <span className="text-xl font-light tracking-tight text-foreground">
                  Flux
                </span>
              </Link>
              <div className="relative flex items-center gap-1 bg-muted/40 rounded-full p-1">
                {/* Animated indicator */}
                <motion.div
                  className="absolute h-10 bg-primary rounded-full z-0"
                  initial={false}
                  animate={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                  }}
                />
                {navItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link 
                      key={item.path} 
                      to={item.path}
                      ref={(el) => (navRefs.current[index] = el)}
                      className={cn(
                        "relative z-10 flex items-center gap-2 px-4 h-10 rounded-full transition-colors duration-200",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              size="sm" 
              className="gap-2 rounded-full"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Top Bar - Minimal */}
      <div className="md:hidden sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
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
        <div className="relative bg-card rounded-full shadow-floating border border-border/50 p-2">
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