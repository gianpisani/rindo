-- 1. Tabla de presupuesto mensual global (un budget por usuario)
CREATE TABLE monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_budget DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget"
  ON monthly_budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget"
  ON monthly_budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget"
  ON monthly_budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget"
  ON monthly_budgets FOR DELETE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_monthly_budgets_user_id ON monthly_budgets(user_id);

-- updated_at trigger
CREATE TRIGGER set_monthly_budgets_updated_at
  BEFORE UPDATE ON monthly_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Campo de reembolso vinculado en transactions
ALTER TABLE transactions ADD COLUMN reimbursement_for_category TEXT NULL;

-- Index para queries de budget
CREATE INDEX idx_transactions_reimbursement ON transactions(reimbursement_for_category) WHERE reimbursement_for_category IS NOT NULL;
