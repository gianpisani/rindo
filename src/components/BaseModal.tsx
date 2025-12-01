import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ReactNode } from "react";

interface BaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const maxWidthClasses = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[500px]",
  lg: "sm:max-w-[600px]",
  xl: "sm:max-w-[700px]",
};

export function BaseModal({ 
  open, 
  onOpenChange, 
  title, 
  description, 
  children,
  footer,
  maxWidth = "lg"
}: BaseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`
          ${maxWidthClasses[maxWidth]}
          w-[92vw]
          max-h-[90vh]
          flex flex-col 
          p-0 gap-0
          rounded-2xl
          border-white/10
        `}
      >
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl text-center font-bold">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-center text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6">
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 px-6 pb-6 pt-2">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
