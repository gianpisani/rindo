import React, { useState } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Screen, Row, Panel } from "@/components/HairlineGrid";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";

const typeConfig = {
  Ingreso: { icon: TrendingUp, label: "Ingresos", color: "text-success", bg: "bg-success/10" },
  Gasto: { icon: TrendingDown, label: "Gastos", color: "text-destructive", bg: "bg-destructive/10" },
  Inversión: { icon: PiggyBank, label: "Inversiones", color: "text-info", bg: "bg-info/10" },
  Reembolso: { icon: ArrowLeftRight, label: "Reembolsos", color: "text-warning", bg: "bg-warning/10" },
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
  type: "Ingreso" | "Gasto" | "Inversión" | "Reembolso";
  color?: string | null;
  icon?: string | null;
}

export default function Categories() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "Gasto" as "Ingreso" | "Gasto" | "Inversión" | "Reembolso",
    color: "#ef4444",
    icon: "🏷️",
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  const grouped = {
    Ingreso: categories.filter((c) => c.type === "Ingreso"),
    Gasto: categories.filter((c) => c.type === "Gasto"),
    Inversión: categories.filter((c) => c.type === "Inversión"),
    Reembolso: categories.filter((c) => c.type === "Reembolso"),
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
    setFormData({ name: "", type: "Gasto", color: "#ef4444", icon: "🏷️" });

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color || "#ef4444",
      icon: category.icon || "🏷️",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => setConfirmDelete({ open: true, id });

  const confirmDeleteAction = async () => {
    if (confirmDelete.id) await deleteCategory.mutateAsync(confirmDelete.id);
  };

  return (
    <Layout bleed>
      {/* Mismo chasis que Inicio: identidad como franja y la taxonomía
          como la fila que cede. Los cuatro tipos son cuatro columnas
          separadas por la línea, no cuatro secciones apiladas con aire
          entre ellas. */}
      <Screen>
        {/* ── Fila 1 — identidad y la única acción de página ─────── */}
        <Panel className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5 lg:shrink-0">
          <div className="min-w-0">
            <h1 className="page-title text-xl md:text-2xl">Categorías</h1>
            <p className="eyebrow mt-1">
              {categories.length}{" "}
              {categories.length === 1 ? "categoría" : "categorías"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) { setEditingCategory(null); resetForm(); }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Agregar</span>
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
                {/* Preview: la misma forma que tendrá en la lista — regla
                    de color a la izquierda, no relleno teñido. */}
                <div className="flex justify-center">
                  <div className="inline-flex items-stretch border border-border">
                    <span
                      className="w-[3px] shrink-0"
                      style={{ backgroundColor: formData.color }}
                      aria-hidden
                    />
                    <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
                      <span>{formData.icon}</span>
                      <span>{formData.name || "Nombre"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Nombre</Label>
                  <Input
                    placeholder="ej. Supermercado"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-11 rounded-sm px-5"
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
                    <SelectTrigger className="h-11 rounded-sm px-5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ingreso">Ingreso</SelectItem>
                      <SelectItem value="Gasto">Gasto</SelectItem>
                      <SelectItem value="Inversión">Inversión</SelectItem>
                      <SelectItem value="Reembolso">Reembolso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Emoji picker */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Emoji</Label>
                  <EmojiPicker
                    value={formData.icon ?? ""}
                    onSelect={(emoji) => setFormData({ ...formData, icon: emoji })}
                  />
                </div>

                {/* Color picker. Los puntos siguen redondos —  son puntos
                    de color de verdad — pero el elegido se marca con el
                    borde, no con un halo. */}
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
                            ? "border-foreground scale-110"
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
                    className="h-9 w-full rounded-sm cursor-pointer border border-border bg-transparent px-1"
                  />
                </div>
              </form>
            </BaseModal>
          </div>
        </Panel>

        {/* ── Fila 2 — los cuatro tipos. Esta es la que cede: cada
            columna scrollea por dentro, así llena cualquier alto. ── */}
        <Row className="lg:min-h-0 lg:flex-1 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(grouped) as [keyof typeof typeConfig, Category[]][]).map(([type, cats]) => {
            const { icon: Icon, label, color } = typeConfig[type];
            return (
              <Panel key={type} className="flex flex-col">
                <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5 md:px-4">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
                  <h2 className="section-title truncate text-xs">{label}</h2>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                    {cats.length}
                  </span>
                </div>

                {cats.length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs text-muted-foreground md:px-4">
                    Sin categorías de {label.toLowerCase()}
                  </p>
                ) : (
                  <div className="overflow-y-auto lg:min-h-0 lg:flex-1">
                    {cats.map((cat) => (
                      <div
                        key={cat.id}
                        className="group relative flex items-stretch border-b border-border transition-colors last:border-b-0 hover:bg-muted"
                      >
                        {/* El color de la categoría, como regla de 3px */}
                        <span
                          className="w-[3px] shrink-0"
                          style={{ backgroundColor: cat.color || "var(--muted-foreground)" }}
                          aria-hidden
                        />
                        <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 md:px-3">
                          <span className="w-4 shrink-0 text-center text-[13px] leading-none">
                            {cat.icon || "🏷️"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {cat.name}
                          </span>
                        </div>
                        {/* Las acciones aparecen sobre la fila, sin vidrio:
                            el fondo es el mismo del hover. */}
                        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 bg-muted pl-5 pr-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            className="flex size-6 items-center justify-center rounded-full transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => handleEdit(cat)}
                            aria-label={`Editar ${cat.name}`}
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button
                            className="flex size-6 items-center justify-center rounded-full transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => handleDelete(cat.id)}
                            aria-label={`Eliminar ${cat.name}`}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </Row>
      </Screen>

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
