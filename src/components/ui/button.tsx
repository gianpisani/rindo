import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Las variantes con cuerpo se apoyan sobre la sombra dura de Wero
        // y se hunden al apretarlas (.press). Ghost y link se quedan
        // planos: no son objetos, son texto que responde.
        default: "border border-border bg-primary text-primary-foreground hover:bg-primary/90 shadow-hard press",
        destructive: "border border-border bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-hard press",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-hard press",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-hard press",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
        /**
         * La acción que cierra un diálogo. Vive en el `footer` de BaseModal —
         * ahí es donde el ancla y el separador le dan su peso; suelta en el
         * cuerpo scrolleable se lee como un campo más del formulario.
         * Para un par (Cancelar / Confirmar), `size="cta" className="flex-1"`:
         * el flex-basis gana sobre el w-full y quedan dos mitades.
         */
        cta: "h-12 w-full px-4 text-base font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
