import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Filter, Sparkles, Info, AlertTriangle, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function BulkRecategorize() {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [newCategory, setNewCategory] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Filtrar transacciones
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesCategory = filterCategory === "all" || transaction.category_name === filterCategory;
    const matchesType = filterType === "all" || transaction.type === filterType;
    const matchesSearch = !searchTerm || 
      transaction.detail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.category_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesType && matchesSearch;
  });

  // Toggle selección de transacción
  const toggleTransaction = (id: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTransactions(newSelected);
  };

  // Seleccionar todas las filtradas
  const selectAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  // Aplicar recategorización
  const applyRecategorization = async () => {
    setShowConfirm(false);
    setIsApplying(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      if (selectedTransactions.size === 0) {
        toast({
          title: "Sin selección",
          description: "Debes seleccionar al menos una transacción",
          variant: "destructive",
        });
        return;
      }

      if (!newCategory) {
        toast({
          title: "Sin categoría",
          description: "Debes seleccionar una categoría de destino",
          variant: "destructive",
        });
        return;
      }

      let success = 0;
      let errors = 0;

      // Actualizar cada transacción seleccionada
      for (const txId of Array.from(selectedTransactions)) {
        try {
          const { error } = await supabase
            .from("transactions")
            .update({ category_name: newCategory })
            .eq("id", txId)
            .eq("user_id", userData.user.id); // Seguridad: solo del usuario actual

          if (error) {
            console.error("Error actualizando:", error);
            errors++;
          } else {
            success++;
          }
        } catch (error) {
          console.error("Error:", error);
          errors++;
        }
      }

      toast({
        title: "Recategorización completada",
        description: `${success} transacciones actualizadas${errors > 0 ? `, ${errors} errores` : ""}`,
      });

      // Limpiar selección y recargar
      setSelectedTransactions(new Set());
      setNewCategory("");
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  // Obtener tipo de las transacciones seleccionadas
  const selectedTypes = new Set(
    Array.from(selectedTransactions)
      .map(id => transactions.find(t => t.id === id)?.type)
      .filter(Boolean)
  );

  // Categorías disponibles según los tipos seleccionados
  const availableCategories = selectedTypes.size === 1
    ? categories.filter(c => c.type === Array.from(selectedTypes)[0])
    : categories;

  const allSelected = filteredTransactions.length > 0 && selectedTransactions.size === filteredTransactions.length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Recategorización Masiva</h1>
            <p className="text-sm text-muted-foreground">
              Selecciona transacciones y cambia su categoría en lote
            </p>
          </div>
          <Button
            onClick={() => navigate("/recategorize")}
            variant="outline"
            className="rounded-full gap-2 border-purple-300 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          >
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">IA Auto-Categorizar</span>
          </Button>
        </div>

        <Alert className="rounded-2xl border-blue-200 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm">
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>Filtra las transacciones que deseas recategorizar</li>
              <li>Selecciona manualmente o marca todas</li>
              <li>Elige la nueva categoría y aplica los cambios</li>
              <li>Solo tus transacciones serán modificadas</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Panel de filtros */}
        <Card className="rounded-2xl shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Buscar</Label>
                <Input
                  placeholder="Buscar por detalle o categoría..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 rounded-full px-4"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-10 rounded-full px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Ingreso">Ingreso</SelectItem>
                    <SelectItem value="Gasto">Gasto</SelectItem>
                    <SelectItem value="Inversión">Inversión</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Categoría Actual</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-10 rounded-full px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories
                      .filter(cat => cat.name && cat.name.trim().length > 0)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel de acción masiva */}
        {selectedTransactions.size > 0 && (
          <Card className="rounded-2xl shadow-sm border-purple-300 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 sticky top-20 z-10 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{selectedTransactions.size}</p>
                    <p className="text-xs text-muted-foreground">Seleccionadas</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-2 block">Nueva Categoría</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger className="h-10 rounded-full min-w-[200px]">
                        <SelectValue placeholder="Selecciona categoría..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories
                          .filter(cat => cat.name && cat.name.trim().length > 0)
                          .map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {cat.type}
                                </Badge>
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={!newCategory || isApplying}
                  className="rounded-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg w-full md:w-auto"
                >
                  {isApplying ? (
                    <>Aplicando...</>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Aplicar Cambios
                    </>
                  )}
                </Button>
              </div>
              {selectedTypes.size > 1 && (
                <Alert className="mt-4 rounded-xl border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">
                    Has seleccionado transacciones de diferentes tipos. Asegúrate de elegir una categoría compatible.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Botón seleccionar todas */}
        {filteredTransactions.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="rounded-full"
            >
              {allSelected ? "Deseleccionar todas" : "Seleccionar todas"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {filteredTransactions.length} transacciones mostradas
            </p>
          </div>
        )}

        {/* Lista de transacciones */}
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <Card className="rounded-2xl shadow-sm border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                No se encontraron transacciones con esos filtros
              </CardContent>
            </Card>
          ) : (
            filteredTransactions.map((transaction) => {
              const isSelected = selectedTransactions.has(transaction.id);
              
              return (
                <Card 
                  key={transaction.id} 
                  className={`rounded-2xl shadow-sm border transition-all duration-200 cursor-pointer hover:shadow-md ${
                    isSelected
                      ? "border-purple-300 bg-purple-50/50 dark:bg-purple-950/10"
                      : "border-border/50"
                  }`}
                  onClick={() => toggleTransaction(transaction.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 pt-1">
                        <div
                          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-purple-600 border-purple-600"
                              : "border-gray-300 hover:border-purple-400"
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-4 w-4 text-white" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {transaction.type}
                              </Badge>
                              <Badge className="text-xs bg-gray-600">
                                {transaction.category_name}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(transaction.date), "d 'de' MMM, yyyy", { locale: es })}
                            </p>
                          </div>
                        </div>
                        {transaction.detail && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {transaction.detail}
                          </p>
                        )}
                        <p className="text-lg font-semibold mt-2">
                          ${Number(transaction.amount).toLocaleString("es-CL")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={applyRecategorization}
        title="¿Aplicar recategorización?"
        description={`Se cambiarán ${selectedTransactions.size} transacciones a la categoría "${newCategory}". Esta acción no se puede deshacer.`}
        confirmText="Aplicar cambios"
        cancelText="Cancelar"
      />
    </Layout>
  );
}

