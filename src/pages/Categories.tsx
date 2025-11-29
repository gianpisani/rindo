import React, { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCategories } from "@/hooks/useCategories";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
};

const typeColors = {
  Ingreso: "text-success bg-success/10",
  Gasto: "text-destructive bg-destructive/10",
  Inversión: "text-info bg-info/10",
};

const typeBgGradient = {
  Ingreso: "from-success/5 to-success/10",
  Gasto: "from-destructive/5 to-destructive/10",
  Inversión: "from-info/5 to-info/10",
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

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };

  const confirmDeleteAction = async () => {
    if (confirmDelete.id) {
      await deleteCategory.mutateAsync(confirmDelete.id);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Categorías</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tus categorías de transacciones
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
              <Button className="rounded-full h-12 w-12 p-0 shadow-elevated md:w-auto md:px-6">
                <Plus className="h-5 w-5 md:mr-2" />
                <span className="hidden md:inline">Agregar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? "Editar" : "Crear"} Categoría
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Nombre</Label>
                  <Input
                    id="name"
                    placeholder="Nombre de la categoría"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-12 rounded-full px-6"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-medium">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="h-12 rounded-full px-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ingreso">Ingreso</SelectItem>
                      <SelectItem value="Gasto">Gasto</SelectItem>
                      <SelectItem value="Inversión">Inversión</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="color" className="text-sm font-medium">Color</Label>
                  <div className="grid grid-cols-8 gap-2">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-10 w-10 rounded-full border-2 transition-all duration-200 ${
                          formData.color === color ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:scale-105"
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
                    className="h-12 rounded-full"
                  />
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    className="rounded-full h-12"
                    disabled={addCategory.isPending || updateCategory.isPending}
                  >
                    {editingCategory ? "Guardar Cambios" : "Crear Categoría"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tablas por tipo */}
        {Object.entries(groupedCategories).map(([type, cats]) => (
          <CategoryTable
            key={type}
            type={type as keyof typeof typeIcons}
            categories={cats}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null })}
        onConfirm={confirmDeleteAction}
        title="¿Eliminar categoría?"
        description="Esta acción no se puede deshacer. La categoría será eliminada permanentemente."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </Layout>
  );
}

interface CategoryTableProps {
  type: "Ingreso" | "Gasto" | "Inversión";
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

function CategoryTable({ type, categories, onEdit, onDelete }: CategoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const Icon = typeIcons[type];
  const colorClass = typeColors[type];
  const bgGradient = typeBgGradient[type];

  const columns = useMemo<ColumnDef<Category>[]>(() => [
    {
      accessorKey: "color",
      header: "",
      cell: ({ row }) => {
        return (
          <div
            className="h-8 w-8 rounded-full shadow-sm flex-shrink-0"
            style={{ backgroundColor: row.original.color || "#gray" }}
          />
        );
      },
      enableSorting: false,
      size: 80,
      minSize: 80,
      maxSize: 80,
    },
    {
      accessorKey: "name",
      header: () => <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</span>,
      cell: ({ row }) => {
        return (
          <div className="font-medium text-sm truncate max-w-[200px] md:max-w-none">
            {row.original.name}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const handleEditClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          onEdit(row.original);
        };

        const handleDeleteClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          onDelete(row.original.id);
        };

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEditClick}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDeleteClick}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      size: 80,
      minSize: 80,
      maxSize: 80,
      enableSorting: false,
    },
  ], [onEdit, onDelete]);

  const table = useReactTable({
    data: categories,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <Card className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
      <CardHeader className={cn("pb-4 bg-gradient-to-r", bgGradient)}>
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className={cn("p-2 rounded-full", colorClass.split(" ")[1])}>
            <Icon className={cn("h-5 w-5", colorClass.split(" ")[0])} />
          </div>
          <span className="font-semibold">{type}s</span>
          <Badge variant="outline" className="ml-auto rounded-full">
            {categories.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {categories.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No hay categorías de tipo {type}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        style={{
                          width: header.getSize() !== 150 ? header.getSize() : undefined,
                        }}
                        className={cn(
                          "px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                          header.id === "actions" ? "text-right w-20" : "text-left",
                          header.id === "color" && "w-20"
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td 
                          key={cell.id} 
                          className={cn(
                            "px-6 py-4",
                            cell.column.id === "color" && "w-20",
                            cell.column.id === "actions" && "w-20",
                            cell.column.id === "name" ? "max-w-0" : "whitespace-nowrap"
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
