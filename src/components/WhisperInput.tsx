import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useSoundFX } from "@/hooks/useSoundFX";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";

const TRANSACTION_TYPES = [
  {
    key: "Gasto" as const,
    label: "Gasto",
    color: "rgb(248, 113, 113)",
    colorMuted: "rgba(248, 113, 113, 0.4)",
    colorBg: "rgba(248, 113, 113, 0.1)",
    placeholder: "45000 sushi",
  },
  {
    key: "Ingreso" as const,
    label: "Ingreso",
    color: "rgb(74, 222, 128)",
    colorMuted: "rgba(74, 222, 128, 0.4)",
    colorBg: "rgba(74, 222, 128, 0.1)",
    placeholder: "1500000 sueldo",
  },
  {
    key: "Inversión" as const,
    label: "Inversión",
    color: "rgb(96, 165, 250)",
    colorMuted: "rgba(96, 165, 250, 0.4)",
    colorBg: "rgba(96, 165, 250, 0.1)",
    placeholder: "200000 fintual",
  },
] as const;

type TransactionType = (typeof TRANSACTION_TYPES)[number]["key"];

interface WhisperInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhisperInput({ open, onOpenChange }: WhisperInputProps) {
  const [value, setValue] = useState("");
  const [typeIndex, setTypeIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "saving" | "success">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const { addTransaction } = useTransactions();
  const { categories } = useCategories();
  const { playCelebration } = useSoundFX();
  const queryClient = useQueryClient();

  const currentType = TRANSACTION_TYPES[typeIndex];

  useEffect(() => {
    if (open) {
      setValue("");
      setTypeIndex(0);
      setStatus("idle");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const cycleType = useCallback(() => {
    setTypeIndex((prev) => (prev + 1) % TRANSACTION_TYPES.length);
  }, []);

  const parseInput = (input: string) => {
    const cleaned = input.trim();
    const match = cleaned.match(/^\$?\s*([\d.,]+)\s*(.*)/);
    if (!match) return null;

    const amountStr = match[1].replace(/[.,]/g, "");
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) return null;

    const detail = match[2]?.trim() || null;
    return { amount, detail };
  };

  const autoCategorizeInBackground = async (
    transactionId: string,
    detail: string,
    userId: string
  ) => {
    try {
      const categoryNames = categories.map((c) => c.name);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-categorize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionId,
            detail,
            userId,
            existingCategories: categoryNames,
          }),
        }
      );

      const result = await response.json();
      if (result.success && result.category) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        if (result.category !== "Sin categoría") {
          toast.success(`Categorizado: ${result.category}`, { duration: 2000 });
        }
      }
    } catch (error) {
      console.error("Whisper auto-categorize error:", error);
    }
  };

  const handleSubmit = async () => {
    const parsed = parseInput(value);
    if (!parsed) return;

    setStatus("saving");

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const willAnalyze = parsed.detail && parsed.detail.length >= 3;

      const transaction = await addTransaction.mutateAsync({
        amount: parsed.amount,
        type: currentType.key,
        category_name: willAnalyze ? "\u26A1 Analizando..." : "Sin categoría",
        detail: parsed.detail,
        date: new Date().toISOString(),
        card_id: null,
        installment_id: null,
      });

      if (willAnalyze && transaction?.id) {
        autoCategorizeInBackground(
          transaction.id,
          parsed.detail!,
          userData.user.id
        );
      }

      setStatus("success");
      playCelebration();

      setTimeout(() => {
        onOpenChange(false);
        setStatus("idle");
        setValue("");
      }, 1000);
    } catch (error) {
      console.error("Whisper save error:", error);
      toast.error("Error al guardar");
      setStatus("idle");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      cycleType();
      return;
    }
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  const formatPreview = (input: string) => {
    const parsed = parseInput(input);
    if (!parsed) return null;
    const formatted = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(parsed.amount);
    return { amount: formatted, detail: parsed.detail };
  };

  const preview = value ? formatPreview(value) : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
            onClick={() => status === "idle" && onOpenChange(false)}
          />

          {/* Content */}
          <div className="relative z-10 w-full max-w-lg mx-4">
            <AnimatePresence mode="wait">
              {status === "success" ? (
                <motion.div
                  key="success"
                  className="flex flex-col items-center gap-3"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <motion.div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: currentType.colorBg }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: 0.1,
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                    }}
                  >
                    <Check className="h-6 w-6" style={{ color: currentType.color }} />
                  </motion.div>
                  {preview && (
                    <motion.p
                      className="text-white/60 text-sm font-medium"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      {preview.amount} guardado
                    </motion.p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  className="flex flex-col items-center gap-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  {/* Type indicator pill */}
                  <motion.div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: currentType.colorBg,
                      color: currentType.color,
                    }}
                    layout
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: currentType.color }}
                      layoutId="type-dot"
                      transition={{ duration: 0.3 }}
                    />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={currentType.key}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                      >
                        {currentType.label}
                      </motion.span>
                    </AnimatePresence>
                  </motion.div>

                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={currentType.placeholder}
                    className="w-full text-center text-3xl md:text-4xl font-light bg-transparent border-none outline-none placeholder:text-white/15 font-sans transition-colors duration-300"
                    style={{
                      color: value ? currentType.color : "rgba(255,255,255,0.9)",
                      caretColor: currentType.color,
                    }}
                  />

                  {/* Live preview */}
                  {preview && (
                    <motion.div
                      className="flex items-center gap-2 text-sm transition-colors duration-300"
                      style={{ color: currentType.colorMuted }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span className="font-mono">{preview.amount}</span>
                      {preview.detail && (
                        <>
                          <span style={{ opacity: 0.5 }}>&middot;</span>
                          <span>{preview.detail}</span>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* Hints */}
                  <motion.p
                    className="text-white/20 text-xs tracking-wide"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    monto + detalle &middot; Tab tipo &middot; Enter guardar
                    &middot; Esc cerrar
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
