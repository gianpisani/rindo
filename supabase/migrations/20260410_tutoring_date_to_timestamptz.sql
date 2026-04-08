-- Change tutoring_classes.date from DATE to TIMESTAMPTZ to support time
ALTER TABLE public.tutoring_classes
  ALTER COLUMN date TYPE TIMESTAMPTZ USING date::timestamptz;
