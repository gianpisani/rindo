import Layout from "@/components/Layout";
import { CategoryInsightsView } from "@/components/CategoryInsightsView";

export default function CategoryInsights() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Análisis por Categoría</h1>
            <p className="text-sm text-muted-foreground">
              Explora tus gastos en detalle, establece límites y descubre patrones
            </p>
          </div>
        </div>

        <CategoryInsightsView />
      </div>
    </Layout>
  );
}
