import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, PiggyBank, X, Webhook } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { format } from "date-fns";
import { categorizeTransaction, debounce } from "@/lib/categorizer";
import { supabase } from "@/integrations/supabase/client";

const typeConfig = {
  Ingreso: { icon: TrendingUp, color: "bg-success text-success-foreground", textColor: "text-success" },
  Gasto: { icon: TrendingDown, color: "bg-destructive text-destructive-foreground", textColor: "text-destructive" },
  Inversión: { icon: PiggyBank, color: "bg-blue text-white", textColor: "text-blue" },
};

interface QuickTransactionFormProps {
  onSuccess?: () => void;
}

export default function QuickTransactionForm({ onSuccess }: QuickTransactionFormProps = {}) {
  const [amount, setAmount] = useState("");
  const [selectedType, setSelectedType] = useState<"Ingreso" | "Gasto" | "Inversión" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [detail, setDetail] = useState("");
  const [suggestion, setSuggestion] = useState<{
    category: string;
    type: "Ingreso" | "Gasto" | "Inversión";
    confidence: number;
    reasons: string[];
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { categories } = useCategories();
  const { addTransaction } = useTransactions();

  const filteredCategories = categories.filter((cat) => cat.type === selectedType);

  // Función para categorizar con debounce
  const debouncedCategorize = useCallback(
    debounce(async (text: string) => {
      if (!text || text.trim().length < 3) {
        setSuggestion(null);
        setIsAnalyzing(false);
        return;
      }

      setIsAnalyzing(true);
      
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setIsAnalyzing(false);
          return;
        }

        // Pasar las categorías existentes para priorizar matches
        const categoryNames = categories.map(c => c.name);
        const result = await categorizeTransaction(text, userData.user.id, categoryNames);
        
        if (result.category && result.confidence > 30) {
          setSuggestion({
            category: result.category,
            type: result.type!,
            confidence: result.confidence,
            reasons: result.reasons,
          });
        } else {
          setSuggestion(null);
        }
      } catch (error) {
        console.error("Error categorizando:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }, 1300),
    [categories]
  );

  // Efecto para categorizar cuando cambia el detalle
  useEffect(() => {
    if (detail && !selectedCategory) {
      debouncedCategorize(detail);
    } else if (!detail || selectedCategory) {
      // Limpiar sugerencia si se borra el detalle o se selecciona una categoría
      setSuggestion(null);
    }
  }, [detail, selectedCategory, debouncedCategorize]);

  // Aplicar sugerencia
  const applySuggestion = () => {
    if (suggestion) {
      // Solo cambiar el tipo si no hay uno seleccionado
      if (!selectedType) {
        setSelectedType(suggestion.type);
      }
      // Buscar la categoría exacta en las existentes (case-insensitive)
      const matchingCategory = categories.find(
        c => c.name.toLowerCase() === suggestion.category.toLowerCase()
      );
      setSelectedCategory(matchingCategory?.name || suggestion.category);
      setSuggestion(null);
    }
  };

  // Rechazar sugerencia
  const dismissSuggestion = () => {
    setSuggestion(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !selectedCategory || !amount) return;

    // Limpiar el monto de cualquier formato (eliminar $, puntos, comas)
    const cleanAmount = amount.replace(/[$.,\s]/g, "");
    const parsedAmount = parseFloat(cleanAmount);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    await addTransaction.mutateAsync({
      amount: parsedAmount,
      type: selectedType,
      category_name: selectedCategory,
      detail: detail || null,
      date: format(new Date(), "yyyy-MM-dd"),
    });

    // Reset form
    setAmount("");
    setSelectedType(null);
    setSelectedCategory("");
    setDetail("");
    setSuggestion(null);
    
    // Call onSuccess callback if provided
    onSuccess?.();
  };

  const formatCurrency = (value: string) => {
    const number = value.replace(/\D/g, "");
    if (!number) return "";
    const formatted = new Intl.NumberFormat("es-CL").format(parseInt(number));
    return `$${formatted}`;
  };

  return (
    <Card className="rounded-2xl shadow-sm border-border/50 bg-white/50 dark:bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">Nueva Transacción</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              id="amount"
              type="text"
              placeholder="$0"
              value={amount}
              onChange={(e) => {
                const formatted = formatCurrency(e.target.value);
                setAmount(formatted);
              }}
              className="text-4xl h-16 text-center font-semibold rounded-2xl border-border/30 focus:border-primary/50 transition-all bg-muted/30"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map((type) => {
                const { icon: Icon, color } = typeConfig[type];
                const isSelected = selectedType === type;
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className={`h-16 flex flex-col gap-1 rounded-xl transition-all duration-200 ${
                      isSelected 
                        ? color + " shadow-sm" 
                        : "border-border/30 hover:bg-muted/30"
                    }`}
                    onClick={() => {
                      setSelectedType(type);
                      setSelectedCategory("");
                    }}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{type}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {selectedType && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <Label className="text-xs font-medium text-muted-foreground">Categoría</Label>
              <div className="flex flex-wrap gap-2">
                {filteredCategories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={selectedCategory === category.name ? "default" : "outline"}
                    className={`cursor-pointer px-4 py-2 text-xs rounded-full transition-all duration-150 ${
                      selectedCategory === category.name 
                        ? "shadow-sm scale-105" 
                        : "border-border/30 hover:bg-muted/30 hover:scale-105"
                    }`}
                    style={
                      selectedCategory === category.name && category.color
                        ? { backgroundColor: category.color, borderColor: category.color }
                        : {}
                    }
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    {category.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 animate-in fade-in duration-200">
            <Label htmlFor="detail" className="text-xs font-medium text-muted-foreground">
              Detalle (opcional)
            </Label>
            <Input
              id="detail"
              placeholder="Ej: Almuerzo con amigos..."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="h-10 rounded-xl px-4 border-border/30 focus:border-primary/50 transition-all text-sm bg-muted/30"
            />
            
            {(isAnalyzing || suggestion) && !selectedCategory && (
              <div className="relative -mt-2 z-30">
                <div className="absolute inset-x-0 top-0 animate-in slide-in-from-top-2 fade-in duration-300">
                  {isAnalyzing && (
                    <div className="rounded-xl bg-white border border-primary/30 dark:border-purple-700 p-3 shadow-md">
                      <div className="flex items-center gap-2">
                        <Webhook className="h-4 w-4 animate-pulse text-blue-600" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Analizando...
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {suggestion && !isAnalyzing && (
                    <div className="rounded-xl bg-white border border-purple-300 dark:border-purple-700 p-3 shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Webhook className="h-4 w-4 text-purple-600 animate-pulse" />
                          <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                            Sugerencia
                          </span>
                          <Badge variant="outline" className="h-5 text-[10px] px-2 bg-white text-black">
                            {suggestion.confidence}% confianza
                          </Badge>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={dismissSuggestion}
                          className="h-6 w-6 p-0 rounded-full hover:bg-purple-200/50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2.5">
                        {!selectedType && (
                          <>
                            <Badge variant="outline" className="text-xs px-2.5 py-0.5 bg-white border-purple-300 dark:border-purple-700">
                              {suggestion.type}
                            </Badge>
                          </>
                        )}
                        <Badge variant="outline" className="text-xs px-2.5 py-0.5 bg-white border-purple-300 dark:border-purple-700">
                          {suggestion.category}
                        </Badge>
                      </div>
                      
                      <Button
                        type="button"
                        onClick={applySuggestion}
                        className="w-full h-8 text-xs rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-sm"
                      >
                        Aplicar categoría
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-sm rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
            disabled={!amount || !selectedType || !selectedCategory || addTransaction.isPending}
          >
            {addTransaction.isPending ? "Guardando..." : "Agregar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}