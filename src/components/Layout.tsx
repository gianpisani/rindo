import { ReactNode, useCallback, useEffect, useState } from "react";
import { CommandBar } from "./CommandBar";
import { QuickAddDrawer } from "./QuickAddDrawer";
import { ReconciliationDrawer } from "./ReconciliationDrawer";
import { WhisperInput } from "./WhisperInput";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "./ui/button";
import { Eye, EyeOff, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAtmosphere } from "@/hooks/useAtmosphere";
import { ShortcutsPopover } from "@/components/ShortcutsPopover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const {
    quickAddOpen,
    setQuickAddOpen,
    quickAddDefaultType,
    reconciliationOpen,
    setReconciliationOpen,
    openQuickAdd,
    openReconciliation,
  } = useGlobalDrawers();

  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [showShortcutsPopover, setShowShortcutsPopover] = useState(false);
  const [whisperOpen, setWhisperOpen] = useState(false);

  // Atmospheric UI - subliminal mood system
  useAtmosphere();

  const toggleCommandBar = useCallback(() => {
    setCommandBarOpen((prev) => !prev);
  }, []);

  const toggleShortcutsPopover = useCallback(() => {
    setShowShortcutsPopover((prev) => !prev);
  }, []);

  const toggleWhisper = useCallback(() => {
    setWhisperOpen((prev) => !prev);
  }, []);

  // Register all keyboard shortcuts
  useKeyboardShortcuts({
    onToggleCommandBar: toggleCommandBar,
    onToggleShortcutsPopover: toggleShortcutsPopover,
    onToggleWhisper: toggleWhisper,
  });

  // Close popover when clicking outside
  useEffect(() => {
    if (!showShortcutsPopover) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("[data-shortcuts-popover]") ||
        target.closest("[data-shortcuts-trigger]")
      ) {
        return;
      }
      setShowShortcutsPopover(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShortcutsPopover]);

  // Prevent zoom on iOS with double-tap and optimize scroll
  useEffect(() => {
    let lastTouchEnd = 0;
    const preventZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener("touchend", preventZoom, { passive: false });

    const preventPullToRefresh = (e: TouchEvent) => {
      const element = e.target as HTMLElement;
      const scrollable = element.closest("[data-scrollable]");

      if (!scrollable && window.scrollY === 0) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchmove", preventPullToRefresh, {
      passive: false,
    });

    return () => {
      document.removeEventListener("touchend", preventZoom);
      document.removeEventListener("touchmove", preventPullToRefresh);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider>
        {/* Command Bar - Global (controlled) */}
        <CommandBar
          open={commandBarOpen}
          onOpenChange={setCommandBarOpen}
          onAddTransaction={() => openQuickAdd()}
          onConciliate={() => openReconciliation()}
        />

        {/* Quick Add Drawer - Global */}
        <QuickAddDrawer
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          defaultType={quickAddDefaultType}
        />

        {/* Reconciliation Drawer - Global */}
        <ReconciliationDrawer
          open={reconciliationOpen}
          onOpenChange={setReconciliationOpen}
        />

        {/* Whisper Mode - Ultra-minimal transaction input */}
        <WhisperInput
          open={whisperOpen}
          onOpenChange={setWhisperOpen}
        />

        {/* Desktop Sidebar */}
        <AppSidebar
          onAddTransaction={() => openQuickAdd()}
          onConciliate={() => openReconciliation()}
        />

        <SidebarInset>
          {/* Atmospheric glow - subliminal mood indicator */}
          <div className="atmospheric-glow active" />

          {/* Top Bar with Trigger and Actions */}
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1" />
              </TooltipTrigger>
              <TooltipContent side="right">Toggle sidebar</TooltipContent>
            </Tooltip>
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">
                  Rindo<span className="text-primary">.</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
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
                    >
                      {isPrivacyMode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPrivacyMode
                      ? "Desactivar modo privado (P)"
                      : "Activar modo privado (P)"}
                  </TooltipContent>
                </Tooltip>
                <div className="hidden lg:block relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        data-shortcuts-trigger
                        className="h-7 select-none items-center gap-1 rounded bg-muted px-2 font-mono text-[11px] font-medium border border-border inline-flex cursor-pointer hover:bg-muted/80 transition-all"
                        onClick={toggleShortcutsPopover}
                      >
                        <Keyboard className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Atajos del teclado (?)</TooltipContent>
                  </Tooltip>
                  <div data-shortcuts-popover>
                    <ShortcutsPopover
                      isVisible={showShortcutsPopover}
                      onClose={() => setShowShortcutsPopover(false)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main
            className="flex flex-1 flex-col gap-4 p-6 sm:p-6 overflow-x-hidden"
            data-scrollable
          >
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
