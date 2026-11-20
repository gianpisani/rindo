import type { ReactNode } from "react";
import { Undo2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useAppearanceEditor } from "@/hooks/useAppearanceEditor";
import { revealOriginOf } from "@/lib/theme-transition";
import { cn } from "@/lib/utils";
import { ThemeEditor } from "./appearance/ThemeEditor";

const SUBTITLE = "Se guarda solo mientras eliges.";

function AppearanceBody({ title, className }: { title: ReactNode; className?: string }) {
  const { draft, changed, undo } = useAppearanceEditor();
  return (
    <>
      <div className={cn("flex min-h-9 items-start justify-between gap-3", className)}>
        {title}
        {changed && (
          <Button variant="ghost" size="xs" onClick={(e) => undo(revealOriginOf(e.currentTarget))} className="shrink-0 text-muted-foreground">
            <Undo2 />
            Deshacer
          </Button>
        )}
      </div>
      <ThemeEditor draft={draft} />
    </>
  );
}

export function AppearanceSheet() {
  const isMobile = useIsMobile();
  const { appearanceOpen, setAppearanceOpen } = useGlobalDrawers();

  if (isMobile) {
    return (
      <Drawer open={appearanceOpen} onOpenChange={setAppearanceOpen} shouldScaleBackground={false}>
        <DrawerContent overlayClassName="bg-transparent backdrop-blur-none" className="max-h-[75svh] pb-safe">
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4">
            <AppearanceBody
              title={
                <div>
                  <DrawerTitle className="text-xl font-medium">Apariencia</DrawerTitle>
                  <DrawerDescription className="text-xs text-muted-foreground">{SUBTITLE}</DrawerDescription>
                </div>
              }
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={appearanceOpen} onOpenChange={setAppearanceOpen} modal={false}>
      <SheetContent
        side="right"
        className="flex flex-col gap-4 overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <AppearanceBody
          className="pr-8"
          title={
            <div>
              <SheetTitle>Apariencia</SheetTitle>
              <SheetDescription className="text-xs">{SUBTITLE}</SheetDescription>
            </div>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
