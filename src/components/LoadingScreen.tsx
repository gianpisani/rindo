import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RindoLogo } from "./RindoLogo";

const funMessages = [
  "Consultando al Tío René sobre tu situación financiera...",
  "Preguntándole a tu vieja si te puede prestar...",
  "Analizando cuánto gastaste en café este mes...",
  "Contando las veces que dijiste 'desde el lunes'...",
  "Sincronizando datos con el universo...",
  "Preparando los datos sin juzgar...",
  "Cargando con fe...",
];

const simpleMessages = [
  "Cargando datos...",
  "Preparando todo...",
  "Un momento...",
];

interface LoadingScreenProps {
  fullScreen?: boolean;
  message?: string;
  size?: "sm" | "md" | "lg";
  showFunFact?: boolean;
}

export function LoadingScreen({
  fullScreen = true,
  message,
  size = "md",
  showFunFact = true,
}: LoadingScreenProps) {
  const pool = showFunFact ? funMessages : simpleMessages;
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * pool.length));

  const nextMessage = useCallback(() => {
    setMsgIndex((prev) => (prev + 1) % pool.length);
  }, [pool.length]);

  useEffect(() => {
    if (message) return;
    const id = setInterval(nextMessage, 2800);
    return () => clearInterval(id);
  }, [message, nextMessage]);

  if (message) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-3",
          fullScreen && "min-h-screen bg-background"
        )}
      >
        <RindoLogo size={20} className="text-foreground/40 animate-breathe" />
        <p className="text-sm text-muted-foreground font-mono">{message}</p>
      </div>
    );
  }

  const logoSize = size === "sm" ? 48 : size === "md" ? 72 : 100;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        fullScreen && "min-h-screen bg-background"
      )}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <RindoLogo size={logoSize} animate className="text-foreground" />
      </motion.div>

      {/* Brand */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="mt-4 text-xs font-semibold text-foreground"
      >
        rindo<span className="text-primary">.</span>
      </motion.span>

      {/* Cycling messages */}
      <div className="mt-8 h-6 relative flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 0.4, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="text-xs text-muted-foreground text-center absolute whitespace-nowrap"
          >
            {pool[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <RindoLogo size={24} className="text-foreground/60 animate-breathe" />
    </div>
  );
}
