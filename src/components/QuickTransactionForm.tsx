import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Sparkles, Zap } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";

interface QuickTransactionFormProps {
  onSuccess?: () => void;
  defaultType?: "Ingreso" | "Gasto" | "Inversión";
}

const typeTexts = {
  "Ingreso": {
    placeholder: "¿De dónde vino esta plata?",
    emoji: "💰",
  },
  "Gasto": {
    placeholder: "¿En qué gastaste?",
    emoji: "💸",
  },
  "Inversión": {
    placeholder: "¿En qué invertiste?",
    emoji: "📈",
  },
};

export default function QuickTransactionForm({ onSuccess, defaultType = "Gasto" }: QuickTransactionFormProps) {
  const [amount, setAmount] = useState("");
  const [detail, setDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { categories } = useCategories();
  const { addTransaction } = useTransactions();
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

      // 1. GUARDAR con estado "Analizando..." si hay detalle, sino "Sin categoría"
      const willAnalyze = detail && detail.trim().length >= 3;
      const transaction = await addTransaction.mutateAsync({
        amount: parsedAmount,
        type: defaultType,
        category_name: willAnalyze ? "🤖 Analizando..." : "Sin categoría",
        detail: detail || null,
        date: new Date().toISOString(),
      });

      // 2. Si hay detalle, auto-categorizar en background con Edge Function
      if (willAnalyze && transaction?.id) {
        console.log('Llamando auto-categorize con:', { transactionId: transaction.id, detail, userId: userData.user.id });
        autoCategorizeInBackground(transaction.id, detail, userData.user.id);
      }

      // Reset form
      setAmount("");
      setDetail("");
      
      // Focus back to amount for next entry
      setTimeout(() => amountInputRef.current?.focus(), 100);
      
      onSuccess?.();
    } catch (error) {
      console.error("Error guardando transacción:", error);
    } finally {
      setIsSubmitting(false);
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
    <Card className="rounded-3xl shadow-lg border-0 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Input - MÁS GRANDE */}
          <div className="space-y-2">
            <Input
              ref={amountInputRef}
              id="amount"
              type="text"
              placeholder="$0"
              autoFocus
              value={amount}
              onChange={(e) => {
                const formatted = formatCurrency(e.target.value);
                setAmount(formatted);
              }}
              onKeyDown={handleAmountKeyDown}
              className="text-8xl sm:text-9xl h-32 sm:h-40 text-center font-bold rounded-3xl border-2 border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all bg-white dark:bg-slate-900 placeholder:text-slate-300"
            />
            {showKeyboardHints && (
              <p className="text-center text-sm text-slate-500 flex items-center justify-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                <span className="font-medium">Tab</span> para continuar
              </p>
            )}
          </div>

          {/* Detail Input - Texto dinámico según tipo */}
          <div className="space-y-3">
            <div className="relative">
              <Input
                ref={detailInputRef}
                id="detail"
                placeholder={`${typeConfig.emoji} ${typeConfig.placeholder} (opcional)`}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                onKeyDown={handleDetailKeyDown}
                className="h-14 text-lg rounded-2xl px-5 border-2 border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all bg-white dark:bg-slate-900 placeholder:text-slate-400"
              />
            </div>
            
            <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Lo categorizaremos automáticamente con IA
            </p>
          </div>

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
                <Zap className="h-4 w-4" />
                Agregar {amount && `${amount}`}
              </span>
            )}
          </Button>
          
          {showKeyboardHints && (
            <p className="text-center text-xs text-slate-400">
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">Enter</kbd> para guardar rápido
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}