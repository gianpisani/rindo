import { useState, useEffect } from "react";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { CreditCard as CreditCardIcon, Palette } from "lucide-react";
import { CreditCard } from "@/hooks/useCreditCards";

interface CreditCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CreditCard | null;
  onSave: (card: Omit<CreditCard, "id" | "user_id" | "created_at" | "updated_at">) => Promise<void>;
}

const CARD_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#1e293b", // slate
  "#000000", // black
];

export function CreditCardModal({ open, onOpenChange, card, onSave }: CreditCardModalProps) {
  const [name, setName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [billingDay, setBillingDay] = useState("15");
  const [paymentDay, setPaymentDay] = useState("5");
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!card;

  useEffect(() => {
    if (card) {
      setName(card.name);
      setCreditLimit(card.credit_limit.toString());
      setBillingDay(card.billing_day.toString());
      setPaymentDay(card.payment_day.toString());
      setColor(card.color || CARD_COLORS[0]);
    } else {
      setName("");
      setCreditLimit("");
      setBillingDay("15");
      setPaymentDay("5");
      setColor(CARD_COLORS[0]);
    }
  }, [card, open]);

  const formatCurrency = (value: string) => {
    const number = value.replace(/\D/g, "");
    if (!number) return "";
    const formatted = new Intl.NumberFormat("es-CL").format(parseInt(number));
    return `$${formatted}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !creditLimit || !billingDay || !paymentDay) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name,
        credit_limit: parseInt(creditLimit.replace(/\D/g, "")),
        billing_day: parseInt(billingDay),
        payment_day: parseInt(paymentDay),
        color,
        is_active: true,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Tarjeta" : "Nueva Tarjeta"}
      description="Configura los datos de tu tarjeta de crédito"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card Preview */}
        <div
          className="relative h-60 rounded-2xl p-5 text-white shadow-lg overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` }}
        >
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <CreditCardIcon className="h-8 w-8 opacity-80" />
              <span className="text-xs opacity-70">Crédito</span>
            </div>
            
            <div>
              <p className="text-lg font-bold truncate">{name || "Nombre de tarjeta"}</p>
              <p className="text-2xl font-bold mt-1">
                {creditLimit ? formatCurrency(creditLimit) : "$0"}
              </p>
              <div className="flex gap-4 mt-2 text-xs opacity-80">
                <span>Cierre: día {billingDay}</span>
                <span>Pago: día {paymentDay}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Nombre de la tarjeta</Label>
          <Input
            id="name"
            placeholder="Ej: Visa Santander"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12"
          />
        </div>

        {/* Credit Limit */}
        <div className="space-y-2">
          <Label htmlFor="limit">Límite de crédito</Label>
          <Input
            id="limit"
            placeholder="$0"
            value={creditLimit ? formatCurrency(creditLimit) : ""}
            onChange={(e) => setCreditLimit(e.target.value.replace(/\D/g, ""))}
            className="h-12 text-lg font-semibold"
          />
        </div>

        {/* Billing & Payment Days */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="billing">Día de cierre</Label>
            <Input
              id="billing"
              type="number"
              min={1}
              max={31}
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">Cuando cierra el estado de cuenta</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment">Día de pago</Label>
            <Input
              id="payment"
              type="number"
              min={1}
              max={31}
              value={paymentDay}
              onChange={(e) => setPaymentDay(e.target.value)}
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">Vencimiento del pago</p>
          </div>
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Color
          </Label>
          <div className="flex flex-wrap gap-2">
            {CARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-12 text-base font-semibold"
          disabled={!name || !creditLimit || isSubmitting}
        >
          {isSubmitting ? "Guardando..." : isEditing ? "Guardar Cambios" : "Agregar Tarjeta"}
        </Button>
      </form>
    </BaseModal>
  );
}
