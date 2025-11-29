import { ResponsiveSankey } from "@nivo/sankey";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { startOfMonth, endOfMonth } from "date-fns";

export function MoneyFlowChart() {
  const { transactions } = useTransactions();
  const { categories } = useCategories();

  // Filtrar transacciones del mes actual
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const currentMonthTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= monthStart && date <= monthEnd;
  });

  // Agrupar por tipo y categoría
  const incomeByCategory = currentMonthTransactions
    .filter((t) => t.type === "Ingreso")
    .reduce((acc, t) => {
      const category = t.category_name || "Otros";
      acc[category] = (acc[category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const expensesByCategory = currentMonthTransactions
    .filter((t) => t.type === "Gasto")
    .reduce((acc, t) => {
      const category = t.category_name || "Otros";
      acc[category] = (acc[category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const investmentsByCategory = currentMonthTransactions
    .filter((t) => t.type === "Inversión")
    .reduce((acc, t) => {
      const category = t.category_name || "Otros";
      acc[category] = (acc[category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

  // Calcular totales
  const totalIncome = Object.values(incomeByCategory).reduce((sum, val) => sum + val, 0);
  const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);
  const totalInvestments = Object.values(investmentsByCategory).reduce((sum, val) => sum + val, 0);

  // Si no hay datos, mostrar mensaje
  if (totalIncome === 0 && totalExpenses === 0 && totalInvestments === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">No hay transacciones este mes</p>
          <p className="text-xs mt-1">Agrega ingresos y gastos para ver el flujo</p>
        </div>
      </div>
    );
  }

  // Construir nodos y links para Sankey
  const nodes: { id: string }[] = [];
  const links: { source: string; target: string; value: number }[] = [];

  // Nodos principales
  nodes.push({ id: "Ingresos" });
  if (totalExpenses > 0) nodes.push({ id: "Gastos" });
  if (totalInvestments > 0) nodes.push({ id: "Inversiones" });

  // Nodos y links de ingresos
  Object.entries(incomeByCategory).forEach(([category, amount]) => {
    const nodeId = `Ingreso: ${category}`;
    nodes.push({ id: nodeId });
    links.push({
      source: nodeId,
      target: "Ingresos",
      value: amount,
    });
  });

  // Links de ingresos a gastos/inversiones (proporcional)
  if (totalExpenses > 0) {
    links.push({
      source: "Ingresos",
      target: "Gastos",
      value: totalExpenses,
    });
  }

  if (totalInvestments > 0) {
    links.push({
      source: "Ingresos",
      target: "Inversiones",
      value: totalInvestments,
    });
  }

  // Nodos y links de gastos
  Object.entries(expensesByCategory).forEach(([category, amount]) => {
    const nodeId = `Gasto: ${category}`;
    nodes.push({ id: nodeId });
    links.push({
      source: "Gastos",
      target: nodeId,
      value: amount,
    });
  });

  // Nodos y links de inversiones
  Object.entries(investmentsByCategory).forEach(([category, amount]) => {
    const nodeId = `Inversión: ${category}`;
    nodes.push({ id: nodeId });
    links.push({
      source: "Inversiones",
      target: nodeId,
      value: amount,
    });
  });

  const data = { nodes, links };

  // Detectar si es mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="space-y-2">
      {isMobile && (
        <p className="text-xs text-muted-foreground text-center">
          ← Desliza para ver más →
        </p>
      )}
      <div className="h-[400px] md:h-[400px] overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        <div className={isMobile ? "min-w-[600px] h-full" : "h-full"}>
        <ResponsiveSankey
          data={data}
          margin={isMobile 
            ? { top: 20, right: 120, bottom: 20, left: 120 }
            : { top: 20, right: 160, bottom: 20, left: 160 }
          }
          align="justify"
          colors={{ scheme: "category10" }}
          nodeOpacity={1}
          nodeHoverOthersOpacity={0.35}
          nodeThickness={isMobile ? 12 : 18}
          nodeSpacing={isMobile ? 16 : 24}
          nodeBorderWidth={0}
          nodeBorderColor={{
            from: "color",
            modifiers: [["darker", 0.8]],
          }}
          nodeBorderRadius={3}
          linkOpacity={0.5}
          linkHoverOthersOpacity={0.1}
          linkContract={3}
          enableLinkGradient={true}
          labelPosition="outside"
          labelOrientation={isMobile ? "vertical" : "horizontal"}
          labelPadding={isMobile ? 8 : 16}
          labelTextColor={{
            from: "color",
            modifiers: [["darker", 1]],
          }}
          legends={[]}
          theme={{
            labels: {
              text: {
                fontSize: isMobile ? 10 : 12,
              }
            }
          }}
        />
        </div>
      </div>
    </div>
  );
}

