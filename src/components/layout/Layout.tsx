import { ReactNode, useEffect } from "react";
import { PeriodSettingsDialog } from "@/components/settings/PeriodSettingsDialog";
import { ReconciliationDrawer } from "../settings/ReconciliationDrawer";
import { WhisperInput } from "../transactions/WhisperInput";
import { OnboardingModal } from "../settings/OnboardingModal";
import { AppearanceSheet } from "../settings/AppearanceSheet";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "../ui/button";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSoundFX } from "@/hooks/useSoundFX";
import { initSounds } from "@/lib/snd";
import { MobileBottomBar } from "./MobileBottomBar";
import { UndoRedoControls } from "./UndoRedoControls";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LayoutProps {
  children: ReactNode;
  fit?: boolean;
}

export default function Layout({ children, fit = false }: LayoutProps) {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const { playToggleOn, playToggleOff } = useSoundFX();
  const {
    quickAddOpen,
    setQuickAddOpen,
    quickAddDefaultType,
    quickAddDraft,
    quickAddRevision,
    reconciliationOpen,
    setReconciliationOpen,
    profileEditOpen,
    setProfileEditOpen,
  } = useGlobalDrawers();

  const isMobile = useIsMobile();
  useEffect(() => {
    initSounds().catch(() => {});
  }, []);

  useKeyboardShortcuts();

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
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <WhisperInput
          key={quickAddRevision}
          open={quickAddOpen}
          initialDraft={quickAddDraft}
          onOpenChange={(open) => {
            if (open) playToggleOn(); else playToggleOff();
            setQuickAddOpen(open);
          }}
          defaultType={quickAddDefaultType}
        />

        <ReconciliationDrawer
          open={reconciliationOpen}
          onOpenChange={(open) => {
            if (open) playToggleOn(); else playToggleOff();
            setReconciliationOpen(open);
          }}
        />

        <PeriodSettingsDialog />

        <OnboardingModal
          open={profileEditOpen}
          onOpenChange={setProfileEditOpen}
          mode="edit"
        />

        <AppearanceSheet />

        <AppSidebar />

        <SidebarInset className={cn(fit && "h-svh")}>
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b backdrop-blur px-4">
            {!isMobile && <SidebarTrigger className="-ml-1" />}
            {isMobile && (
              <span className="text-xl font-medium">
                rindo<span className="text-primary">.</span>
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <UndoRedoControls />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={togglePrivacyMode}
                    variant="ghost"
                    size="sm"
                    aria-label={isPrivacyMode ? "Desactivar modo privado" : "Activar modo privado"}
                    className={cn(
                      "rounded-full size-9 p-0 transition-all duration-200",
                      isPrivacyMode
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
            </div>
          </header>

          <main
            className={cn(
              "flex flex-1 flex-col gap-4 p-4 sm:p-6 overflow-x-clip max-w-full",
              isMobile && "pb-28 pb-safe",
              fit && "min-h-0 overflow-y-auto"
            )}
            data-scrollable
          >
            {children}
          </main>
        </SidebarInset>

        <MobileBottomBar />
      </SidebarProvider>
    </TooltipProvider>
  );
}
