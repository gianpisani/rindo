import React, { useState } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";

const typeConfig = {
  Ingreso: {
    icon: TrendingUp,
    label: "Ingresos",
    color: "text-success",
    dot: "bg-success/20 text-success",
  },
  Gasto: {
    icon: TrendingDown,
    label: "Gastos",
    color: "text-destructive",
    dot: "bg-destructive/20 text-destructive",
  },
  Inversión: {
    icon: PiggyBank,
    label: "Inversiones",
    color: "text-info",
    dot: "bg-info/20 text-info",
  },
};

const defaultColors = [
  "#10b981", "#059669", "#34d399", "#6ee7b7",
  "#ef4444", "#dc2626", "#f87171", "#fb923c",
  "#fbbf24", "#facc15", "#a3e635", "#f472b6",
  "#e11d48", "#be123c", "#f43f5e", "#3b82f6",
];

interface Category {
  id: string;
  name: string;
  type: "Ingreso" | "Gasto" | "Inversión";
  color?: string;
}

export default function Categories() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "Gasto" as "Ingreso" | "Gasto" | "Inversión",
    color: "#ef4444",
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  const grouped = {
    Ingreso: categories.filter((c) => c.type === "Ingreso"),
    Gasto: categories.filter((c) => c.type === "Gasto"),
    Inversión: categories.filter((c) => c.type === "Inversión"),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, ...formData });
    } else {
      await addCategory.mutateAsync(formData);
    }
    setIsDialogOpen(false);
    setEditingCategory(null);
    resetForm();
  };

  const resetForm = () =>
    setFormData({ name: "", type: "Gasto", color: "#ef4444" });

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({ name: category.name, type: category.type, color: category.color || "#ef4444" });
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
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) { setEditingCategory(null); resetForm(); }
            }}
          >
            <DialogTrigger asChild>
              <Button className="rounded-full h-10 w-10 p-0 md:w-auto md:px-5 md:h-10">
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline text-sm">Agregar</span>
              </Button>
            </DialogTrigger>
          </Dialog>

          <BaseModal
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) { setEditingCategory(null); resetForm(); }
            }}
            title={editingCategory ? "Editar categoría" : "Nueva categoría"}
            maxWidth="sm"
            footer={
              <Button
                type="submit"
                form="category-form"
                className="w-full rounded-full"
                disabled={addCategory.isPending || updateCategory.isPending}
              >
                {editingCategory ? "Guardar" : "Crear"}
              </Button>
            }
          >
            <form id="category-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Nombre</Label>
                <Input
                  placeholder="ej. Supermercado"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-11 rounded-full px-5"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v: any) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger className="h-11 rounded-full px-5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ingreso">Ingreso</SelectItem>
                    <SelectItem value="Gasto">Gasto</SelectItem>
                    <SelectItem value="Inversión">Inversión</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Color</Label>
                <div className="grid grid-cols-8 gap-2">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-all duration-150",
                        formData.color === color
                          ? "border-foreground scale-110 shadow-md"
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-9 w-full rounded-lg cursor-pointer border border-border bg-transparent px-1"
                />
              </div>
            </form>
          </BaseModal>
        </div>

        {/* Sections */}
        {(Object.entries(grouped) as [keyof typeof typeConfig, Category[]][]).map(([type, cats]) => {
          const { icon: Icon, label, color, dot } = typeConfig[type];
          return (
            <div key={type}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("p-1.5 rounded-full", dot.split(" ")[0])}>
                  <Icon className={cn("h-3.5 w-3.5", color)} />
                </div>
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">({cats.length})</span>
              </div>

              {/* List */}
              {cats.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
                  Sin categorías de tipo {type.toLowerCase()}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/50 divide-y divide-border/50 overflow-hidden">
                  {cats.map((cat) => (
                    <div
                      key={cat.id}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      {/* Color dot */}
                      <div
                        className="h-7 w-7 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: cat.color || "#888" }}
                      />
                      {/* Name */}
                      <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                      {/* Actions - visible on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEdit(cat)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(cat.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
