import { useState, useEffect } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { Button } from "./ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DashboardGridProps {
  children: React.ReactElement[];
}

// Layout por defecto (12 columnas)
const DEFAULT_LAYOUT: Layout[] = [
  // Balance cards (5 widgets en fila)
  { i: "income", x: 0, y: 0, w: 2.4, h: 2, minW: 2, minH: 2 },
  { i: "expenses", x: 2.4, y: 0, w: 2.4, h: 2, minW: 2, minH: 2 },
  { i: "investments", x: 4.8, y: 0, w: 2.4, h: 2, minW: 2, minH: 2 },
  { i: "patrimony", x: 7.2, y: 0, w: 2.4, h: 2, minW: 2, minH: 2 },
  { i: "available", x: 9.6, y: 0, w: 2.4, h: 2, minW: 2, minH: 2 },
  // Charts
  { i: "projection", x: 0, y: 2, w: 4, h: 4, minW: 3, minH: 3 },
  { i: "flow", x: 4, y: 2, w: 8, h: 4, minW: 6, minH: 4 },
  { i: "evolution", x: 0, y: 6, w: 12, h: 3, minW: 6, minH: 3 },
  { i: "expensesChart", x: 0, y: 9, w: 12, h: 4, minW: 6, minH: 4 },
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
        cols={12}
        rowHeight={80}
        width={1200}
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
          className="gap-2 text-muted-foreground hover:text-white transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Restaurar diseño original</span>
        </Button>
      </div>
    </div>
  );
}

