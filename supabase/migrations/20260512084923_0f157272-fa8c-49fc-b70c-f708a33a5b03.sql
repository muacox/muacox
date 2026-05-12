
ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS subscription_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_reference text,
  ADD COLUMN IF NOT EXISTS subscription_amount numeric NOT NULL DEFAULT 2500;

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_freelancers_subscription_reference ON public.freelancers (subscription_reference);
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders (payment_reference);
CREATE INDEX IF NOT EXISTS idx_freelancer_purchases_payment_reference ON public.freelancer_purchases (payment_reference);
