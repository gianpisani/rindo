-- Permitir amount = 0 en transactions.
-- Necesario para gastos 100% compartidos: al marcar como pagada la deuda de
-- un tercero que cubría el total del gasto, la transacción original queda
-- en $0 (completamente reembolsada) en vez de mantener el monto original.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_amount_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_amount_check CHECK (amount >= 0);
