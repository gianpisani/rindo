import { useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, Check, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useSharedExpenses } from '@/hooks/useSharedExpenses';
import { useGlobalDrawers } from '@/hooks/useGlobalDrawers';
import { useSoundFX } from '@/hooks/useSoundFX';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { categoryFrequency, parseWhisper, type WhisperDraft } from '@/lib/whisper';
import type { TransactionType } from '@/lib/ledger';
import { cn } from '@/lib/utils';
import SharedExpenseDrawer from './SharedExpenseDrawer';
import './whisper.css';

const types: { type: TransactionType; color: string; placeholder: string }[] = [
  { type: 'Gasto', color: '#f87171', placeholder: '15000 almuerzo' },
  { type: 'Ingreso', color: '#4ade80', placeholder: '1500000 sueldo' },
  { type: 'Inversión', color: '#60a5fa', placeholder: '200000 fintual' },
  { type: 'Rescate', color: '#22d3ee', placeholder: '200000 retiro del fondo' },
  { type: 'Rendimiento', color: '#a78bfa', placeholder: '25000 rendimiento del mes' },
  { type: 'Reembolso', color: '#fbbf24', placeholder: '12000 devolución almuerzo' },
];
const foodCategoryOrder = ['Supermercado', 'Café y snacks', 'Comida diaria', 'Comidas y panoramas'];
const fixedCategories: Partial<Record<TransactionType, string>> = { Rescate: 'Rescate', Rendimiento: 'Rendimiento', Reembolso: 'Reembolsos' };
const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

interface WhisperInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: TransactionType;
  initialDraft?: WhisperDraft;
}

export function WhisperInput({ open, onOpenChange, defaultType = 'Gasto', initialDraft }: WhisperInputProps) {
  const [draft, setDraft] = useState<WhisperDraft>(() => initialDraft ?? {
    value: '', type: defaultType, category: '', date: localDate(), cardId: '', shared: false, reimbursementCategory: '', isLoss: false,
  });
  // The picker only has minute precision; untouched, the save takes the exact moment.
  const [dateTouched, setDateTouched] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const [error, setError] = useState('');
  const pendingShared = useGlobalDrawers(state => state.pendingShared);
  const setPendingShared = useGlobalDrawers(state => state.setPendingShared);
  const saving = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryGroupRef = useRef<HTMLDivElement>(null);
  const optionsToggleRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const { categories } = useCategories();
  const { allTransactions, addTransaction } = useTransactions();
  const { creditCards } = useCreditCards();
  const { addSharedExpenses, uniqueDebtorNames } = useSharedExpenses();
  const { isPrivacyMode } = usePrivacyMode();
  const { playTap } = useSoundFX();
  const current = types.find(t => t.type === draft.type)!;
  const parsed = parseWhisper(draft.value);
  const fixedCategory = fixedCategories[draft.type];
  const availableCategories = useMemo(() => {
    const frequency = categoryFrequency(allTransactions, draft.type);
    return categories.filter(c => c.is_active !== false && c.type === draft.type && !['Sin categoría', '⚡ Analizando...'].includes(c.name))
      .sort((a, b) => {
        const foodRank = (name: string) => draft.type === 'Gasto' && foodCategoryOrder.includes(name) ? foodCategoryOrder.indexOf(name) : foodCategoryOrder.length;
        return foodRank(a.name) - foodRank(b.name) || (frequency.get(b.name) ?? 0) - (frequency.get(a.name) ?? 0) || a.name.localeCompare(b.name);
      });
  }, [categories, allTransactions, draft.type]);
  const visibleCategories = allCategories ? availableCategories : availableCategories.slice(0, 5);
  const update = (values: Partial<WhisperDraft>) => { setDraft(previous => ({ ...previous, ...values })); setError(''); };
  const changeType = (type: TransactionType) => {
    update({ type, category: '', shared: false, reimbursementCategory: '', isLoss: false });
    setAllCategories(false);
  };
  const cycleType = (backwards: boolean) => {
    changeType(types[(types.indexOf(current) + (backwards ? types.length - 1 : 1)) % types.length].type);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving.current) return;
    if (!parsed) { setError('Escribe un monto en pesos, seguido del detalle.'); inputRef.current?.focus(); return; }
    if (!draft.date || !Number.isFinite(new Date(draft.date).getTime())) { setExpanded(true); setError('Elige una fecha válida.'); return; }
    saving.current = true;
    const submittedDraft = { ...draft };
    // The composer closes immediately; the shared mutation owns saving and categorizing.
    onOpenChange(false);
    try {
      const transaction = await addTransaction.mutateAsync({
        amount: draft.type === 'Rendimiento' && draft.isLoss ? -parsed.amount : parsed.amount,
        type: draft.type, detail: parsed.detail, category_name: fixedCategory ?? draft.category,
        date: (dateTouched ? new Date(draft.date) : new Date()).toISOString(), card_id: draft.cardId || null,
        reimbursement_for_category: ['Ingreso', 'Reembolso'].includes(draft.type) ? draft.reimbursementCategory || null : null,
      });
      if (draft.shared && draft.type === 'Gasto') setPendingShared({ id: transaction.id, amount: parsed.amount });
    } catch {
      const recover = () => useGlobalDrawers.getState().openQuickAdd(submittedDraft.type, submittedDraft);
      if (!useGlobalDrawers.getState().quickAddOpen) recover();
      toast.error('No se guardó el movimiento. Tu texto está disponible.', {
        id: 'transaction-save-error', action: { label: 'Recuperar', onClick: recover },
      });
    } finally { saving.current = false; }
  };

  const confirmShared = async (debtors: { name: string; amount: number }[]) => {
    if (!pendingShared) return;
    await addSharedExpenses.mutateAsync(debtors.map(d => ({
      transaction_id: pendingShared.id, debtor_name: d.name, amount_owed: d.amount, detail: null,
    })));
    setPendingShared(null);
  };

  return <>
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content data-scrollable className="whisper-composer" style={{ '--whisper-accent': current.color } as React.CSSProperties}
          onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus(); }}>
          <Dialog.Title className="sr-only">Nuevo movimiento</Dialog.Title>
          <Dialog.Description className="sr-only">Escribe monto y detalle en una línea. Tab cambia el tipo; Shift y Tab vuelve al anterior. Flecha abajo lleva a las categorías y opciones, donde Tab recorre los controles. Puedes elegir una categoría o dejar que se asigne al guardar.</Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar"><X size={16} /></Dialog.Close>
          <form onSubmit={submit} className="whisper-form">
            <div className="whisper-type">
              <span className="whisper-dot" aria-hidden="true" />
              <motion.span key={draft.type} aria-hidden="true" initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>{draft.type}</motion.span>
              <select aria-label="Tipo de movimiento" value={draft.type} onChange={event => {
                changeType(event.target.value as TransactionType); inputRef.current?.focus();
              }}>
                {types.map(t => <option key={t.type}>{t.type}</option>)}
              </select>
              <ChevronDown size={12} aria-hidden="true" />
            </div>
            <div className="whisper-entry">
            <input ref={inputRef} aria-label="Monto y detalle" aria-describedby={error ? 'whisper-error whisper-shortcuts' : 'whisper-shortcuts'}
              aria-invalid={!!error} autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={1000}
              value={draft.value} onChange={event => update({ value: event.target.value })}
              placeholder={current.placeholder} className={cn('whisper-input', isPrivacyMode && draft.value && 'privacy-blur')}
              onKeyDown={event => {
                if (event.nativeEvent.isComposing) {
                  if (event.key === 'Enter') event.preventDefault();
                  return;
                }
                // Keep Whisper's original Tab gesture; Down opens the normal focus order.
                if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
                  event.preventDefault(); cycleType(event.shiftKey); return;
                }
                if (event.key === 'ArrowDown' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                  event.preventDefault();
                  const selected = categoryGroupRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
                  const first = categoryGroupRef.current?.querySelector<HTMLButtonElement>('button');
                  (selected ?? first ?? optionsToggleRef.current)?.focus();
                  return;
                }
                if (event.altKey && ['ArrowRight', 'ArrowLeft'].includes(event.key)) {
                  event.preventDefault(); cycleType(event.key === 'ArrowLeft');
                }
              }} />
              <div className={cn('whisper-preview', isPrivacyMode && parsed && 'privacy-blur')} aria-hidden="true">
                {parsed && <span>{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(parsed.amount)}</span>}
              </div>
            </div>
            <div className="whisper-category-space">
              {!fixedCategory && <div ref={categoryGroupRef} className="whisper-categories" role="group" aria-label="Categorías disponibles">
                {visibleCategories.map(category => <button key={category.id} type="button" className="whisper-category"
                  aria-pressed={draft.category === category.name} onClick={() => {
                    update({ category: draft.category === category.name ? '' : category.name }); playTap(); inputRef.current?.focus();
                  }}>
                  <span className="whisper-category-dot" aria-hidden="true" />
                  {category.name}{draft.category === category.name && <Check size={12} aria-hidden="true" />}
                </button>)}
                {availableCategories.length > 5 && <button type="button" className="whisper-more-categories" aria-expanded={allCategories}
                  onClick={() => setAllCategories(!allCategories)}>{allCategories ? 'Menos' : `+${availableCategories.length - 5}`}</button>}
              </div>}
              <p className="whisper-caption" aria-live="polite">
                {fixedCategory ? (draft.type === 'Rescate' ? 'Vuelve a tu liquidez' : draft.type === 'Rendimiento' ? 'Actualiza tu patrimonio' : 'Plata que vuelve')
                  : draft.category ? `Se guardará en ${draft.category}` : 'O deja que se categorice al guardar'}
              </p>
            </div>
            <AnimatePresence initial={false}>
              {expanded && <motion.div className="whisper-options" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
                <label>Fecha<input aria-label="Fecha del movimiento" type="datetime-local" value={draft.date} onChange={event => { setDateTouched(true); update({ date: event.target.value }); }} /></label>
                <label>Cuenta<select aria-label="Cuenta o tarjeta" value={draft.cardId} onChange={event => update({ cardId: event.target.value })}>
                  <option value="">Cuenta</option>{creditCards.filter(card => card.is_active).map(card => <option key={card.id} value={card.id}>{card.name}</option>)}
                </select></label>
                {draft.type === 'Gasto' && <label className="whisper-check"><input type="checkbox" checked={draft.shared} onChange={event => update({ shared: event.target.checked })} />Gasto compartido</label>}
                {draft.type === 'Rendimiento' && <label className="whisper-check"><input type="checkbox" checked={draft.isLoss} onChange={event => update({ isLoss: event.target.checked })} />Fue una pérdida</label>}
                {['Ingreso', 'Reembolso'].includes(draft.type) && <label>Reembolso de<select aria-label="Categoría del reembolso" value={draft.reimbursementCategory} onChange={event => update({ reimbursementCategory: event.target.value })}>
                  <option value="">Sin vincular</option>{categories.filter(c => c.type === 'Gasto').map(c => <option key={c.id}>{c.name}</option>)}
                </select></label>}
              </motion.div>}
            </AnimatePresence>
            {error && <p id="whisper-error" role="alert" className="whisper-error">{error}</p>}
            <div className="whisper-actions">
              <button ref={optionsToggleRef} type="button" className="whisper-options-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Menos opciones' : 'Más opciones'}<ChevronDown size={12} className={cn(expanded && 'rotate-180')} />
              </button>
              <button type="submit" className="whisper-submit" disabled={!parsed} aria-label="Guardar movimiento">
                Guardar<span className="hidden sm:inline" aria-hidden="true">↵</span><ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
              </button>
            </div>
            <p id="whisper-shortcuts" className="whisper-shortcuts">
              <span><kbd>Tab</kbd> tipo</span><span><kbd>↓</kbd> {fixedCategory ? 'opciones' : 'categorías'}</span><span><kbd>Esc</kbd> cerrar</span>
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <SharedExpenseDrawer open={!!pendingShared} onOpenChange={isOpen => { if (!isOpen) setPendingShared(null); }}
      totalAmount={pendingShared?.amount ?? 0} onConfirm={confirmShared} suggestions={uniqueDebtorNames('they_owe_me')} />
  </>;
}
