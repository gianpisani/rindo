import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
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
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "destructive",
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl backdrop-blur-xl bg-card/95 border-border/50 shadow-2xl">
        <DialogHeader className="gap-3">
          {variant === "destructive" && (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          )}
          <DialogTitle className="text-xl text-center">{title}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            className="flex-1 rounded-xl"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


