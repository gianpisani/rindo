-- Enable realtime for transactions table so we can detect new transactions from emails
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;