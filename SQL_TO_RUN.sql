-- ========================================
-- CREDIT CARD SUMMARY VIEW - FIX
-- ========================================
-- El cupo usado se calcula basado en las cuotas PENDIENTES
-- (cuotas cuya fecha aún no ha pasado)
-- ========================================

DROP VIEW IF EXISTS credit_card_summary;

CREATE OR REPLACE VIEW credit_card_summary AS
WITH installment_stats AS (
  SELECT 
    ip.card_id,
    ip.user_id,
    -- Cuotas facturadas = meses desde la primera cuota hasta hoy
    -- Si la primera cuota es futura, facturadas = 0
    SUM(
      GREATEST(
        ip.total_installments - 
        LEAST(
          ip.total_installments,
          GREATEST(
            0,
            -- Meses transcurridos desde primera cuota
            (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM ip.first_installment_date::date)) * 12 +
            (EXTRACT(MONTH FROM CURRENT_DATE) - EXTRACT(MONTH FROM ip.first_installment_date::date)) + 1
          )
        ),
        0
      ) * ip.installment_amount
    ) AS remaining_debt,
    -- Cuotas del próximo mes = compras que aún tienen cuotas pendientes
    SUM(
      CASE 
        WHEN (ip.first_installment_date::date + ((ip.total_installments - 1) || ' months')::interval) >= CURRENT_DATE
        THEN ip.installment_amount 
        ELSE 0 
      END
    ) AS next_payment_installments,
    -- Compras activas = las que aún tienen cuotas sin facturar
    COUNT(
      CASE 
        WHEN (ip.first_installment_date::date + ((ip.total_installments - 1) || ' months')::interval) >= CURRENT_DATE 
        THEN 1 
      END
    ) AS active_installment_count
  FROM installment_purchases ip
  GROUP BY ip.card_id, ip.user_id
),
transaction_stats AS (
  -- Transacciones del mes actual que NO son de cuotas
  -- Gastos suman, Ingresos (reembolsos) restan
  SELECT 
    t.card_id,
    t.user_id,
    COALESCE(SUM(
      CASE 
        WHEN t.type = 'Gasto' THEN t.amount
        WHEN t.type = 'Ingreso' THEN -t.amount  -- Reembolsos restan
        ELSE 0
      END
    ), 0) AS current_month_spending
  FROM transactions t
  WHERE t.card_id IS NOT NULL
    AND t.type IN ('Gasto', 'Ingreso')
    AND t.date >= DATE_TRUNC('month', CURRENT_DATE)
    AND t.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    AND (t.detail IS NULL OR t.detail NOT LIKE '% - Cuota %')  -- Excluir cuotas
  GROUP BY t.card_id, t.user_id
)
SELECT
  cc.id AS card_id,
  cc.user_id,
  cc.name AS card_name,
  cc.credit_limit,
  cc.billing_day,
  cc.payment_day,
  cc.color,
  cc.is_active,
  COALESCE(ist.remaining_debt, 0) AS used_credit_installments,
  COALESCE(ts.current_month_spending, 0) AS used_credit_transactions,
  COALESCE(ist.remaining_debt, 0) + COALESCE(ts.current_month_spending, 0) AS total_used_credit,
  cc.credit_limit - (COALESCE(ist.remaining_debt, 0) + COALESCE(ts.current_month_spending, 0)) AS available_credit,
  -- Próximo pago = cuotas del mes + gastos directos del mes
  COALESCE(ist.next_payment_installments, 0) + COALESCE(ts.current_month_spending, 0) AS next_payment_installments,
  COALESCE(ist.active_installment_count, 0) AS active_installment_count
FROM credit_cards cc
LEFT JOIN installment_stats ist ON ist.card_id = cc.id AND ist.user_id = cc.user_id
LEFT JOIN transaction_stats ts ON ts.card_id = cc.id AND ts.user_id = cc.user_id
WHERE cc.is_active = true;

-- Grant permissions for the view
GRANT SELECT ON credit_card_summary TO authenticated;
GRANT SELECT ON credit_card_summary TO anon;

-- ========================================
-- CATEGORY INSIGHTS - SQL MIGRATION
-- ========================================
-- Esta sección es idempotente (puedes correrla múltiples veces)
-- ========================================

-- Category Limits table
CREATE TABLE IF NOT EXISTS category_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  monthly_limit DECIMAL(12, 2) NOT NULL,
  alert_at_percentage INTEGER DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_name)
);

-- Enable RLS
ALTER TABLE category_limits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own category limits" ON category_limits;
DROP POLICY IF EXISTS "Users can insert their own category limits" ON category_limits;
DROP POLICY IF EXISTS "Users can update their own category limits" ON category_limits;
DROP POLICY IF EXISTS "Users can delete their own category limits" ON category_limits;

-- RLS Policies
CREATE POLICY "Users can view their own category limits"
  ON category_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own category limits"
  ON category_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category limits"
  ON category_limits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category limits"
  ON category_limits FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_category_limits_user_id ON category_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_category_limits_user_category ON category_limits(user_id, category_name);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_category_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_category_limits_updated_at ON category_limits;
CREATE TRIGGER set_category_limits_updated_at
  BEFORE UPDATE ON category_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_category_limits_updated_at();
