-- Fix: credit_card_summary view was leaking data across users
-- Views bypass RLS of underlying tables, so we recreate with security_invoker
DROP VIEW IF EXISTS credit_card_summary;

CREATE VIEW credit_card_summary WITH (security_invoker = true) AS
WITH installment_stats AS (
  SELECT
    ip.card_id,
    ip.user_id,
    SUM(
      GREATEST(
        ip.total_installments -
        LEAST(
          ip.total_installments,
          GREATEST(
            0,
            (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM ip.first_installment_date::date)) * 12 +
            (EXTRACT(MONTH FROM CURRENT_DATE) - EXTRACT(MONTH FROM ip.first_installment_date::date)) + 1
          )
        ),
        0
      ) * ip.installment_amount
    ) AS remaining_debt,
    SUM(
      CASE
        WHEN (ip.first_installment_date::date + ((ip.total_installments - 1) || ' months')::interval) >= CURRENT_DATE
        THEN ip.installment_amount
        ELSE 0
      END
    ) AS next_payment_installments,
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
  SELECT
    t.card_id,
    t.user_id,
    COALESCE(SUM(
      CASE
        WHEN t.type = 'Gasto' THEN t.amount
        WHEN t.type = 'Ingreso' THEN -t.amount
        ELSE 0
      END
    ), 0) AS current_month_spending
  FROM transactions t
  WHERE t.card_id IS NOT NULL
    AND t.type IN ('Gasto', 'Ingreso')
    AND t.date >= DATE_TRUNC('month', CURRENT_DATE)
    AND t.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    AND (t.detail IS NULL OR t.detail NOT LIKE '% - Cuota %')
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
  cc.last_4_digits,
  cc.is_active,
  COALESCE(ist.remaining_debt, 0) AS used_credit_installments,
  COALESCE(ts.current_month_spending, 0) AS used_credit_transactions,
  COALESCE(ist.remaining_debt, 0) + COALESCE(ts.current_month_spending, 0) AS total_used_credit,
  cc.credit_limit - (COALESCE(ist.remaining_debt, 0) + COALESCE(ts.current_month_spending, 0)) AS available_credit,
  COALESCE(ist.next_payment_installments, 0) + COALESCE(ts.current_month_spending, 0) AS next_payment_installments,
  COALESCE(ist.active_installment_count, 0) AS active_installment_count
FROM credit_cards cc
LEFT JOIN installment_stats ist ON ist.card_id = cc.id AND ist.user_id = cc.user_id
LEFT JOIN transaction_stats ts ON ts.card_id = cc.id AND ts.user_id = cc.user_id
WHERE cc.is_active = true;

GRANT SELECT ON credit_card_summary TO authenticated;
