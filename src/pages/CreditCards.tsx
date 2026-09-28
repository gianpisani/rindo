import { useMemo, useState, type CSSProperties } from "react";
import { addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreditCards, type CreditCard, type CreditCardSummary } from "@/hooks/useCreditCards";
import { useInstallments, type InstallmentPurchase } from "@/hooks/useInstallments";
import { useTransactions } from "@/hooks/useTransactions";
import { CreditCardModal } from "@/components/CreditCardModal";
import { InstallmentModal } from "@/components/InstallmentModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";

/**
 * Tarjetas: ¿cuánto cupo llevo usado y qué me toca pagar? Una pantalla
 * exacta, como Meta y Finanzas. Arriba las tarjetas dibujadas como
 * plásticos, cada una con su cupo. Abajo dos paneles: las compras en cuotas
 * y el estado de cuenta de la tarjeta elegida, ciclo por ciclo. Lo largo
 * scrollea adentro de su panel, nunca la página.
 */

// Banco de Chile: el ciclo corre de 14:00 a 14:00 del día de cierre.
const BILLING_CUTOFF_HOUR = 14;
const HOT_USAGE = 80;

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);

const day = (d: Date) => format(d, "d MMM", { locale: es }).replace(".", "");

function getBillingCycle(billingDay: number, cycleOffset: number = 0) {
  const now = new Date();
  const billingDateThisMonth = new Date(now.getFullYear(), now.getMonth(), billingDay, BILLING_CUTOFF_HOUR, 0, 0);

  let cycleEndDate = now < billingDateThisMonth ? billingDateThisMonth : addMonths(billingDateThisMonth, 1);
  cycleEndDate = addMonths(cycleEndDate, cycleOffset);
  const cycleStartDate = addMonths(cycleEndDate, -1);

  return {
    start: cycleStartDate,
    end: cycleEndDate,
    isClosed: cycleEndDate <= now,
    label: format(cycleEndDate, "MMMM yyyy", { locale: es }),
  };
}

const usageOf = (card: CreditCardSummary) =>
  card.credit_limit > 0 ? Math.min(100, (card.total_used_credit / card.credit_limit) * 100) : 0;

export default function CreditCards() {
  const { isPrivacyMode } = usePrivacyMode();
  const {
    creditCards,
    cardSummaries,
    isLoading: isLoadingCards,
    totals: cardTotals,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
  } = useCreditCards();
  const {
    installments,
    isLoading: isLoadingInstallments,
    totals: installmentTotals,
    addInstallment,
    updateInstallment,
    deleteInstallment,
    getInstallmentSchedule,
    isInstallmentActive,
  } = useInstallments();
  const { transactions } = useTransactions();

  const loading = isLoadingCards || isLoadingInstallments;
  const hasCards = cardSummaries.length > 0;

  // ── Modales ──
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [installmentModalOpen, setInstallmentModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<InstallmentPurchase | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [deleteInstallmentId, setDeleteInstallmentId] = useState<string | null>(null);
  const [openInstallment, setOpenInstallment] = useState<string | null>(null);

  // ── La tarjeta elegida manda el estado de cuenta ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cycleOffset, setCycleOffset] = useState(0);
  const selected = cardSummaries.find((c) => c.id === selectedId) ?? cardSummaries[0];

  const cycle = useMemo(
    () => (selected ? getBillingCycle(selected.billing_day, cycleOffset) : null),
    [selected, cycleOffset]
  );

  const cycleTx = useMemo(() => {
    if (!selected || !cycle) return [];
    return transactions
      .filter((t) => {
        if (t.card_id !== selected.id) return false;
        const at = new Date(t.date).getTime();
        return at >= cycle.start.getTime() && at < cycle.end.getTime();
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selected, cycle]);

  const cycleTotals = useMemo(
    () =>
      cycleTx.reduce(
        (acc, t) => {
          if (t.type === "Gasto") acc.gastos += Number(t.amount);
          else if (t.type === "Ingreso") acc.abonos += Number(t.amount);
          return acc;
        },
        { gastos: 0, abonos: 0 }
      ),
    [cycleTx]
  );

  // Cuotas: primero las que siguen corriendo, después las terminadas.
  const sortedInstallments = useMemo(() => {
    const active = installments.filter(isInstallmentActive);
    const done = installments.filter((i) => !isInstallmentActive(i));
    return [...active, ...done];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installments]);
  const activeCount = installments.filter(isInstallmentActive).length;

  const totalUsage = cardTotals.totalLimit > 0 ? (cardTotals.totalUsed / cardTotals.totalLimit) * 100 : 0;

  // En celular, cuotas y estado de cuenta comparten el panel.
  const [mobileTab, setMobileTab] = useState<"cuotas" | "cuenta">("cuotas");

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
  const openNewInstallment = () => {
    setEditingInstallment(null);
    setInstallmentModalOpen(true);
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

  const handleDeleteCard = async () => {
    if (!deleteCardId) return;
    await deleteCreditCard.mutateAsync(deleteCardId);
    if (selectedId === deleteCardId) setSelectedId(null);
    setDeleteCardId(null);
  };

  const handleDeleteInstallment = async () => {
    if (!deleteInstallmentId) return;
    await deleteInstallment.mutateAsync(deleteInstallmentId);
    setDeleteInstallmentId(null);
  };

  return (
    <Layout fit>
      <div className="tj">
        <header className="tj-head">
          <h1 className="tj-title">Tarjetas</h1>
          {loading ? (
            <Skeleton className="h-5 w-64" />
          ) : hasCards ? (
            <p className={cn("tj-totals", isPrivacyMode && "privacy-blur")}>
              <span>
                usado <b data-hot={totalUsage > HOT_USAGE || undefined}>{formatCurrency(cardTotals.totalUsed)}</b> de{" "}
                {formatCurrency(cardTotals.totalLimit)}
              </span>
              <span className="tj-sep" aria-hidden>·</span>
              <span>
                cuotas <b>{formatCurrency(installmentTotals.monthlyPayment)}</b> al mes
              </span>
            </p>
          ) : null}
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
            <p>Con la tarjeta acá ves el cupo que llevas usado, las compras en cuotas y el estado de cuenta de cada ciclo.</p>
            <button className="tj-btn tj-btn-primary" onClick={openNewCard}>
              <Plus /> Agregar tarjeta
            </button>
          </section>
        ) : (
          <div className="tj-grid" data-tab={mobileTab}>
            {/* Los plásticos */}
            <section className="tj-wallet" aria-label="Mis tarjetas">
              {cardSummaries.map((card) => (
                <Plastic
                  key={card.id}
                  card={card}
                  selected={cardSummaries.length > 1 && card.id === selected?.id}
                  isPrivacyMode={isPrivacyMode}
                  onSelect={() => {
                    setSelectedId(card.id);
                    setCycleOffset(0);
                  }}
                  onEdit={() => openEditCard(card.id)}
                  onDelete={() => setDeleteCardId(card.id)}
                  onNewInstallment={openNewInstallment}
                />
              ))}
              <button className="tj-plastic tj-plastic-new" onClick={openNewCard}>
                <Plus /> Tarjeta
              </button>
            </section>

            {/* Solo en celular: qué panel se ve */}
            <div className="tj-tabs" role="tablist">
              <button className="tj-tab" role="tab" aria-selected={mobileTab === "cuotas"} onClick={() => setMobileTab("cuotas")}>
                Cuotas
              </button>
              <button className="tj-tab" role="tab" aria-selected={mobileTab === "cuenta"} onClick={() => setMobileTab("cuenta")}>
                Estado de cuenta
              </button>
            </div>

            {/* Compras en cuotas */}
            <section className="tj-card tj-cuotas">
              <div className="tj-card-head">
                <span className="tj-label">
                  Cuotas
                  {activeCount > 0 && (
                    <small>
                      {" "}· {activeCount} activa{activeCount !== 1 ? "s" : ""}
                    </small>
                  )}
                </span>
                <button className="tj-btn" onClick={openNewInstallment}>
                  <Plus /> Compra
                </button>
              </div>
              <div className="tj-list" data-scrollable>
                {sortedInstallments.length === 0 ? (
                  <p className="tj-empty">Ninguna compra en cuotas. Cuando compres algo en cuotas, anótala acá y las verás mes a mes.</p>
                ) : (
                  sortedInstallments.map((inst, index) => (
                    <InstallmentRow
                      key={inst.id}
                      installment={inst}
                      index={index}
                      open={openInstallment === inst.id}
                      done={!isInstallmentActive(inst)}
                      isPrivacyMode={isPrivacyMode}
                      schedule={getInstallmentSchedule(inst)}
                      onToggle={() => setOpenInstallment(openInstallment === inst.id ? null : inst.id)}
                      onEdit={() => {
                        setEditingInstallment(inst);
                        setInstallmentModalOpen(true);
                      }}
                      onDelete={() => setDeleteInstallmentId(inst.id)}
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
              {cycle && selected && (
                <div className="tj-cycle">
                  <span>
                    {day(cycle.start)} → {day(cycle.end)}
                  </span>
                  <span className="tj-pill" data-open={!cycle.isClosed || undefined}>
                    {cycle.isClosed ? "facturado" : "por facturar"}
                  </span>
                  <span className="tj-cycle-pay">pago día {selected.payment_day}</span>
                  <b className={cn(isPrivacyMode && "privacy-blur")}>{formatCurrency(cycleTotals.gastos - cycleTotals.abonos)}</b>
                </div>
              )}
              <div className="tj-list" data-scrollable>
                {cycleTx.length === 0 ? (
                  <p className="tj-empty">Sin movimientos en este ciclo.</p>
                ) : (
                  cycleTx.map((tx) => (
                    <div key={tx.id} className="tj-tx" data-in={tx.type === "Ingreso" || undefined}>
                      <span className="d">{format(new Date(tx.date), "dd/MM")}</span>
                      <span className={cn("n", isPrivacyMode && "privacy-blur")}>{tx.detail || tx.category_name}</span>
                      <span className={cn("v", isPrivacyMode && "privacy-blur")}>
                        {tx.type === "Ingreso" ? "+" : ""}
                        {formatCurrency(Number(tx.amount))}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {cycleTotals.abonos > 0 && (
                <div className={cn("tj-foot", isPrivacyMode && "privacy-blur")}>
                  <span>
                    cargos <b>{formatCurrency(cycleTotals.gastos)}</b>
                  </span>
                  <span>
                    abonos <b className="in">{formatCurrency(cycleTotals.abonos)}</b>
                  </span>
                </div>
              )}
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
        open={!!deleteCardId}
        onOpenChange={() => setDeleteCardId(null)}
        title="¿Eliminar tarjeta?"
        description="Se eliminarán también todas las compras en cuotas asociadas. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={handleDeleteCard}
        variant="destructive"
      />

      <ConfirmDialog
        open={!!deleteInstallmentId}
        onOpenChange={() => setDeleteInstallmentId(null)}
        title="¿Eliminar compra?"
        description="Se eliminará el registro y todas las cuotas en Movimientos. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={handleDeleteInstallment}
        variant="destructive"
      />
    </Layout>
  );
}

// ─── El plástico ─────────────────────────────────────────────────────────
function Plastic({
  card,
  selected,
  isPrivacyMode,
  onSelect,
  onEdit,
  onDelete,
  onNewInstallment,
}: {
  card: CreditCardSummary;
  selected: boolean;
  isPrivacyMode: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewInstallment: () => void;
}) {
  const usage = usageOf(card);
  return (
    <div
      role="button"
      tabIndex={0}
      className="tj-plastic"
      data-selected={selected || undefined}
      data-hot={usage > HOT_USAGE || undefined}
      style={{ "--tj-c": card.color || "var(--tj-fallback)" } as CSSProperties}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      aria-label={`${card.name}, ${Math.round(usage)}% del cupo usado`}
    >
      <div className="tj-pl-top">
        <span className="tj-chip" aria-hidden />
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
            <DropdownMenuItem onClick={onNewInstallment}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva compra
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="tj-pl-mid">
        <span className="tj-pl-label">usado</span>
        <span className={cn("tj-pl-big", isPrivacyMode && "privacy-blur")}>{formatCurrency(card.total_used_credit)}</span>
        <span className={cn("tj-pl-of", isPrivacyMode && "privacy-blur")}>
          <span>disponible {formatCurrency(card.available_credit)}</span>
          <span className="tj-pl-pct">{Math.round(usage)}%</span>
        </span>
      </div>
      <div className="tj-pl-track" aria-hidden>
        <i style={{ width: `${Math.max(usage, card.total_used_credit > 0 ? 1.5 : 0)}%` }} />
      </div>

      <div className="tj-pl-bot">
        <span className="tj-pl-name">{card.name}</span>
        <span className="tj-pl-digits">{card.last_4_digits ? `···· ${card.last_4_digits}` : ""}</span>
      </div>
    </div>
  );
}

// ─── Una compra en cuotas ─────────────────────────────────────────────────
type ScheduleItem = ReturnType<ReturnType<typeof useInstallments>["getInstallmentSchedule"]>[number];

function InstallmentRow({
  installment,
  index,
  open,
  done,
  isPrivacyMode,
  schedule,
  onToggle,
  onEdit,
  onDelete,
}: {
  installment: InstallmentPurchase;
  index: number;
  open: boolean;
  done: boolean;
  isPrivacyMode: boolean;
  schedule: ScheduleItem[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const today = new Date();
  const billed = schedule.filter((s) => s.date <= today).length;
  const total = installment.total_installments;
  const progress = (billed / total) * 100;
  const remaining = (total - billed) * installment.installment_amount;
  const next = schedule.find((s) => s.date > today);

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
            <i style={{ width: `${progress}%`, "--i": index } as CSSProperties} />
          </span>
          <span className={cn("k", isPrivacyMode && "privacy-blur")}>
            {billed} de {total}
            {!done && next && ` · ${day(next.date)}`}
          </span>
        </span>
      </button>

      {open && (
        <div className="tj-inst-detail">
          <p className={cn("tj-inst-meta", isPrivacyMode && "privacy-blur")}>
            <span>{installment.category_name || "Sin categoría"}</span>
            <span>total {formatCurrency(installment.total_amount)}</span>
            {done ? <span>terminada</span> : <span>quedan {formatCurrency(remaining)}</span>}
          </p>
          <div className="tj-sched" aria-label="Calendario de cuotas">
            {schedule.map((s) => (
              <span key={s.number} data-billed={s.date <= today || undefined} data-next={next?.number === s.number || undefined}>
                <b>{s.number}</b> {format(s.date, "MMM yy", { locale: es }).replace(".", "")}
              </span>
            ))}
          </div>
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
