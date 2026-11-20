import { useState } from "react";
import Layout from "@/components/layout/Layout";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { CategoryComposer, type CategoryValues } from "@/components/categories/CategoryComposer";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight, ArrowDownToLine, LineChart } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";
import { tintColor } from "@/lib/category-color";
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/ledger";

const typeConfig: Record<
  TransactionType,
  { icon: typeof TrendingUp; label: string; color: string }
> = {
  Ingreso: { icon: TrendingUp, label: "Ingresos", color: "text-success" },
  Gasto: { icon: TrendingDown, label: "Gastos", color: "text-foreground" },
  Inversión: { icon: PiggyBank, label: "Inversiones", color: "text-info" },
  Rescate: { icon: ArrowDownToLine, label: "Rescates", color: "text-cyan-500" },
  Rendimiento: { icon: LineChart, label: "Rendimientos", color: "text-violet-500" },
  Reembolso: { icon: ArrowLeftRight, label: "Reembolsos", color: "text-success" },
};

interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color?: string | null;
  icon?: string | null;
  description?: string;
  is_active?: boolean;
}

export default function Categories() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newType, setNewType] = useState<TransactionType | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  const grouped = TRANSACTION_TYPES.reduce(
    (acc, type) => {
      acc[type] = categories.filter((c) => c.type === type);
      return acc;
    },
    {} as Record<TransactionType, Category[]>
  );

  const handleSave = async (values: CategoryValues) => {
    if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, ...values });
    } else {
      await addCategory.mutateAsync(values);
    }
    setEditingCategory(null);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleNew = (type?: TransactionType) => {
    setNewType(type);
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => setConfirmDelete({ open: true, id });

  const confirmDeleteAction = () => {
    if (confirmDelete.id) deleteCategory.mutate(confirmDelete.id);
  };

  // Crear vive al final de cada grupo, discreto: abre con el tipo del grupo, que se puede cambiar.
  const newChip = (type?: TransactionType) => (
    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleNew(type)}>
      <Plus />
      Nueva
    </Button>
  );

  return (
    <Layout>
      <div className="space-y-8">
        <h1 className="text-xl font-medium">Categorías</h1>

        {categories.length === 0 && newChip()}

        {/* Solo los tipos con categorías; "Nueva" deja elegir cualquier tipo */}
        {(Object.entries(grouped) as [keyof typeof typeConfig, Category[]][]).filter(([, cats]) => cats.length > 0).map(([type, cats]) => {
          const { icon: Icon, label, color } = typeConfig[type];
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={cn("h-4 w-4", color)} />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">({cats.length})</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {cats.map((cat) => (
                  <div
                    key={cat.id}
                    className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium"
                    style={{ background: tintColor(cat.color, 14), borderColor: tintColor(cat.color, 24) }}
                  >
                    <span className="text-sm leading-none">{cat.icon || "🏷️"}</span>
                    <span>{cat.name}</span>
                    {cat.is_active === false && <span className="text-xs text-muted-foreground">Archivada</span>}
                    {/* Hover actions */}
                    <div className="absolute inset-0 rounded-full flex items-center justify-end pr-1.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 text-muted-foreground"
                        aria-label={`Editar ${cat.name}`}
                        onClick={() => handleEdit(cat)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Eliminar ${cat.name}`}
                        onClick={() => handleDelete(cat.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
                {newChip(type)}
              </div>
            </div>
          );
        })}
      </div>

      <CategoryComposer
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
        initialType={newType}
        withContext
        pending={addCategory.isPending || updateCategory.isPending}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null })}
        onConfirm={confirmDeleteAction}
        title="¿Eliminar categoría?"
        description="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </Layout>
  );
}
