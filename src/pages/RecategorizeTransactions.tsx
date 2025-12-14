import { useState, useRef } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, CheckCircle2, AlertTriangle, Info, Check, X, Wand2, Webhook, StopCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categorizeTransaction } from "@/lib/categorizer";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/useCategories";

interface SuggestionItem {
  id: string;
  detail: string;
  oldCategory: string;
  suggestedCategory: string;
  confidence: number;
  type: "Ingreso" | "Gasto" | "Inversión";
  accepted: boolean;
  edited: boolean;
}

interface AnalysisProgress {
  current: number;
  total: number;
  currentDetail: string;
  status: "analyzing" | "complete";
}

export default function RecategorizeTransactions() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const shouldStopAnalysisRef = useRef(false);
  const [isApplying, setIsApplying] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({
    current: 0,
    total: 0,
    currentDetail: "",
    status: "analyzing",
  });
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [streamingSuggestions, setStreamingSuggestions] = useState<SuggestionItem[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();
  const { categories } = useCategories();

  const analyzeSuggestions = async () => {
    setIsAnalyzing(true);
    shouldStopAnalysisRef.current = false;
    setSuggestions([]);
    setStreamingSuggestions([]);
    setAnalysisProgress({ current: 0, total: 0, currentDetail: "", status: "analyzing" });

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      // Obtener todas las transacciones con detalle
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userData.user.id)
        .not("detail", "is", null)
        .order("date", { ascending: false });

      if (error) throw error;
      if (!transactions || transactions.length === 0) {
        toast({
          title: "No hay transacciones",
          description: "No se encontraron transacciones con detalle para analizar",
        });
        setIsAnalyzing(false);
        return;
      }

      setAnalysisProgress({ current: 0, total: transactions.length, currentDetail: "", status: "analyzing" });

      const newSuggestions: SuggestionItem[] = [];
      const categoryNames = categories.map(c => c.name);

      for (let i = 0; i < transactions.length; i++) {
        // Verificar si el usuario detuvo el análisis
        if (shouldStopAnalysisRef.current) {
          toast({
            title: "Análisis detenido",
            description: `Se analizaron ${i} de ${transactions.length} transacciones. ${newSuggestions.length} sugerencias encontradas.`,
          });
          break;
        }

        const tx = transactions[i];
        
        // Actualizar progreso con detalle actual
        setAnalysisProgress({
          current: i + 1,
          total: transactions.length,
          currentDetail: tx.detail,
          status: "analyzing",
        });
        
        try {
          const result = await categorizeTransaction(tx.detail, userData.user.id, categoryNames);
          
          // Solo mostrar si:
          // 1. Hay sugerencia válida y no vacía
          // 2. El tipo coincide (seguridad)
          // 3. La categoría es diferente a la actual
          if (
            result.category && 
            result.category.trim().length > 0 &&
            result.type === tx.type && 
            result.category.toLowerCase() !== tx.category_name.toLowerCase()
          ) {
            const newSuggestion: SuggestionItem = {
              id: tx.id,
              detail: tx.detail,
              oldCategory: tx.category_name,
              suggestedCategory: result.category,
              confidence: result.confidence,
              type: tx.type,
              accepted: result.confidence >= 70, // Auto-aceptar si confianza alta
              edited: false,
            };
            
            newSuggestions.push(newSuggestion);
            
            // Mostrar en streaming (últimas 5)
            setStreamingSuggestions(prev => [newSuggestion, ...prev].slice(0, 5));
          }
          
          // Pequeña pausa para no saturar y que se vea mejor la animación
          if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error("Error analizando transacción:", error);
        }
      }

      setAnalysisProgress(prev => ({ ...prev, status: "complete" }));
      setSuggestions(newSuggestions);
      setStreamingSuggestions([]);
      
      if (!shouldStopAnalysisRef.current) {
        if (newSuggestions.length === 0) {
          toast({
            title: "Sin cambios sugeridos",
            description: "Todas tus transacciones ya tienen categorías apropiadas 🎉",
          });
        } else {
          toast({
            title: "Análisis completado",
            description: `${newSuggestions.length} sugerencias encontradas`,
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      shouldStopAnalysisRef.current = false;
    }
  };

  const stopAnalysis = () => {
    shouldStopAnalysisRef.current = true;
  };

  const toggleAccept = (id: string) => {
    setSuggestions(prev => 
      prev.map(s => 
        s.id === id ? { ...s, accepted: !s.accepted } : s
      )
    );
  };

  const updateCategory = (id: string, newCategory: string) => {
    setSuggestions(prev => 
      prev.map(s => 
        s.id === id ? { ...s, suggestedCategory: newCategory, edited: true, accepted: true } : s
      )
    );
  };

  const applyChanges = async () => {
    setShowConfirmDialog(false);
    setIsApplying(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({
          title: "Error",
          description: "No se pudo obtener el usuario",
          variant: "destructive",
        });
        setIsApplying(false);
        return;
      }

      const acceptedSuggestions = suggestions.filter(s => s.accepted);
      
      if (acceptedSuggestions.length === 0) {
        toast({
          title: "Sin cambios",
          description: "No hay sugerencias aceptadas para aplicar",
        });
        setIsApplying(false);
        return;
      }

      // PASO 1: Identificar categorías nuevas que necesitan ser creadas
      const newCategoriesToCreate = new Map<string, { name: string; type: "Ingreso" | "Gasto" | "Inversión" }>();
      
      for (const suggestion of acceptedSuggestions) {
        const categoryExists = categories.some(
          c => c.name.toLowerCase() === suggestion.suggestedCategory.toLowerCase() && c.type === suggestion.type
        );
        
        if (!categoryExists && !newCategoriesToCreate.has(suggestion.suggestedCategory.toLowerCase())) {
          newCategoriesToCreate.set(suggestion.suggestedCategory.toLowerCase(), {
            name: suggestion.suggestedCategory,
            type: suggestion.type,
          });
        }
      }

      // PASO 2: Crear las nuevas categorías
      let categoriesCreated = 0;
      for (const [_, categoryData] of newCategoriesToCreate) {
        try {
          const { error } = await supabase
            .from("categories")
            .insert({
              user_id: userData.user.id,
              name: categoryData.name,
              type: categoryData.type,
            });

          if (error) {
            console.error("Error creando categoría:", error);
          } else {
            categoriesCreated++;
          }
        } catch (error) {
          console.error("Error creando categoría:", error);
        }
      }

      // PASO 3: Actualizar las transacciones
      let success = 0;
      let errors = 0;

      for (const suggestion of acceptedSuggestions) {
        try {
          const { error } = await supabase
            .from("transactions")
            .update({ category_name: suggestion.suggestedCategory })
            .eq("id", suggestion.id);

          if (error) {
            errors++;
            console.error("Error actualizando:", error);
          } else {
            success++;
          }
        } catch (error) {
          errors++;
          console.error("Error:", error);
        }
      }

      toast({
        title: "Cambios aplicados",
        description: `${success} transacciones actualizadas${categoriesCreated > 0 ? `, ${categoriesCreated} categorías nuevas creadas` : ""}${errors > 0 ? `, ${errors} errores` : ""}`,
      });

      // Limpiar sugerencias aplicadas
      setSuggestions(prev => prev.filter(s => !s.accepted));
      
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

  const acceptedCount = suggestions.filter(s => s.accepted).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Recategorización Inteligente</h1>
          <p className="text-sm text-muted-foreground">
            Revisa y aprueba las sugerencias de categorización inteligente
          </p>
        </div>

        <Alert className="rounded-2xl bg-white border border-border/50 shadow-sm">
          <AlertDescription className="text-sm">
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>Analiza todas tus transacciones y te muestra solo los cambios sugeridos</li>
              <li>Puedes aceptar, rechazar o editar cada sugerencia</li>
              <li>Los cambios solo se aplican cuando tú confirmes</li>
              <li>Las transacciones bien categorizadas no aparecen</li>
            </ul>
          </AlertDescription>
        </Alert>

        {!isAnalyzing && suggestions.length === 0 && (
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Comenzar Análisis
              </CardTitle>
              <CardDescription>
                Analizaremos tus transacciones y te mostraremos solo aquellas que necesiten recategorización
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={analyzeSuggestions}
                className="w-full rounded-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Wand2 className="h-5 w-5 mr-2" />
                Analizar Transacciones
              </Button>
            </CardContent>
          </Card>
        )}

        {isAnalyzing && (
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      <Webhook className="h-6 w-6 text-primary animate-pulse" />
                      <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-20" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-medium">Analizando...</p>
                      <p className="text-sm text-muted-foreground">
                        {analysisProgress.current} de {analysisProgress.total} transacciones
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="outline" className="text-lg font-bold">
                      {analysisProgress.total > 0 
                        ? Math.round((analysisProgress.current / analysisProgress.total) * 100)
                        : 0}%
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopAnalysis}
                      className="rounded-full h-10"
                    >
                      <StopCircle className="h-4 w-4 mr-2" />
                      Detener
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Progress 
                    value={analysisProgress.total > 0 
                      ? (analysisProgress.current / analysisProgress.total) * 100 
                      : 0} 
                    className="h-2 text-primary" 
                  />
                </div>

                {analysisProgress.currentDetail && (
                  <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Analizando:</p>
                    <p className="text-sm font-medium truncate animate-pulse">
                      {analysisProgress.currentDetail}
                    </p>
                  </div>
                )}

                {streamingSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Sugerencias encontradas:</p>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {streamingSuggestions.map((suggestion, idx) => (
                        <div
                          key={suggestion.id}
                          className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-3 border border-primary/50 animate-in slide-in-from-top-2 duration-200"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{suggestion.detail}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {suggestion.oldCategory}
                                </Badge>
                                <span className="text-xs text-muted-foreground">→</span>
                                <Badge variant="default" className="text-xs bg-primary">
                                  {suggestion.suggestedCategory}
                                </Badge>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {suggestion.confidence}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!isAnalyzing && suggestions.length > 0 && (
          <>
            <Card className="rounded-2xl shadow-sm border-border/50 sticky top-20 z-10 bg-background/95 backdrop-blur">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-2xl font-bold">{suggestions.length}</p>
                      <p className="text-xs text-muted-foreground">Sugerencias</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <p className="text-2xl font-bold text-success">{acceptedCount}</p>
                      <p className="text-xs text-muted-foreground">Aceptadas</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={acceptedCount === 0 || isApplying}
                    className="rounded-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
                  >
                    {isApplying ? (
                      <>Aplicando...</>
                    ) : (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        Aplicar {acceptedCount} Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {suggestions.map((suggestion) => {
                const getCategoriesForType = categories.filter(c => c.type === suggestion.type);
                
                // Verificar si la categoría sugerida existe y no está vacía
                const hasSuggestedCategory = suggestion.suggestedCategory && suggestion.suggestedCategory.trim().length > 0;
                const categoryExists = hasSuggestedCategory && getCategoriesForType.some(
                  c => c.name.toLowerCase() === suggestion.suggestedCategory.toLowerCase()
                );
                
                // Si no existe pero hay sugerencia válida, agregarla temporalmente a la lista
                const categoriesWithSuggestion = (hasSuggestedCategory && !categoryExists)
                  ? [...getCategoriesForType, { id: 'temp-' + suggestion.id, name: suggestion.suggestedCategory, type: suggestion.type }]
                  : getCategoriesForType;
                
                return (
                  <Card
                    key={suggestion.id}
                    className={`rounded-2xl shadow-sm border transition-all duration-200 ${
                      suggestion.accepted
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 pt-1">
                          <button
                            onClick={() => toggleAccept(suggestion.id)}
                            className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              suggestion.accepted
                                ? "bg-primary border-primary"
                                : "border-input hover:border-primary"
                            }`}
                          >
                            {suggestion.accepted && (
                              <Check className="h-4 w-4 text-white" />
                            )}
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 space-y-3">
                          <div>
                            <p className="font-medium text-sm truncate">{suggestion.detail}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {suggestion.type}
                              </Badge>
                              {suggestion.confidence < 60 && (
                                <Badge variant="outline" className="text-xs text-warning border-warning">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Baja confianza ({suggestion.confidence}%)
                                </Badge>
                              )}
                              {suggestion.edited && (
                                <Badge variant="outline" className="text-xs text-info border-info">
                                  Editado
                                </Badge>
                              )}
                              {!categoryExists && (
                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                  <Info className="h-3 w-3 mr-1" />
                                  Categoría nueva
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Categoría actual:</p>
                              <Badge variant="secondary" className="rounded-full">
                                {suggestion.oldCategory}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Sugerencia:</p>
                              <Select
                                value={suggestion.suggestedCategory}
                                onValueChange={(value) => updateCategory(suggestion.id, value)}
                              >
                                <SelectTrigger className="h-9 rounded-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {categoriesWithSuggestion
                                    .filter(cat => cat.name && cat.name.trim().length > 0)
                                    .map((cat) => (
                                      <SelectItem key={cat.id} value={cat.name}>
                                        {cat.name}
                                        {cat.id.toString().startsWith('temp-') && ' (nueva)'}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="flex-shrink-0 pt-1">
                          <button
                            onClick={() => setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))}
                            className="h-8 w-8 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors text-destructive hover:text-destructive"
                            title="Eliminar sugerencia"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={applyChanges}
        title="¿Aplicar cambios?"
        description={`Se actualizarán ${acceptedCount} transacciones. Esta acción no se puede deshacer.`}
        confirmText="Aplicar cambios"
        cancelText="Cancelar"
      />
    </Layout>
  );
}

