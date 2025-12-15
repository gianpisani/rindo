import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";

const funFacts = [
  "Guardando $1.000 al día juntas más de $365.000 en un año",
  "El café de la mañana te puede costar $500.000 al año",
  "La regla 50-30-20: la mitad a lo esencial, un poco para gustos, y el resto a ahorrar",
  "Tus suscripciones olvidadas probablemente te cuestan más de $15.000 al mes",
  "Pedir delivery 3 veces a la semana son casi $780.000 al año",
  "Ahorrar aunque sea el 10% de tu sueldo hace toda la diferencia a largo plazo",
  "El interés de la tarjeta puede duplicar tu deuda en menos de 2 años",
  "Un carrete de $30.000 cada finde son más de $1.500.000 al año",
  "El mejor momento para ordenar tus finanzas fue ayer, el segundo mejor es hoy",
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
  const [currentIndex, setCurrentIndex] = useState(() => 
    Math.floor(Math.random() * funFacts.length)
  );
  const [isVisible, setIsVisible] = useState(true);

  const getNextIndex = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % funFacts.length);
  }, []);

  useEffect(() => {
    if (!showFunFact || message) return;

    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);
      
      // Cambiar mensaje y fade in después de 400ms
      setTimeout(() => {
        getNextIndex();
        setIsVisible(true);
      }, 400);
    }, 5000);

    return () => clearInterval(interval);
  }, [showFunFact, message, getNextIndex]);

  const displayMessage = message ?? (showFunFact ? funFacts[currentIndex] : undefined);

  const sizes = {
    sm: "h-8 w-8",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6",
        fullScreen && "min-h-screen bg-background"
      )}
    >
      {/* Logo container con animaciones */}
      <div className="relative">
        {/* Glow effect pulsante */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse",
            sizes[size]
          )} 
        />
        
        {/* Anillo giratorio exterior */}
        <div 
          className={cn(
            "absolute -inset-2 rounded-full border-2 border-transparent border-t-primary/40 animate-spin",
            "[animation-duration:3s]"
          )} 
        />
        
        {/* Logo con efecto de respiración */}
        <img
          src="/icon-512x512-removebg-preview.png"
          alt="Rindo"
          className={cn(
            "relative z-10 animate-breathe drop-shadow-lg",
            sizes[size]
          )}
        />
        
        {/* Puntos orbitando */}
        <div className="absolute inset-0 animate-spin [animation-duration:2s]">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
        </div>
        <div className="absolute inset-0 animate-spin [animation-duration:2.5s] [animation-direction:reverse]">
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary/60" />
        </div>
      </div>

      {/* Mensaje o fun fact con transición */}
      {displayMessage && (
        <p 
          className={cn(
            "text-sm text-muted-foreground text-center max-w-xs px-4 transition-opacity duration-500 ease-in-out",
            isVisible ? "opacity-100" : "opacity-0"
          )}
        >
          {displayMessage}
        </p>
      )}
    </div>
  );
}

// Versión inline más pequeña para usar dentro de componentes
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <img
        src="/icon-512x512-removebg-preview.png"
        alt="Cargando"
        className="h-6 w-6 animate-breathe"
      />
    </div>
  );
}

