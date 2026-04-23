-- ============================================================
-- 1. Add 'freelancer' to app_role enum
-- ============================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'freelancer';

-- ============================================================
-- 2. Freelancers table (startup team)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.freelancers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,                          -- linked auth.users id (after they accept invite)
  invited_email TEXT NOT NULL UNIQUE,           -- email used in the invite
  full_name TEXT,
  specialty TEXT,                                -- "design", "dev", "support" etc.
  bio TEXT,
  avatar_url TEXT,
  hourly_rate NUMERIC,
  available BOOLEAN NOT NULL DEFAULT true,      -- accepting new work
  is_online BOOLEAN NOT NULL DEFAULT false,     -- live presence
  last_seen TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'invited',       -- invited | active | suspended
  invited_by UUID NOT NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_freelancers_user_id ON public.freelancers(user_id);
CREATE INDEX IF NOT EXISTS idx_freelancers_email ON public.freelancers(invited_email);

ALTER TABLE public.freelancers ENABLE ROW LEVEL SECURITY;

-- Helper function: is the current user an active freelancer?
CREATE OR REPLACE FUNCTION public.is_active_freelancer(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.freelancers
    WHERE user_id = _user_id AND status = 'active'
  );
$$;

-- RLS: admin manages all
CREATE POLICY "Admins manage freelancers"
  ON public.freelancers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS: freelancer can view + update own row
CREATE POLICY "Freelancer views own row"
  ON public.freelancers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Freelancer updates own presence"
  ON public.freelancers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER freelancers_updated_at
  BEFORE UPDATE ON public.freelancers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Auto-assign 'freelancer' role when invitee logs in
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_assign_freelancer_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _email TEXT;
  _freelancer_id UUID;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;
  IF _email IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO _freelancer_id FROM public.freelancers
   WHERE invited_email = _email AND user_id IS NULL
   LIMIT 1;

  IF _freelancer_id IS NOT NULL THEN
    UPDATE public.freelancers
       SET user_id = NEW.user_id,
           status = 'active',
           accepted_at = COALESCE(accepted_at, now())
     WHERE id = _freelancer_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'freelancer'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_assign_freelancer ON public.profiles;
CREATE TRIGGER profiles_assign_freelancer
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_freelancer_role();

-- ============================================================
-- 4. Add assigned_to columns
-- ============================================================
ALTER TABLE public.orders   ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS assigned_to UUID;

CREATE INDEX IF NOT EXISTS idx_orders_assigned   ON public.orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_messages_assigned ON public.messages(assigned_to);

-- ============================================================
-- 5. Update RLS so freelancers can interact with their assignments
-- ============================================================

-- ORDERS: extend SELECT to include assigned freelancer
DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
CREATE POLICY "Users view own orders"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR (assigned_to IS NOT NULL AND assigned_to = auth.uid() AND public.is_active_freelancer(auth.uid()))
  );

-- ORDERS: allow assigned freelancer to update status/notes
CREATE POLICY "Assigned freelancer updates orders"
  ON public.orders FOR UPDATE
  USING (assigned_to = auth.uid() AND public.is_active_freelancer(auth.uid()))
  WITH CHECK (assigned_to = auth.uid() AND public.is_active_freelancer(auth.uid()));

-- MESSAGES: extend SELECT for freelancer assigned to that conversation
DROP POLICY IF EXISTS "User views own conversation" ON public.messages;
CREATE POLICY "User views own conversation"
  ON public.messages FOR SELECT
  USING (
    auth.uid() = conversation_user_id
    OR public.has_role(auth.uid(), 'admin')
    OR (assigned_to IS NOT NULL AND assigned_to = auth.uid() AND public.is_active_freelancer(auth.uid()))
  );

-- MESSAGES: allow freelancer to send when assigned
DROP POLICY IF EXISTS "User sends in own conversation" ON public.messages;
CREATE POLICY "User sends in own conversation"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND (
      (auth.uid() = conversation_user_id AND is_admin_sender = false)
      OR (public.has_role(auth.uid(), 'admin') AND is_admin_sender = true)
      OR (
        public.is_active_freelancer(auth.uid())
        AND is_admin_sender = true
        AND EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.conversation_user_id = messages.conversation_user_id
            AND m.assigned_to = auth.uid()
          LIMIT 1
        )
      )
    )
  );

-- PAYMENT PROOFS: freelancer can review proofs of orders assigned to them
CREATE POLICY "Assigned freelancer views proofs"
  ON public.payment_proofs FOR SELECT
  USING (
    public.is_active_freelancer(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payment_proofs.order_id
        AND o.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Assigned freelancer updates proofs"
  ON public.payment_proofs FOR UPDATE
  USING (
    public.is_active_freelancer(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payment_proofs.order_id
        AND o.assigned_to = auth.uid()
    )
  );

-- ============================================================
-- 6. Make invoices bucket PRIVATE & lock down storage objects
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'invoices';

-- Drop any existing public policies on the invoices bucket
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname ILIKE '%invoice%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Only admins can read invoice files directly via storage API
CREATE POLICY "Admin reads invoices bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND public.has_role(auth.uid(), 'admin'));

-- Service role (used by edge functions) bypasses RLS automatically.

-- ============================================================
-- 7. Invoice download tokens (per-recipient, time-limited)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_download_tokens (
  token TEXT PRIMARY KEY,
  order_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  used_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_download_tokens ENABLE ROW LEVEL SECURITY;

-- No client-side access at all; only edge functions (service role) touch it.
CREATE POLICY "Admin reads invoice tokens"
  ON public.invoice_download_tokens FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Validation trigger to prevent invalid expiry inserts
CREATE OR REPLACE FUNCTION public.validate_invoice_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at <= NEW.created_at THEN
    RAISE EXCEPTION 'expires_at must be after created_at';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoice_token_validate
  BEFORE INSERT OR UPDATE ON public.invoice_download_tokens
  FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_token();