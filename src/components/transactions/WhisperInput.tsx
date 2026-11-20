import { useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategoryOptions } from '@/hooks/useCategoryOptions';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useSharedExpenses } from '@/hooks/useSharedExpenses';
import { useGlobalDrawers } from '@/hooks/useGlobalDrawers';
import { useSoundFX } from '@/hooks/useSoundFX';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { useComposerSubmit } from '@/hooks/useComposerSubmit';
import { parseWhisper, WHISPER_TYPES, type WhisperDraft } from '@/lib/whisper';
import { rankFirst, reimbursementFromPick, withUnlinkedReimbursement, UNLINKED_REIMBURSEMENT } from '@/lib/category-options';
import type { TransactionType } from '@/lib/ledger';
import { cn } from '@/lib/utils';
import { toLocalInput } from '@/lib/format';
import SharedExpenseDrawer from './SharedExpenseDrawer';
import { QuickCategoryPicker } from '@/components/categories/QuickCategoryPicker';
import { WhisperComposer, WhisperShortcuts, WhisperSubmit } from '@/components/shared/whisper/WhisperComposer';
import { WhisperOptions, WhisperOptionsToggle } from '@/components/shared/whisper/WhisperOptions';

const types = WHISPER_TYPES;
const foodCategoryOrder = ['Supermercado', 'Café y snacks', 'Comida diaria', 'Comidas y panoramas'];
const fixedCategories: Partial<Record<TransactionType, string>> = { Rescate: 'Rescate', Rendimiento: 'Rendimiento', Reembolso: 'Reembolsos' };

interface WhisperInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: TransactionType;
  initialDraft?: WhisperDraft;
}

export function WhisperInput({ open, onOpenChange, defaultType = 'Gasto', initialDraft }: WhisperInputProps) {
  const [draft, setDraft] = useState<WhisperDraft>(() => initialDraft ?? {
    value: '', type: defaultType, category: '', date: toLocalInput(new Date()), cardId: '', shared: false, reimbursementCategory: '', isLoss: false,
  });
  const [dateTouched, setDateTouched] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const { error, setError, guardedSubmit } = useComposerSubmit();
  const pendingShared = useGlobalDrawers(state => state.pendingShared);
  const setPendingShared = useGlobalDrawers(state => state.setPendingShared);
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryGroupRef = useRef<HTMLDivElement>(null);
  const optionsToggleRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const categoryOptions = useCategoryOptions();
  const { addTransaction } = useTransactions();
  const { creditCards } = useCreditCards();
  const { addSharedExpenses, uniqueDebtorNames } = useSharedExpenses();
  const { isPrivacyMode } = usePrivacyMode();
  const { playTap } = useSoundFX();
  const current = types.find(t => t.type === draft.type)!;
  const parsed = parseWhisper(draft.value);
  const fixedCategory = fixedCategories[draft.type];
  const availableCategories = useMemo(
    () => draft.type === 'Gasto' ? rankFirst(categoryOptions('Gasto'), foodCategoryOrder) : categoryOptions(draft.type),
    [categoryOptions, draft.type]);
  const visibleCategories = allCategories ? availableCategories : availableCategories.slice(0, 5);
  const update = (values: Partial<WhisperDraft>) => { setDraft(previous => ({ ...previous, ...values })); setError(''); };
  const changeType = (type: TransactionType) => {
    update({ type, category: '', shared: false, reimbursementCategory: '', isLoss: false });
    setAllCategories(false);
  };
  const cycleType = (backwards: boolean) => {
    changeType(types[(types.indexOf(current) + (backwards ? types.length - 1 : 1)) % types.length].type);
  };

  const submittedDraft = { ...draft };
  const offerRecovery = () => {
    const recover = () => useGlobalDrawers.getState().openQuickAdd(submittedDraft.type, submittedDraft);
    if (!useGlobalDrawers.getState().quickAddOpen) recover();
    toast.error('No se guardó el movimiento. Tu texto está disponible.', {
      id: 'transaction-save-error', action: { label: 'Recuperar', onClick: recover },
    });
  };
  const submit = guardedSubmit(async () => {
    if (!parsed) { setError('Escribe un monto en pesos, seguido del detalle.'); inputRef.current?.focus(); return; }
    if (!draft.date || !Number.isFinite(new Date(draft.date).getTime())) { setExpanded(true); setError('Elige una fecha válida.'); return; }
    onOpenChange(false);
    const transaction = await addTransaction.mutateAsync({
      amount: draft.type === 'Rendimiento' && draft.isLoss ? -parsed.amount : parsed.amount,
      type: draft.type, detail: parsed.detail, category_name: fixedCategory ?? draft.category,
      date: (dateTouched ? new Date(draft.date) : new Date()).toISOString(), card_id: draft.cardId || null,
      reimbursement_for_category: ['Ingreso', 'Reembolso'].includes(draft.type) ? draft.reimbursementCategory || null : null,
    });
    if (draft.shared && draft.type === 'Gasto') setPendingShared({ id: transaction.id, amount: parsed.amount });
  }, offerRecovery);

  const confirmShared = async (debtors: { name: string; amount: number }[]) => {
    if (!pendingShared) return;
    await addSharedExpenses.mutateAsync(debtors.map(d => ({
      transaction_id: pendingShared.id, debtor_name: d.name, amount_owed: d.amount, detail: null,
    })));
    setPendingShared(null);
  };

  return <>
    <WhisperComposer open={open} onOpenChange={onOpenChange} title="Nuevo movimiento"
      description="Escribe monto y detalle en una línea. Tab cambia el tipo; Shift y Tab vuelve al anterior. Flecha abajo lleva a las categorías y opciones, donde Tab recorre los controles. Puedes elegir una categoría o dejar que se asigne al guardar."
      accent={current.color} focusOnOpen={() => inputRef.current?.focus()} onSubmit={submit}>
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
          {visibleCategories.map(category => <button key={category.name} type="button" className="whisper-category"
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
      <WhisperOptions open={expanded}>
        <label>Fecha<input aria-label="Fecha del movimiento" type="datetime-local" value={draft.date} onChange={event => { setDateTouched(true); update({ date: event.target.value }); }} /></label>
        <label>Cuenta<select aria-label="Cuenta o tarjeta" value={draft.cardId} onChange={event => update({ cardId: event.target.value })}>
          <option value="">Cuenta</option>{creditCards.filter(card => card.is_active).map(card => <option key={card.id} value={card.id}>{card.name}</option>)}
        </select></label>
        {draft.type === 'Gasto' && <label className="whisper-check"><input type="checkbox" checked={draft.shared} onChange={event => update({ shared: event.target.checked })} />Gasto compartido</label>}
        {draft.type === 'Rendimiento' && <label className="whisper-check"><input type="checkbox" checked={draft.isLoss} onChange={event => update({ isLoss: event.target.checked })} />Fue una pérdida</label>}
        {['Ingreso', 'Reembolso'].includes(draft.type) && <label>Reembolso de
          <QuickCategoryPicker value={draft.reimbursementCategory || UNLINKED_REIMBURSEMENT.name} title="Reembolso de"
            options={withUnlinkedReimbursement(categoryOptions('Gasto'))}
            onPick={name => update({ reimbursementCategory: reimbursementFromPick(name) ?? '' })}>
            <button type="button" className="whisper-picker" aria-label="Categoría del reembolso">
              <span>{draft.reimbursementCategory || UNLINKED_REIMBURSEMENT.name}</span><ChevronDown size={12} aria-hidden="true" />
            </button>
          </QuickCategoryPicker>
        </label>}
      </WhisperOptions>
      {error && <p id="whisper-error" role="alert" className="whisper-error">{error}</p>}
      <div className="whisper-actions">
        <WhisperOptionsToggle ref={optionsToggleRef} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
        <WhisperSubmit label="Guardar movimiento" disabled={!parsed}>Guardar</WhisperSubmit>
      </div>
      <WhisperShortcuts id="whisper-shortcuts" items={[['Tab', 'tipo'], ['↓', fixedCategory ? 'opciones' : 'categorías'], ['Esc', 'cerrar']]} />
    </WhisperComposer>
    <SharedExpenseDrawer open={!!pendingShared} onOpenChange={isOpen => { if (!isOpen) setPendingShared(null); }}
      totalAmount={pendingShared?.amount ?? 0} onConfirm={confirmShared} suggestions={uniqueDebtorNames('they_owe_me')} />
  </>;
}
