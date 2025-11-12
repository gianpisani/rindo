import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
};

const typeColors = {
  Ingreso: "bg-success/10 text-success border-success/20",
  Gasto: "bg-destructive/10 text-destructive border-destructive/20",
  Inversión: "bg-info/10 text-info border-info/20",
};

const defaultColors = [
  "#10b981", "#059669", "#34d399", "#6ee7b7",
  "#ef4444", "#dc2626", "#f87171", "#fb923c",
  "#fbbf24", "#facc15", "#a3e635", "#f472b6",
  "#e11d48", "#be123c", "#f43f5e", "#3b82f6",
];

export default function Categories() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "Gasto" as "Ingreso" | "Gasto" | "Inversión",
    color: "#ef4444",
  });

  const groupedCategories = {
    Ingreso: categories.filter((cat) => cat.type === "Ingreso"),
    Gasto: categories.filter((cat) => cat.type === "Gasto"),
    Inversión: categories.filter((cat) => cat.type === "Inversión"),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCategory) {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        ...formData,
      });
    } else {
      await addCategory.mutateAsync(formData);
    }

    setIsDialogOpen(false);
    setEditingCategory(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "Gasto",
      color: "#ef4444",
    });
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color || "#ef4444",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta categoría?")) {
      await deleteCategory.mutateAsync(id);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Categorías</h1>
            <p className="text-muted-foreground">
              Gestiona las categorías de tus transacciones
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingCategory(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nueva Categoría
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? "Editar" : "Crear"} Categoría
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    placeholder="Nombre de la categoría"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="color">Color</Label>
                  <div className="grid grid-cols-8 gap-2">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          formData.color === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addCategory.isPending || updateCategory.isPending}>
                    {editingCategory ? "Guardar Cambios" : "Crear Categoría"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {Object.entries(groupedCategories).map(([type, cats]) => {
          const Icon = typeIcons[type as keyof typeof typeIcons];
          const colorClass = typeColors[type as keyof typeof typeColors];

          return (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {type}s
                  <Badge variant="outline" className="ml-auto">
                    {cats.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No hay categorías de este tipo
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cats.map((category) => (
                      <div
                        key={category.id}
                        className={`p-4 rounded-lg border-2 ${colorClass} flex items-center justify-between`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-full"
                            style={{ backgroundColor: category.color || "#gray" }}
                          />
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(category.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}