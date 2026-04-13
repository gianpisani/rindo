-- Add 'Reembolso' as a valid transaction type.
-- Reembolso is used when a shared expense debtor pays their part back.
-- It does NOT count towards balance calculations (not income, expense, or investment).

-- Drop and recreate the check constraint on transactions
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('Ingreso', 'Gasto', 'Inversión', 'Reembolso'));

-- Drop and recreate the check constraint on categories
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE categories ADD CONSTRAINT categories_type_check
  CHECK (type IN ('Ingreso', 'Gasto', 'Inversión', 'Reembolso'));
