import { useState, useEffect } from "react";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon, CreditCard, Receipt } from "lucide-react";
import { format, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { InstallmentPurchase } from "@/hooks/useInstallments";
import { CreditCard as CreditCardType } from "@/hooks/useCreditCards";
import { useCategories } from "@/hooks/useCategories";

interface InstallmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment?: InstallmentPurchase | null;
  creditCards: CreditCardType[];
  onSave: (
    purchase: Omit<
      InstallmentPurchase,
      "id" | "user_id" | "created_at" | "updated_at" | "card_name" | "card_color"
    >
  ) => Promise<void>;
}

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 10, 12, 18, 24, 36, 48];

export function InstallmentModal({
  open,
  onOpenChange,
  installment,
  creditCards,
  onSave,
}: InstallmentModalProps) {
  const { categories } = useCategories();
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("6");
  const [cardId, setCardId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [firstInstallmentDate, setFirstInstallmentDate] = useState<Date>(addMonths(new Date(), 1));
  const [categoryName, setCategoryName] = useState("Otros gastos");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!installment;

  // Calculate installment amount
  const installmentAmount =
    totalAmount && totalInstallments
      ? Math.ceil(parseInt(totalAmount.replace(/\D/g, "")) / parseInt(totalInstallments))
      : 0;

  useEffect(() => {
    if (installment) {
      setDescription(installment.description);
      setTotalAmount(installment.total_amount.toString());
      setTotalInstallments(installment.total_installments.toString());
      setCardId(installment.card_id);
      setPurchaseDate(new Date(installment.purchase_date));
      setFirstInstallmentDate(new Date(installment.first_installment_date));
      setCategoryName(installment.category_name || "Otros gastos");
      setNotes(installment.notes || "");
    } else {
      setDescription("");
      setTotalAmount("");
      setTotalInstallments("6");
      setCardId(creditCards[0]?.id || "");
      setPurchaseDate(new Date());
      setFirstInstallmentDate(addMonths(new Date(), 1));
      setCategoryName("Otros gastos");
      setNotes("");
    }
  }, [installment, open, creditCards]);

  // Set first card as default when cards load
  useEffect(() => {
    if (!cardId && creditCards.length > 0) {
      setCardId(creditCards[0].id);
    }
  }, [creditCards, cardId]);

  const formatCurrency = (value: string | number) => {
    const number = typeof value === "number" ? value : parseInt(value.toString().replace(/\D/g, ""));
    if (!number || isNaN(number)) return "$0";
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !totalAmount || !cardId) return;

    setIsSubmitting(true);
    try {
      await onSave({
        card_id: cardId,
        description,
        total_amount: parseInt(totalAmount.replace(/\D/g, "")),
        total_installments: parseInt(totalInstallments),
        installment_amount: installmentAmount,
        paid_installments: installment?.paid_installments || 0,
        purchase_date: format(purchaseDate, "yyyy-MM-dd"),
        first_installment_date: format(firstInstallmentDate, "yyyy-MM-dd"),
        category_name: categoryName,
        notes: notes || null,
        is_active: true,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCard = creditCards.find((c) => c.id === cardId);
  const expenseCategories = categories.filter((c) => c.type === "Gasto");

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Compra" : "Nueva Compra en Cuotas"}
      description="Registra una compra para llevar el control de tus cuotas"
      maxWidth="lg"
      variant="expense"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Summary Card */}
        <div className="bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: selectedCard?.color || "#6366f1" }}
            >
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">{selectedCard?.name || "Selecciona tarjeta"}</p>
              <p className="text-xs text-muted-foreground">
                {description || "Nueva compra"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold text-lg">{formatCurrency(totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cuotas</p>
              <p className="font-bold text-lg">{totalInstallments}x</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cuota</p>
              <p className="font-bold text-lg text-destructive">{formatCurrency(installmentAmount)}</p>
            </div>
          </div>
        </div>

        {/* Card Selection */}
        <div className="space-y-2">
          <Label>Tarjeta</Label>
          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Selecciona una tarjeta" />
            </SelectTrigger>
            <SelectContent>
              {creditCards.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: card.color || "#6366f1" }}
                    />
                    {card.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">¿Qué compraste?</Label>
          <Input
            id="description"
            placeholder="Ej: Bicicleta, MacBook Pro, Televisor..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-12"
          />
        </div>

        {/* Amount & Installments */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto total</Label>
            <Input
              id="amount"
              placeholder="$0"
              value={totalAmount ? formatCurrency(totalAmount) : ""}
              onChange={(e) => setTotalAmount(e.target.value.replace(/\D/g, ""))}
              className="h-12 text-lg font-semibold"
            />
          </div>
          <div className="space-y-2">
            <Label>Cantidad de cuotas</Label>
            <Select value={totalInstallments} onValueChange={setTotalInstallments}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTALLMENT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? "cuota" : "cuotas"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Fecha de compra</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal",
                    !purchaseDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {purchaseDate ? format(purchaseDate, "PPP", { locale: es }) : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={purchaseDate}
                  onSelect={(date) => date && setPurchaseDate(date)}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Primera cuota</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal",
                    !firstInstallmentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {firstInstallmentDate
                    ? format(firstInstallmentDate, "PPP", { locale: es })
                    : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={firstInstallmentDate}
                  onSelect={(date) => date && setFirstInstallmentDate(date)}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select value={categoryName} onValueChange={setCategoryName}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {expenseCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            placeholder="Detalles adicionales..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-destructive to-red-600"
          disabled={!description || !totalAmount || !cardId || isSubmitting}
        >
          <Receipt className="mr-2 h-4 w-4" />
          {isSubmitting ? "Guardando..." : isEditing ? "Guardar Cambios" : "Agregar Compra"}
        </Button>
      </form>
    </BaseModal>
  );
}
