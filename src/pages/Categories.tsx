import React, { useState } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { CategoryComposer, type CategoryValues } from "@/components/CategoryComposer";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight, ArrowDownToLine, LineChart } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";
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
  const { categories, hasCategoryContext, addCategory, updateCategory, deleteCategory } = useCategories();

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

  // Sin contexto de categorías en el perfil, descripción y "en uso" no se mandan.
  const handleSave = async (values: CategoryValues) => {
    const { description, is_active, ...base } = values;
    const payload = hasCategoryContext ? { ...base, description, is_active } : base;
    if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, ...payload });
    } else {
      await addCategory.mutateAsync(payload);
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

  const confirmDeleteAction = async () => {
    if (confirmDelete.id) await deleteCategory.mutateAsync(confirmDelete.id);
  };

  // Crear vive al final de cada grupo, discreto: abre con el tipo del grupo, que se puede cambiar.
  const newChip = (type?: TransactionType) => (
    <button
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      onClick={() => handleNew(type)}
    >
      <Plus className="h-3.5 w-3.5" />
      Nueva
    </button>
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

              <div className="flex flex-wrap gap-2">
                {cats.map((cat) => (
                  <div
                    key={cat.id}
                    className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-sm font-medium"
                  >
                    <span className="text-sm leading-none">{cat.icon || "🏷️"}</span>
                    <span>{cat.name}</span>
                    {cat.is_active === false && <span className="text-xs text-muted-foreground">Archivada</span>}
                    {/* Hover actions */}
                    <div className="absolute inset-0 rounded-full flex items-center justify-end pr-1.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <button
                        className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                        aria-label={`Editar ${cat.name}`}
                        onClick={() => handleEdit(cat)}
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-destructive/10 transition-colors"
                        onClick={() => handleDelete(cat.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
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
        withContext={hasCategoryContext}
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
