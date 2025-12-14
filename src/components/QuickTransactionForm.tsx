import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { ArrowRightToLine, CornerDownLeft, CornerDownLeftIcon, Cpu, Sparkles, Zap, Users } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { useSharedExpenses } from "@/hooks/useSharedExpenses";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { FingerPrintIcon } from "@heroicons/react/24/outline";
import { Checkbox } from "./ui/checkbox";
import SharedExpenseDrawer from "./SharedExpenseDrawer";

interface QuickTransactionFormProps {
  onSuccess?: () => void;
  defaultType?: "Ingreso" | "Gasto" | "Inversión";
}

const typeTexts = {
  "Ingreso": {
    placeholder: "¿De dónde salió esta plata?",
  },
  "Gasto": {
    placeholder: "¿En qué te lo gastaste?",
  },
  "Inversión": {
    placeholder: "¿Dónde pusiste la plata?",
  },
};

export default function QuickTransactionForm({ onSuccess, defaultType = "Gasto" }: QuickTransactionFormProps) {
  const [amount, setAmount] = useState("");
  const [detail, setDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [sharedDrawerOpen, setSharedDrawerOpen] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{ id: string; amount: number } | null>(null);

  const { categories } = useCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { addTransaction } = useTransactions();
  const { addSharedExpenses } = useSharedExpenses();
  const detailInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  const typeConfig = typeTexts[defaultType];

  // Llamar a Edge Function para auto-categorizar
  const autoCategorizeInBackground = async (transactionId: string, detail: string, userId: string) => {
    try {
      const categoryNames = categories.map(c => c.name);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No hay sesión activa');
        return;
      }

      const payload = {
        transactionId,
        detail,
        userId,
        existingCategories: categoryNames,
      };

      console.log('Payload a enviar:', payload);

      // Llamar a Edge Function de forma asíncrona
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-categorize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('Respuesta de auto-categorize:', result);
      
      // Actualizar la UI inmediatamente
      if (result.success && result.category) {
        // Invalidar queries para refrescar
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        
        // Mostrar toast con el resultado
        if (result.category !== "Sin categoría") {
          toast({
            title: "Categorizado automáticamente",
            description: `${result.category} · ${result.confidence}% de confianza`,
          });
        }
      }
      
    } catch (error) {
      console.error('Error en auto-categorización:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanAmount = amount.replace(/[$.,\s]/g, "");
    const parsedAmount = parseFloat(cleanAmount);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    setIsSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // 1. GUARDAR con estado especial si va a analizar
      const willAnalyze = detail && detail.trim().length >= 3;
      const transaction = await addTransaction.mutateAsync({
        amount: parsedAmount,
        type: defaultType,
        category_name: willAnalyze ? "⚡ Analizando..." : "Sin categoría",
        detail: detail || null,
        date: new Date().toISOString(),
      });

      // 2. Si hay detalle, auto-categorizar en background con Edge Function
      if (willAnalyze && transaction?.id) {
        console.log('Llamando auto-categorize con:', { transactionId: transaction.id, detail, userId: userData.user.id });
        autoCategorizeInBackground(transaction.id, detail, userData.user.id);
      }

      // 3. Si es gasto compartido, abrir drawer para dividir
      if (isShared && defaultType === "Gasto" && transaction?.id) {
        setPendingTransaction({ id: transaction.id, amount: parsedAmount });
        setSharedDrawerOpen(true);
        setIsSubmitting(false);
        return; // No reset aún
      }

      // Reset form
      setAmount("");
      setDetail("");
      setIsShared(false);
      
      // Focus back to amount for next entry
      setTimeout(() => amountInputRef.current?.focus(), 100);
      
      onSuccess?.();
    } catch (error) {
      console.error("Error guardando transacción:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSharedExpenseConfirm = async (debtors: Array<{ name: string; amount: number }>) => {
    if (!pendingTransaction) return;

    try {
      await addSharedExpenses.mutateAsync(
        debtors.map(d => ({
          transaction_id: pendingTransaction.id,
          debtor_name: d.name,
          amount_owed: d.amount,
        }))
      );

      toast({
        title: "Gasto compartido creado",
        description: `Dividido entre ${debtors.length} personas`,
      });

      // Reset form
      setAmount("");
      setDetail("");
      setIsShared(false);
      setPendingTransaction(null);
      
      setTimeout(() => amountInputRef.current?.focus(), 100);
      onSuccess?.();
    } catch (error) {
      console.error("Error guardando gastos compartidos:", error);
    }
  };

  // Handle keyboard navigation (solo desktop)
  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Tab" || e.key === "Enter") && !isMobile()) {
      e.preventDefault();
      detailInputRef.current?.focus();
    }
  };

  const handleDetailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isMobile()) {
      e.preventDefault();
      if (amount) {
        const form = e.currentTarget.closest("form");
        form?.requestSubmit();
      }
    }
  };

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const formatCurrency = (value: string) => {
    const number = value.replace(/\D/g, "");
    if (!number) return "";
    const formatted = new Intl.NumberFormat("es-CL").format(parseInt(number));
    return `$${formatted}`;
  };

  const showKeyboardHints = !isMobile();

  return (
    <Card className="border-0 shadow-none bg-transparent dark:from-slate-900 dark:to-slate-800 overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Input - MÁS GRANDE */}
          <div className="space-y-2">
            <Input
              ref={amountInputRef}
              id="amount"
              type="text"
              placeholder="$0"
              value={amount}
              onChange={(e) => {
                const formatted = formatCurrency(e.target.value);
                setAmount(formatted);
              }}
              onKeyDown={handleAmountKeyDown}
              className="h-32 sm:h-40 md:text-4xl text-center font-bold rounded-3xl border-2 border-input focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all bg-background placeholder:text-muted-foreground/50"
            />
            {showKeyboardHints && (
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <ArrowRightToLine className="h-3.5 w-3.5" />
                <span><span className="font-bold">Tab</span> para continuar</span>
              </p>
            )}
          </div>

          {/* Detail Input - Texto dinámico según tipo */}
          <div className="space-y-3">
            <div className="relative">
              <Input
                ref={detailInputRef}
                id="detail"
                placeholder={`${typeConfig.placeholder} (opcional)`}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                onKeyDown={handleDetailKeyDown}
                className="h-14 text-lg rounded-2xl px-5 border-2 border-input focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all bg-background placeholder:text-muted-foreground text-center"
              />
            </div>
            
            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" />
              <span>Lo categorizaremos nosotros por ti</span>
            </p>
          </div>

          {/* Gasto Compartido Checkbox - Solo para Gastos */}
          {defaultType === "Gasto" && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-input hover:border-primary/50 transition-colors">
              <Checkbox 
                id="shared" 
                checked={isShared}
                onCheckedChange={(checked) => setIsShared(checked as boolean)}
              />
              <label
                htmlFor="shared"
                className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
              >
                <Users className="h-4 w-4 text-primary" />
                Gasto compartido con amigos
              </label>
            </div>
          )}

          {/* Submit Button - Limpio y directo */}
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
            disabled={!amount || isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 animate-spin" />
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FingerPrintIcon className="h-4 w-4" />
                Agregar {amount && `${amount}`}
              </span>
            )}
          </Button>
          
          {showKeyboardHints && (
            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <CornerDownLeft className="h-3.5 w-3.5" />
              <span><span className="font-bold">Enter</span> para guardar rápido</span>
            </p>
          )}
        </form>
      </CardContent>

      {/* Shared Expense Drawer */}
      <SharedExpenseDrawer
        open={sharedDrawerOpen}
        onOpenChange={setSharedDrawerOpen}
        totalAmount={pendingTransaction?.amount || 0}
        onConfirm={handleSharedExpenseConfirm}
      />
    </Card>
  );
}