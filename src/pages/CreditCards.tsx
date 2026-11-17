import { useMemo, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreditCards, type CreditCard, type CreditCardSummary } from "@/hooks/useCreditCards";
import { installmentProgress, useInstallments, type InstallmentPurchase } from "@/hooks/useInstallments";
import { useTransactions } from "@/hooks/useTransactions";
import { billingCycle, cardStatus, cycleStatement, type CardStatus } from "@/lib/card-cycle";
import { isCardPayment } from "@/lib/ledger";
import { CreditCardModal } from "@/components/CreditCardModal";
import { InstallmentModal } from "@/components/InstallmentModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";

/**
 * Tarjetas: ¿cuánto llevo este ciclo, cuándo cierra y cuándo pago? Cada
 * plástico lo responde de un vistazo. Abajo, las compras en cuotas (cuántas
 * quedan) y el estado de cuenta de la tarjeta elegida, ciclo por ciclo. Lo
 * largo scrollea adentro de su panel, nunca la página.
 */

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);

const day = (d: Date) => format(d, "d MMM", { locale: es }).replace(".", "");

/** El ciclo que se muestra en el estado de cuenta, con su nombre. */
const labeledCycle = (billingDay: number, offset: number) => {
  const cycle = billingCycle(billingDay, offset);
  return { ...cycle, label: format(cycle.end, "MMMM yyyy", { locale: es }) };
};

export default function CreditCards() {
  const { isPrivacyMode } = usePrivacyMode();
  const {
    creditCards,
    cardSummaries,
    isLoading: isLoadingCards,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
  } = useCreditCards();
  const {
    installments,
    isLoading: isLoadingInstallments,
    addInstallment,
    updateInstallment,
    deleteInstallment,
  } = useInstallments();
  const { transactions } = useTransactions();

  const loading = isLoadingCards || isLoadingInstallments;
  const hasCards = cardSummaries.length > 0;

  // ── Modales ──
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [installmentModalOpen, setInstallmentModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<InstallmentPurchase | null>(null);
  // Eliminar tarjeta o compra: un solo diálogo. El contenido se queda mientras se cierra.
  const [toDelete, setToDelete] = useState<{ kind: "card" | "installment"; id: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [openInstallment, setOpenInstallment] = useState<string | null>(null);

  // ── La tarjeta elegida manda el estado de cuenta ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cycleOffset, setCycleOffset] = useState(0);
  const selected = cardSummaries.find((c) => c.id === selectedId) ?? cardSummaries[0];

  // Lo que muestra cada plástico: lo por facturar y lo que queda por pagar.
  const cardCycles = useMemo(
    () => new Map(cardSummaries.map((card) => [card.id, cardStatus(transactions, card)] as const)),
    [cardSummaries, transactions]
  );

  const cycle = useMemo(
    () => (selected ? labeledCycle(selected.billing_day, cycleOffset) : null),
    [selected, cycleOffset]
  );
  const cycleTxs = useMemo(
    () => (selected && cycle ? cycleStatement(transactions, selected.id, cycle) : { txs: [], total: 0 }),
    [transactions, selected, cycle]
  );

  // Cuotas: primero las que siguen corriendo, después las terminadas.
  const sortedInstallments = useMemo(() => {
    const rows = installments.map((installment) => ({ installment, progress: installmentProgress(installment) }));
    return [...rows.filter((r) => r.progress.active), ...rows.filter((r) => !r.progress.active)];
  }, [installments]);
  const monthlyPayment = sortedInstallments
    .filter((r) => r.progress.active)
    .reduce((sum, r) => sum + r.installment.installment_amount, 0);
  const hasActiveInstallments = monthlyPayment > 0;

  // En celular, cuotas y estado de cuenta comparten el panel. Sin cuotas activas, parte en el estado de cuenta.
  const [mobileTab, setMobileTab] = useState<"cuotas" | "cuenta" | null>(null);
  const tab = mobileTab ?? (hasActiveInstallments ? "cuotas" : "cuenta");

  const openNewCard = () => {
    setEditingCard(null);
    setCardModalOpen(true);
  };
  const openEditCard = (id: string) => {
    const full = creditCards.find((c) => c.id === id);
    if (!full) return;
    setEditingCard(full);
    setCardModalOpen(true);
  };
  const openInstallmentModal = (installment: InstallmentPurchase | null) => {
    setEditingInstallment(installment);
    setInstallmentModalOpen(true);
  };
  const askDelete = (kind: "card" | "installment", id: string) => {
    setToDelete({ kind, id });
    setDeleteOpen(true);
  };

  const handleSaveCard = async (card: Omit<CreditCard, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (editingCard) await updateCreditCard.mutateAsync({ id: editingCard.id, ...card });
    else await addCreditCard.mutateAsync(card);
    setEditingCard(null);
  };

  const handleSaveInstallment = async (
    purchase: Omit<InstallmentPurchase, "id" | "user_id" | "created_at" | "updated_at" | "card_name" | "card_color">
  ) => {
    if (editingInstallment) await updateInstallment.mutateAsync({ id: editingInstallment.id, ...purchase });
    else await addInstallment.mutateAsync(purchase);
    setEditingInstallment(null);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    if (toDelete.kind === "card") {
      await deleteCreditCard.mutateAsync(toDelete.id);
      if (selectedId === toDelete.id) setSelectedId(null);
    } else {
      await deleteInstallment.mutateAsync(toDelete.id);
    }
  };

  return (
    <Layout fit>
      <div className="tj">
        <header className="tj-head">
          <h1 className="tj-title">Tarjetas</h1>
        </header>

        {loading ? (
          <div className="tj-grid">
            <div className="tj-wallet">
              <Skeleton className="tj-plastic" />
              <Skeleton className="tj-plastic" />
            </div>
            <Skeleton className="tj-card tj-cuotas" />
            <Skeleton className="tj-card tj-cuenta" />
          </div>
        ) : !hasCards ? (
          <section className="tj-card tj-setup">
            <h2>Tu primera tarjeta</h2>
            <p>Verás cuánto llevas en el ciclo, cuándo cierra y cuándo pagas.</p>
            <button className="tj-btn tj-btn-primary" onClick={openNewCard}>
              <Plus /> Agregar tarjeta
            </button>
          </section>
        ) : (
          <div className="tj-grid" data-tab={tab}>
            {/* Los plásticos */}
            <section className="tj-wallet" aria-label="Mis tarjetas">
              {cardSummaries.map((card) => (
                <Plastic
                  key={card.id}
                  card={card}
                  cycle={cardCycles.get(card.id)!}
                  selected={cardSummaries.length > 1 && card.id === selected?.id}
                  isPrivacyMode={isPrivacyMode}
                  onSelect={() => {
                    setSelectedId(card.id);
                    setCycleOffset(0);
                  }}
                  onEdit={() => openEditCard(card.id)}
                  onDelete={() => askDelete("card", card.id)}
                />
              ))}
              <button className="tj-plastic tj-plastic-new" onClick={openNewCard}>
                <Plus /> Tarjeta
              </button>
            </section>

            {/* Solo en celular: qué panel se ve */}
            <div className="tj-tabs" role="tablist">
              <button className="tj-tab" role="tab" aria-selected={tab === "cuotas"} onClick={() => setMobileTab("cuotas")}>
                Cuotas
              </button>
              <button className="tj-tab" role="tab" aria-selected={tab === "cuenta"} onClick={() => setMobileTab("cuenta")}>
                Estado de cuenta
              </button>
            </div>

            {/* Compras en cuotas */}
            <section className="tj-card tj-cuotas">
              <div className="tj-card-head">
                <span className="tj-label">
                  Cuotas
                  {hasActiveInstallments && (
                    <small className={cn(isPrivacyMode && "privacy-blur")}>
                      {" "}· {formatCurrency(monthlyPayment)} al mes
                    </small>
                  )}
                </span>
                <button className="tj-btn" onClick={() => openInstallmentModal(null)}>
                  <Plus /> Compra
                </button>
              </div>
              <div className="tj-list" data-scrollable>
                {sortedInstallments.length === 0 ? (
                  <p className="tj-empty">Ninguna compra en cuotas.</p>
                ) : (
                  sortedInstallments.map(({ installment: inst, progress }) => (
                    <InstallmentRow
                      key={inst.id}
                      installment={inst}
                      progress={progress}
                      open={openInstallment === inst.id}
                      isPrivacyMode={isPrivacyMode}
                      onToggle={() => setOpenInstallment(openInstallment === inst.id ? null : inst.id)}
                      onEdit={() => openInstallmentModal(inst)}
                      onDelete={() => askDelete("installment", inst.id)}
                    />
                  ))
                )}
              </div>
            </section>

            {/* Estado de cuenta de la tarjeta elegida */}
            <section className="tj-card tj-cuenta">
              <div className="tj-card-head">
                <span className="tj-label">
                  Estado de cuenta
                  {selected && cardSummaries.length > 1 && <small> · {selected.name}</small>}
                </span>
                <span className="tj-stepper">
                  <button onClick={() => setCycleOffset(cycleOffset - 1)} aria-label="Ciclo anterior">
                    <ChevronLeft />
                  </button>
                  <span className="label">{cycle?.label ?? "—"}</span>
                  <button onClick={() => setCycleOffset(cycleOffset + 1)} disabled={cycleOffset >= 0} aria-label="Ciclo siguiente">
                    <ChevronRight />
                  </button>
                </span>
              </div>
              {cycle && (
                <div className="tj-cycle">
                  <span>
                    {day(cycle.start)} → {day(cycle.end)}
                  </span>
                  <b className={cn(isPrivacyMode && "privacy-blur")}>{formatCurrency(cycleTxs.total)}</b>
                </div>
              )}
              <div className="tj-list" data-scrollable>
                {cycleTxs.txs.length === 0 ? (
                  <p className="tj-empty">Sin movimientos en este ciclo.</p>
                ) : (
                  cycleTxs.txs.map((tx) => {
                    // Un pago (de cualquier lado) se ve como abono: no suma al total.
                    const credit = tx.type === "Ingreso" || isCardPayment(tx);
                    return (
                      <div key={tx.id} className="tj-tx" data-in={credit || undefined}>
                        <span className="d">{format(new Date(tx.date), "dd/MM")}</span>
                        <span className={cn("n", isPrivacyMode && "privacy-blur")}>{tx.detail || tx.category_name}</span>
                        <span className={cn("v", isPrivacyMode && "privacy-blur")}>
                          {credit ? "+" : ""}
                          {formatCurrency(Number(tx.amount))}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      <CreditCardModal
        open={cardModalOpen}
        onOpenChange={(open) => {
          setCardModalOpen(open);
          if (!open) setEditingCard(null);
        }}
        card={editingCard}
        onSave={handleSaveCard}
      />

      <InstallmentModal
        open={installmentModalOpen}
        onOpenChange={(open) => {
          setInstallmentModalOpen(open);
          if (!open) setEditingInstallment(null);
        }}
        installment={editingInstallment}
        creditCards={creditCards}
        onSave={handleSaveInstallment}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={toDelete?.kind === "card" ? "¿Eliminar tarjeta?" : "¿Eliminar compra?"}
        description={
          toDelete?.kind === "card"
            ? "Se eliminarán también todas las compras en cuotas asociadas. Esta acción no se puede deshacer."
            : "Se eliminará el registro y todas las cuotas en Movimientos. Esta acción no se puede deshacer."
        }
        confirmText="Eliminar"
        onConfirm={handleDelete}
      />
    </Layout>
  );
}

// ─── El plástico ─────────────────────────────────────────────────────────
function Plastic({
  card,
  cycle,
  selected,
  isPrivacyMode,
  onSelect,
  onEdit,
  onDelete,
}: {
  card: CreditCardSummary;
  cycle: CardStatus;
  selected: boolean;
  isPrivacyMode: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="tj-plastic"
      data-selected={selected || undefined}
      style={{ "--tj-c": card.color || "var(--tj-fallback)" } as CSSProperties}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      aria-label={`${card.name}, por facturar ${formatCurrency(cycle.porFacturar)}${
        cycle.showAPagar ? `, a pagar ${formatCurrency(cycle.aPagar)} el ${day(cycle.payDate)}` : ""
      }`}
    >
      <div className="tj-pl-top">
        <span className="tj-pl-name">{card.name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="tj-pl-menu" aria-label={`Opciones de ${card.name}`} onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="tj-pl-mid">
        <span className="tj-pl-label">por facturar</span>
        <span className={cn("tj-pl-big", isPrivacyMode && "privacy-blur")}>{formatCurrency(cycle.porFacturar)}</span>
        <span className="tj-pl-of">
          <span>cierra el {day(cycle.closes)}</span>
          {cycle.showAPagar ? (
            <span>
              a pagar <b className={cn(isPrivacyMode && "privacy-blur")}>{formatCurrency(cycle.aPagar)}</b> el {day(cycle.payDate)}
            </span>
          ) : (
            <span>pagas el {day(cycle.nextPay)}</span>
          )}
        </span>
      </div>

      <div className="tj-pl-bot">
        <span className={cn(isPrivacyMode && "privacy-blur")}>disponible {formatCurrency(card.available_credit)}</span>
        <span>{card.last_4_digits ? `···· ${card.last_4_digits}` : ""}</span>
      </div>
    </div>
  );
}

// ─── Una compra en cuotas ─────────────────────────────────────────────────
function InstallmentRow({
  installment,
  progress: { billed, left, last, active },
  open,
  isPrivacyMode,
  onToggle,
  onEdit,
  onDelete,
}: {
  installment: InstallmentPurchase;
  progress: ReturnType<typeof installmentProgress>;
  open: boolean;
  isPrivacyMode: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const total = installment.total_installments;
  const done = !active;

  return (
    <div className="tj-inst" data-done={done || undefined} data-open={open || undefined}>
      <button className="tj-inst-main" onClick={onToggle} aria-expanded={open}>
        <i className="tj-dot" style={{ background: installment.card_color || "var(--tj-fallback)" }} aria-hidden />
        <span className="n">
          {installment.description}
          {installment.card_name && <small>{installment.card_name}</small>}
        </span>
        <span className={cn("v", isPrivacyMode && "privacy-blur")}>
          {formatCurrency(installment.installment_amount)}
          <small>/mes</small>
        </span>
        <span className="row2">
          <span className="tj-inst-track">
            <i style={{ width: `${(billed / total) * 100}%` }} />
          </span>
          <span className="k">{done ? "terminada" : `quedan ${left} de ${total}`}</span>
        </span>
      </button>

      {open && (
        <div className="tj-inst-detail">
          <p className={cn("tj-inst-meta", isPrivacyMode && "privacy-blur")}>
            <span>total {formatCurrency(installment.total_amount)}</span>
            {!done && <span>quedan {formatCurrency(left * installment.installment_amount)}</span>}
            <span>última {format(last, "MMM yyyy", { locale: es }).replace(".", "")}</span>
          </p>
          <div className="tj-inst-actions">
            <button className="tj-btn" onClick={onEdit}>
              <Pencil /> Editar
            </button>
            <button className="tj-btn tj-btn-danger" onClick={onDelete}>
              <Trash2 /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
