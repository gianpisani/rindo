import { KeyboardEvent, ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { AlertTriangle } from "lucide-react";
import { useSoundFX } from "@/hooks/useSoundFX";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  children,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "destructive",
}: ConfirmDialogProps) {
  const { playCaution } = useSoundFX();

  const handleConfirm = () => {
    playCaution();
    onConfirm();
    onOpenChange(false);
  };

  // Keyboard-first: Enter siempre ejecuta la acción primaria, sin importar
  // qué botón tenga el foco (Radix enfoca "Cancelar" por defecto)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] w-[92vw] p-0 gap-0" onKeyDown={handleKeyDown}>
        <DialogHeader className="px-6 pt-6 pb-4 gap-3">
          {variant === "destructive" && (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          )}
          <DialogTitle className="text-xl text-center font-bold">{title}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children && (
          <div className="px-6 pb-4">
            {children}
          </div>
        )}
        <DialogFooter className="flex-row gap-2 sm:gap-2 px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


