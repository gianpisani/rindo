import React, { useState } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight, ArrowDownToLine, LineChart } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";
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

const defaultColors = [
  "#10b981", "#059669", "#34d399", "#6ee7b7",
  "#f97316", "#0ea5e9", "#a855f7", "#ec4899",
  "#8b5cf6", "#6366f1", "#14b8a6", "#ef4444",
  "#f59e0b", "#64748b", "#78716c", "#3b82f6",
];


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
  const [formData, setFormData] = useState({
    name: "",
    type: "Gasto" as TransactionType,
    color: "#ef4444",
    icon: "🏷️",
    description: "",
    is_active: true,
  });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { description, is_active, ...base } = formData;
    const values = hasCategoryContext ? { ...base, description, is_active } : base;
    if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, ...values });
    } else {
      await addCategory.mutateAsync(values);
    }
    setIsDialogOpen(false);
    setEditingCategory(null);
    resetForm();
  };

  const resetForm = () =>
    setFormData({ name: "", type: "Gasto", color: "#ef4444", icon: "🏷️", description: "", is_active: true });

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color || "#ef4444",
      icon: category.icon || "🏷️",
      description: category.description || "",
      is_active: category.is_active !== false,
    });
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
                size="cta"
                disabled={addCategory.isPending || updateCategory.isPending}
              >
                {editingCategory ? "Guardar" : "Crear"}
              </Button>
            }
          >
            <form id="category-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Preview */}
              <div className="flex justify-center">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                  style={{ backgroundColor: formData.color + "22", color: formData.color }}
                >
                  <span>{formData.icon}</span>
                  <span>{formData.name || "Nombre"}</span>
                </div>
              </div>

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
                  onValueChange={(v: TransactionType) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger className="h-11 rounded-full px-5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ingreso">Ingreso</SelectItem>
                    <SelectItem value="Gasto">Gasto</SelectItem>
                    <SelectItem value="Inversión">Inversión</SelectItem>
                    <SelectItem value="Rescate">Rescate</SelectItem>
                    <SelectItem value="Rendimiento">Rendimiento</SelectItem>
                    <SelectItem value="Reembolso">Reembolso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasCategoryContext && <>
                <div className="space-y-1.5">
                  <Label htmlFor="category-description">Qué incluye</Label>
                  <Textarea id="category-description" value={formData.description} maxLength={600}
                    placeholder="Qué gastos van aquí y cuáles no. Ayuda a categorizar mejor."
                    onChange={event => setFormData({ ...formData, description: event.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.is_active}
                    onChange={event => setFormData({ ...formData, is_active: event.target.checked })} />
                  Disponible para nuevos movimientos
                </label>
              </>}

              {/* Emoji picker */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Emoji</Label>
                <EmojiPicker
                  value={formData.icon ?? ""}
                  onSelect={(emoji) => setFormData({ ...formData, icon: emoji })}
                />
              </div>

              {/* Color picker */}
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
                      {cat.is_active === false && <span className="text-[10px] opacity-60">Histórica</span>}
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
