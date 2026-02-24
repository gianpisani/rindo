-- Add last_4_digits column to credit_cards for auto-matching email transactions
ALTER TABLE credit_cards ADD COLUMN last_4_digits VARCHAR(4);
