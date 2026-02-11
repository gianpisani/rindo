import { useState, useEffect, useRef, useCallback } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { Button } from "./ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface DashboardGridProps {
  children: React.ReactElement[];
}

// Bento Grid Layout (15 columnas)
// IMPORTANTE: El orden DEBE coincidir EXACTAMENTE con el orden de los widgets en Dashboard.tsx
// Dashboard.tsx order: income, expenses, investments, patrimony, available, cards, insights, projection, flow, evolution, expensesChart
const DEFAULT_LAYOUT: Layout[] = [
  // Row 0-8: Hero section
  // Projection: dominant left (10w × 9h)
  // Cards + Insights: stacked right sidebar

  // Balance cards: compact info strip (3w × 2h each = 15w total)
  { i: "income",      x: 0,  y: 9,  w: 3, h: 2, minW: 2, minH: 1 },
  { i: "expenses",    x: 3,  y: 9,  w: 3, h: 2, minW: 2, minH: 1 },
  { i: "investments", x: 6,  y: 9,  w: 3, h: 2, minW: 2, minH: 1 },
  { i: "patrimony",   x: 9,  y: 9,  w: 3, h: 2, minW: 2, minH: 1 },
  { i: "available",   x: 12, y: 9,  w: 3, h: 2, minW: 2, minH: 1 },

  // Credit Cards widget: top-right (5w × 4h)
  { i: "cards",       x: 10, y: 0,  w: 5, h: 4, minW: 3, minH: 3 },
  // Category Insights: below cards (5w × 5h)
  { i: "insights",    x: 10, y: 4,  w: 5, h: 5 },
  // Projection: hero card (10w × 9h)
  { i: "projection",  x: 0,  y: 0,  w: 10, h: 9, minW: 4, minH: 4 },

  // Bottom section: charts
  // Money Flow: full width (15w × 5h)
  { i: "flow",        x: 0,  y: 17, w: 15, h: 5, minW: 6, minH: 3 },
  // Evolution: right half (8w × 6h)
  { i: "evolution",   x: 7,  y: 11, w: 8,  h: 6, minW: 5, minH: 3 },
  // Expenses by category: left half (7w × 6h)
  { i: "expensesChart", x: 0, y: 11, w: 7, h: 6, minW: 5, minH: 4 },
];

const STORAGE_KEY = "finanzas-dashboard-layout-v4";

export function DashboardGrid({ children }: DashboardGridProps) {
  const [layout, setLayout] = useState<Layout[]>(DEFAULT_LAYOUT);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Medir el ancho real del contenedor (respeta sidebar)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setContainerWidth(width);
        setIsMobile(width < 768);
      }
    });

    observer.observe(el);
    // Initial measurement
    setContainerWidth(el.clientWidth);
    setIsMobile(el.clientWidth < 768);

    return () => observer.disconnect();
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
    toast.success("Dashboard restaurado");
  };

  // No renderizar hasta que esté montado (evita SSR issues)
  if (!mounted || containerWidth === 0) {
    return (
      <div ref={containerRef} className="space-y-6">
        {children}
      </div>
    );
  }

  // En mobile, layout fijo (columna única)
  if (isMobile) {
    return (
      <div ref={containerRef} className="space-y-6">
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Grid Layout */}
      <GridLayout
        className="layout"
        layout={layout}
        cols={15}
        rowHeight={80}
        width={containerWidth}
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

