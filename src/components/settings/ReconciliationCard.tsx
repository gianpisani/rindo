import { useState, useEffect } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { CreditCard, Wallet, AlertTriangle, CheckCircle2, PencilRuler, TrendingUp, TrendingDown } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useSoundFX } from "@/hooks/useSoundFX";
import { computeRealBalance } from "@/lib/real-flows";
import { cardsDebt } from "@/lib/card-cycle";
import { clp } from "@/lib/format";
import { readJson, writeStorage } from "@/lib/storage";

const RECONCILIATION_KEY = "reconciliation-data";

interface ReconciliationCardProps {
  onSuccess?: () => void;
}

export function ReconciliationCard({ onSuccess }: ReconciliationCardProps = {}) {
  const { transactions, addTransaction } = useTransactions();
  const { categories } = useCategories();
  const { cardSummaries } = useCreditCards();
  const { playCelebration } = useSoundFX();
  const [cuentaCorriente, setCuentaCorriente] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const balanceApp = computeRealBalance(transactions);
  const deudaTarjetas = cardsDebt(transactions, cardSummaries);

  const cuentaCorrienteNum = parseFloat(cuentaCorriente) || 0;

  const balanceReal = cuentaCorrienteNum - deudaTarjetas;

  const diferencia = balanceReal - balanceApp;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void
  ) => {
    const value = e.target.value.replace(/[^\d]/g, "");
    setter(value);
  };

  const formatNumber = (value: string) => {
    if (!value) return "";
    return new Intl.NumberFormat("es-CL").format(Number(value));
  };

  useEffect(() => {
    setCuentaCorriente(readJson<{ cc?: string }>(RECONCILIATION_KEY)?.cc || "");
  }, []);

  useEffect(() => {
    writeStorage(RECONCILIATION_KEY, JSON.stringify({ cc: cuentaCorriente }));
  }, [cuentaCorriente]);

  const diferenciaColor = 
    Math.abs(diferencia) < 1000 
      ? "text-success" 
      : diferencia > 0 
      ? "text-warning" 
      : "text-destructive";

  const needsReconciliation = Math.abs(diferencia) >= 1000;

  const handleCreateReconciliation = async () => {
    if (!needsReconciliation) return;
    
    setIsCreating(true);
    
    try {
      const conciliacionCategory = categories.find(c => 
        c.name.toLowerCase().includes("conciliación") || 
        c.name.toLowerCase().includes("ajuste")
      );
      const categoryName = conciliacionCategory?.name || "Otros";
      
      const type = diferencia > 0 ? "Ingreso" : "Gasto";
      
      await addTransaction.mutateAsync({
        date: new Date().toISOString(),
        detail: `Conciliación automática - Ajuste de ${clp(Math.abs(diferencia))}`,
        category_name: categoryName,
        type: type,
        amount: Math.abs(diferencia),
      });
      
      setCuentaCorriente("");
      setShowPreview(false);

      playCelebration();

      if (onSuccess) {
        onSuccess();
      }
    } finally {
      setIsCreating(false);
    }
  };

  const hasInputs = cuentaCorrienteNum > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cuenta-corriente" className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="h-4 w-4 text-success" />
            Saldo en tu banco
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              id="cuenta-corriente"
              type="text"
              placeholder="0"
              value={formatNumber(cuentaCorriente)}
              onChange={(e) => handleInputChange(e, setCuentaCorriente)}
              className="pl-7 h-11"
            />
          </div>
        </div>

      </div>

      {hasInputs && (
        <div className="space-y-3 pt-4 border-t">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-muted-foreground"><Wallet className="h-4 w-4" />Saldo en tu banco</span>
              <span className="font-mono tabular-nums">{clp(cuentaCorrienteNum)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-muted-foreground"><CreditCard className="h-4 w-4" />− Tarjetas</span>
              <span className="font-mono tabular-nums">{clp(deudaTarjetas)}</span>
            </div>
            <div className="flex justify-between items-center border-t pt-2">
              <span className="font-medium">= Liquidez real</span>
              <span className={`text-xl font-medium font-mono tabular-nums ${balanceReal >= 0 ? "text-success" : "text-destructive"}`}>
                {clp(balanceReal)}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Líquido en Rindo</span>
            <span className={`text-xl font-medium font-mono tabular-nums ${balanceApp >= 0 ? "text-success" : "text-destructive"}`}>
              {clp(balanceApp)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Tarjetas es lo que Rindo sabe que debes: lo por facturar más lo que queda por pagar del estado de cuenta cerrado.
          </p>

          <div className={`rounded-card p-4 mt-2 ${
            !needsReconciliation 
              ? "bg-success/10 border border-success/20" 
              : "bg-destructive/10 border border-destructive/20"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {!needsReconciliation ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm font-medium">
                  {!needsReconciliation ? "Balances conciliados ✓" : "Diferencia detectada"}
                </span>
              </div>
              <span className={`text-xl font-medium font-mono tabular-nums ${diferenciaColor}`}>
                {clp(Math.abs(diferencia))}
              </span>
            </div>
            
            {needsReconciliation && !showPreview && (
              <Button
                onClick={() => setShowPreview(true)}
                className="w-full"
              >
                <PencilRuler />
                Crear Transacción de Ajuste
              </Button>
            )}

            {needsReconciliation && showPreview && (() => {
              const type = diferencia > 0 ? "Ingreso" : "Gasto";
              const conciliacionCategory = categories.find(c =>
                c.name.toLowerCase().includes("conciliación") ||
                c.name.toLowerCase().includes("ajuste")
              );
              const categoryName = conciliacionCategory?.name || "Otros";

              return (
                <div className="space-y-3 mt-2 rounded-card border bg-background p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-xs font-medium text-muted-foreground">Preview de transacción</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="flex items-center gap-1.5 font-medium">
                        {type === "Ingreso" ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        {type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Monto</span>
                      <span className="font-medium font-mono tabular-nums">{clp(Math.abs(diferencia))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Categoría</span>
                      <span className="font-medium">{categoryName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Detalle</span>
                      <span className="text-xs truncate max-w-[160px]">Conciliación automática</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateReconciliation}
                      disabled={isCreating}
                      className="flex-1"
                    >
                      {isCreating ? (
                        <>
                          <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                          Creando...
                        </>
                      ) : (
                        "Confirmar"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
