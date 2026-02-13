-- ========================================
-- SECURITY FIX: RLS para credit_cards, installment_purchases, card_transactions, shared_expenses
-- + Agregar installment_id a transactions para vínculo seguro
-- ========================================
-- IMPORTANTE: Correr este SQL en Supabase SQL Editor
-- Es idempotente (puedes correrlo múltiples veces)
-- ========================================

-- =====================
-- 1. RLS: credit_cards
-- =====================
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own credit cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Users can insert their own credit cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Users can update their own credit cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Users can delete their own credit cards" ON public.credit_cards;

CREATE POLICY "Users can view their own credit cards"
  ON public.credit_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit cards"
  ON public.credit_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credit cards"
  ON public.credit_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credit cards"
  ON public.credit_cards FOR DELETE
  USING (auth.uid() = user_id);

-- ============================
-- 2. RLS: installment_purchases
-- ============================
ALTER TABLE public.installment_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own installment purchases" ON public.installment_purchases;
DROP POLICY IF EXISTS "Users can insert their own installment purchases" ON public.installment_purchases;
DROP POLICY IF EXISTS "Users can update their own installment purchases" ON public.installment_purchases;
DROP POLICY IF EXISTS "Users can delete their own installment purchases" ON public.installment_purchases;

CREATE POLICY "Users can view their own installment purchases"
  ON public.installment_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own installment purchases"
  ON public.installment_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own installment purchases"
  ON public.installment_purchases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own installment purchases"
  ON public.installment_purchases FOR DELETE
  USING (auth.uid() = user_id);

-- ============================
-- 3. RLS: card_transactions
-- ============================
ALTER TABLE public.card_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own card transactions" ON public.card_transactions;
DROP POLICY IF EXISTS "Users can insert their own card transactions" ON public.card_transactions;
DROP POLICY IF EXISTS "Users can update their own card transactions" ON public.card_transactions;
DROP POLICY IF EXISTS "Users can delete their own card transactions" ON public.card_transactions;

CREATE POLICY "Users can view their own card transactions"
  ON public.card_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own card transactions"
  ON public.card_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own card transactions"
  ON public.card_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own card transactions"
  ON public.card_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================
-- 4. RLS: shared_expenses
-- ============================
ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own shared expenses" ON public.shared_expenses;
DROP POLICY IF EXISTS "Users can insert their own shared expenses" ON public.shared_expenses;
DROP POLICY IF EXISTS "Users can update their own shared expenses" ON public.shared_expenses;
DROP POLICY IF EXISTS "Users can delete their own shared expenses" ON public.shared_expenses;

CREATE POLICY "Users can view their own shared expenses"
  ON public.shared_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shared expenses"
  ON public.shared_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shared expenses"
  ON public.shared_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shared expenses"
  ON public.shared_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- ============================
-- 5. Agregar installment_id a transactions
-- ============================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS installment_id UUID REFERENCES public.installment_purchases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_installment_id ON public.transactions(installment_id);

-- ============================
-- 6. Indexes de performance
-- ============================
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON public.credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_installment_purchases_user_id ON public.installment_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_installment_purchases_card_id ON public.installment_purchases(card_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_user_id ON public.card_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_card_id ON public.card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_user_id ON public.shared_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_id ON public.transactions(card_id);
