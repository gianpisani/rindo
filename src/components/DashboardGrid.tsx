import { useState, useEffect } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { Button } from "./ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DashboardGridProps {
  children: React.ReactElement[];
}

// Layout por defecto (15 columnas)
// IMPORTANTE: El orden DEBE coincidir EXACTAMENTE con el orden de los widgets en Dashboard.tsx
// Las coordenadas (x,y,w,h) definen DÓNDE va el widget, la posición en el array define QUÉ widget es
const DEFAULT_LAYOUT: Layout[] = [
  // Posición 0: income -> abajo izquierda
  { i: "income", x: 0, y: 10, w: 3, h: 2, minW: 2, minH: 2 },
  // Posición 1: expenses -> abajo
  { i: "expenses", x: 3, y: 10, w: 3, h: 2, minW: 2, minH: 2 },
  // Posición 2: investments -> abajo
  { i: "investments", x: 6, y: 10, w: 3, h: 2, minW: 2, minH: 2 },
  // Posición 3: patrimony -> abajo
  { i: "patrimony", x: 9, y: 10, w: 3, h: 2, minW: 2, minH: 2 },
  // Posición 4: available -> abajo derecha
  { i: "available", x: 12, y: 10, w: 3, h: 2, minW: 2, minH: 2 },
  // Posición 5: insights -> arriba derecha (x:11, y:0)
  { i: "insights", x: 11, y: 0, w: 4, h: 6 },
  // Posición 6: projection -> arriba izquierda (x:0, y:0)
  { i: "projection", x: 0, y: 0, w: 5, h: 10, minW: 3, minH: 3 },
  // Posición 7: flow -> abajo completo ancho (x:0, y:12)
  { i: "flow", x: 0, y: 12, w: 15, h: 6, minW: 6, minH: 4 },
  // Posición 8: evolution -> centro medio (x:5, y:6)
  { i: "evolution", x: 5, y: 6, w: 10, h: 4, minW: 6, minH: 3 },
  // Posición 9: expensesChart -> centro superior (x:5, y:0)
  { i: "expensesChart", x: 5, y: 0, w: 6, h: 6, minW: 6, minH: 4 },
];

const STORAGE_KEY = "finanzas-dashboard-layout";

export function DashboardGrid({ children }: DashboardGridProps) {
  const [layout, setLayout] = useState<Layout[]>(DEFAULT_LAYOUT);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Cargar layout desde localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem(STORAGE_KEY);
    if (savedLayout) {
      try {
        setLayout(JSON.parse(savedLayout));
      } catch (e) {
        console.error("Error loading layout:", e);
      }
    }
    setMounted(true);
  }, []);

  // Guardar layout cuando cambia
  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayout(newLayout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
  };

  // Reset al layout por defecto
  const handleReset = () => {
    setLayout(DEFAULT_LAYOUT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LAYOUT));
    toast({
      title: "Dashboard restaurado",
      description: "El diseño se ha restaurado a su configuración original",
    });
  };

  // No renderizar hasta que esté montado (evita SSR issues)
  if (!mounted) {
    return (
      <div className="space-y-6">
        {children}
      </div>
    );
  }

  // En mobile, layout fijo (columna única)
  if (isMobile) {
    return (
      <div className="space-y-6">
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid Layout */}
      <GridLayout
        className="layout"
        layout={layout}
        cols={15}
        rowHeight={80}
        width={1350}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        isDraggable={true}
        isResizable={true}
        compactType="vertical"
        preventCollision={false}
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {children.map((child, index) => {
          const key = layout[index]?.i || `widget-${index}`;
          return (
            <div key={key} className="dashboard-widget">
              {child}
            </div>
          );
        })}
      </GridLayout>

      {/* Botón Reset - Al final, centrado y elegante */}
      <div className="flex justify-center pt-4 border-t border-border/30">
        <Button
          onClick={handleReset}
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Restaurar diseño original</span>
        </Button>
      </div>
    </div>
  );
}

