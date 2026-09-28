import React, { useState } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { CategoryComposer, type CategoryValues } from "@/components/CategoryComposer";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight, ArrowDownToLine, LineChart } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/ledger";

const typeConfig: Record<
  TransactionType,
  { icon: typeof TrendingUp; label: string; color: string; bg: string }
> = {
  Ingreso: { icon: TrendingUp, label: "Ingresos", color: "text-success", bg: "bg-success/10" },
  Gasto: { icon: TrendingDown, label: "Gastos", color: "text-destructive", bg: "bg-destructive/10" },
  Inversión: { icon: PiggyBank, label: "Inversiones", color: "text-info", bg: "bg-info/10" },
  Rescate: { icon: ArrowDownToLine, label: "Rescates", color: "text-cyan-500", bg: "bg-cyan-500/10" },
  Rendimiento: { icon: LineChart, label: "Rendimientos", color: "text-violet-500", bg: "bg-violet-500/10" },
  Reembolso: { icon: ArrowLeftRight, label: "Reembolsos", color: "text-amber-500", bg: "bg-amber-500/10" },
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

  const handleDelete = (id: string) => setConfirmDelete({ open: true, id });

  const confirmDeleteAction = async () => {
    if (confirmDelete.id) await deleteCategory.mutateAsync(confirmDelete.id);
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Categorías</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tus categorías de transacciones
            </p>
          </div>
          <Button
            className="rounded-full h-10 w-10 p-0 md:w-auto md:px-5 md:h-10"
            onClick={() => {
              setEditingCategory(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline text-sm">Agregar</span>
          </Button>

          <CategoryComposer
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingCategory(null);
            }}
            category={editingCategory}
            withContext={hasCategoryContext}
            pending={addCategory.isPending || updateCategory.isPending}
            onSave={handleSave}
          />
        </div>

        {/* Sections */}
        {(Object.entries(grouped) as [keyof typeof typeConfig, Category[]][]).map(([type, cats]) => {
          const { icon: Icon, label, color } = typeConfig[type];
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={cn("h-4 w-4", color)} />
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">({cats.length})</span>
              </div>

              {cats.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
                  Sin categorías de tipo {type.toLowerCase()}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cats.map((cat) => (
                    <div
                      key={cat.id}
                      className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                      style={{
                        backgroundColor: (cat.color || "#888") + "22",
                        color: cat.color || "#888",
                      }}
                    >
                      <span className="text-base leading-none">{cat.icon || "🏷️"}</span>
                      <span>{cat.name}</span>
                      {cat.is_active === false && <span className="text-[10px] opacity-60">Archivada</span>}
                      {/* Hover actions */}
                      <div className="absolute inset-0 rounded-full flex items-center justify-end pr-1.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm">
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
                </div>
              )}
            </div>
          );
        })}
      </div>

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
