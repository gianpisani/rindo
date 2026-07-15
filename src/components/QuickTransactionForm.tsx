import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { CornerDownLeft, Sparkles, Users, Undo2, X } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { useSharedExpenses } from "@/hooks/useSharedExpenses";
import { useSoundFX } from "@/hooks/useSoundFX";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "./ui/checkbox";
import SharedExpenseDrawer from "./SharedExpenseDrawer";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";

interface QuickTransactionFormProps {
  onSuccess?: () => void;
  defaultType?: "Ingreso" | "Gasto" | "Inversión" | "Reembolso";
}

const typeTexts = {
  "Ingreso": { placeholder: "¿De dónde salió esta plata?" },
  "Gasto": { placeholder: "¿En qué te lo gastaste?" },
  "Inversión": { placeholder: "¿Dónde pusiste la plata?" },
};

export default function QuickTransactionForm({ onSuccess, defaultType = "Gasto" }: QuickTransactionFormProps) {
  const [amount, setAmount] = useState("");
  const [detail, setDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [sharedDrawerOpen, setSharedDrawerOpen] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{ id: string; amount: number } | null>(null);
  const [amountError, setAmountError] = useState("");
  const [reimbursementCategory, setReimbursementCategory] = useState<string | null>(null);

  const { categories } = useCategories();
  const queryClient = useQueryClient();
  const { addTransaction } = useTransactions();
  const { playToggleOff, playTap } = useSoundFX();
  const { isPrivacyMode } = usePrivacyMode();
  const { addSharedExpenses } = useSharedExpenses();
  const detailInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const typeConfig = typeTexts[defaultType];

  const autoCategorizeInBackground = async (transactionId: string, detail: string, userId: string) => {
    try {
      const categoryNames = categories.map(c => c.name);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No hay sesión activa');
        return;
      }

      const payload = { transactionId, detail, userId, existingCategories: categoryNames };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-categorize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success && result.category) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });

        if (result.category !== "Sin categoría") {
          const methodLabels: Record<string, string> = {
            'exact_history': 'historial exacto',
            'fuzzy_history': 'historial similar',
            'keywords': 'keywords',
          };
          const methodLabel = methodLabels[result.method] || result.method;
          toast.success(`Categorizado: ${result.category} (${result.confidence}% · ${methodLabel})`);
        }
      }
    } catch (error) {
      console.error('Error en auto-categorización:', error);
      if (transactionId) {
        try {
          await supabase
            .from("transactions")
            .update({ category_name: "Sin categoría" })
            .eq("id", transactionId);
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
        } catch {}
      }
      toast.error("No se pudo categorizar automáticamente");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanAmount = amount.replace(/[$.,\s]/g, "");
    const parsedAmount = parseFloat(cleanAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError("Ingresa un monto válido");
      amountInputRef.current?.focus();
      return;
    }
    setAmountError("");
    setIsSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const willAnalyze = detail && detail.trim().length >= 3;
      const transaction = await addTransaction.mutateAsync({
        amount: parsedAmount,
        type: defaultType,
        category_name: willAnalyze ? "⚡ Analizando..." : "Sin categoría",
        detail: detail || null,
        date: new Date().toISOString(),
        reimbursement_for_category:
          defaultType === "Ingreso" ? reimbursementCategory : null,
      });

      if (willAnalyze && transaction?.id) {
        autoCategorizeInBackground(transaction.id, detail, userData.user.id);
      }

      if (isShared && defaultType === "Gasto" && transaction?.id) {
        setPendingTransaction({ id: transaction.id, amount: parsedAmount });
        setSharedDrawerOpen(true);
        setIsSubmitting(false);
        return;
      }

      setAmount("");
      setDetail("");
      setIsShared(false);
      setReimbursementCategory(null);
      setTimeout(() => amountInputRef.current?.focus(), 100);

      playToggleOff();
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

      toast.success(`Gasto compartido dividido entre ${debtors.length} personas`);

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

  const accentColor =
    defaultType === "Ingreso" ? "text-success" :
    defaultType === "Inversión" ? "text-blue-400" :
    "text-destructive";

  const buttonColor =
    defaultType === "Ingreso" ? "bg-success hover:bg-success/90" :
    defaultType === "Inversión" ? "bg-blue-500 hover:bg-blue-500/90" :
    "bg-destructive hover:bg-destructive/90";

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5 pt-1">
        {/* Amount — borderless, floating number */}
        <div className="space-y-1">
          <Input
            ref={amountInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="$0"
            value={amount}
            onChange={(e) => {
              const formatted = formatCurrency(e.target.value);
              setAmount(formatted);
              if (amountError) setAmountError("");
              playTap();
            }}
            onKeyDown={handleAmountKeyDown}
            style={{ fontSize: amount.length > 10 ? "clamp(2.8rem, 8vw, 3.5rem)" : amount.length > 7 ? "clamp(3.2rem, 11vw, 3.5rem)" : "clamp(3.5rem, 15vw, 4.5rem)" }}
            className={cn(
              "h-28 sm:h-32 text-center font-bold font-mono",
              "border-0 bg-transparent shadow-none",
              "placeholder:text-foreground/20 dark:placeholder:text-muted-foreground/30",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "transition-colors duration-200",
              isPrivacyMode && amount ? "privacy-blur" : "",
              amount ? accentColor : "",
            )}
          />
          {amountError && (
            <p className="text-center text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              {amountError}
            </p>
          )}
        </div>

        {/* Detail — clean ghost input */}
        <div className="space-y-2 px-2">
          <Input
            ref={detailInputRef}
            placeholder={typeConfig.placeholder}
            value={detail}
            onChange={(e) => { setDetail(e.target.value); playTap(); }}
            onKeyDown={handleDetailKeyDown}
            className={cn(
              "h-12 text-sm rounded-xl px-4 text-center",
              "border border-border dark:border-white/[0.06] bg-accent dark:bg-white/[0.02]",
              "focus:border-foreground/25 dark:focus:border-white/15 focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground",
              "transition-all duration-200",
            )}
          />
          <p className="text-center text-[10px] text-muted-foreground tracking-wide">
            <Sparkles className="inline h-2.5 w-2.5 mr-1 -translate-y-px" />
            categorización automática
          </p>
        </div>

        {/* Reimbursement suggestion — conservative chip, never automatic */}
        {defaultType === "Ingreso" &&
          (/reembolso|devoluci|me devolv|me pagaron/i.test(detail) ||
            reimbursementCategory) && (
            <div className="flex items-center justify-center gap-2 py-1 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
              {reimbursementCategory ? (
                <button
                  type="button"
                  onClick={() => setReimbursementCategory(null)}
                  className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/15 transition-colors"
                >
                  <Undo2 className="h-3 w-3" />
                  Reembolso de{" "}
                  {categories.find((c) => c.name === reimbursementCategory)?.icon || "🏷️"}{" "}
                  {reimbursementCategory}
                  <X className="h-3 w-3 opacity-60" />
                </button>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Undo2 className="h-3 w-3" />
                    ¿Es un reembolso?
                  </span>
                  <Select
                    value=""
                    onValueChange={(v) => setReimbursementCategory(v)}
                  >
                    <SelectTrigger className="h-7 w-[160px] rounded-full text-xs">
                      <SelectValue placeholder="Sí, de…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter((c) => c.type === "Gasto")
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((cat) => (
                          <SelectItem key={cat.name} value={cat.name}>
                            <span className="flex items-center gap-2">
                              <span className="text-sm leading-none">
                                {cat.icon || "🏷️"}
                              </span>
                              {cat.name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}

        {/* Shared expense — subtle toggle */}
        {defaultType === "Gasto" && (
          <div className="flex items-center justify-center gap-2 py-1">
            <Checkbox
              id="shared"
              checked={isShared}
              onCheckedChange={(checked) => setIsShared(checked as boolean)}
            />
            <label
              htmlFor="shared"
              className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Users className="h-3 w-3" />
              Compartido
            </label>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          className={cn(
            "w-full h-12 text-sm font-medium rounded-xl transition-all duration-200",
            buttonColor,
          )}
          disabled={!amount || isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
              Guardando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Agregar{amount ? ` ${amount}` : ""}
              <CornerDownLeft className="h-3.5 w-3.5 opacity-40" />
            </span>
          )}
        </Button>
      </form>

      <SharedExpenseDrawer
        open={sharedDrawerOpen}
        onOpenChange={setSharedDrawerOpen}
        totalAmount={pendingTransaction?.amount || 0}
        onConfirm={handleSharedExpenseConfirm}
      />
    </>
  );
}
