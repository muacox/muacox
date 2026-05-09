
-- ============ PROJECTOS DOS FREELANCERS ============
CREATE TABLE public.freelancer_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  language text,
  category text,
  price numeric NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'AOA',
  cover_url text,
  demo_url text,
  files_path text,
  features jsonb DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sales_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fp_freelancer ON public.freelancer_projects(freelancer_id);
CREATE INDEX idx_fp_active ON public.freelancer_projects(active);

ALTER TABLE public.freelancer_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active projects"
  ON public.freelancer_projects FOR SELECT
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.user_id = auth.uid()));

CREATE POLICY "Freelancer manages own projects"
  ON public.freelancer_projects FOR ALL
  USING (EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.user_id = auth.uid() AND f.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.user_id = auth.uid() AND f.status = 'active'));

CREATE POLICY "Admins manage projects"
  ON public.freelancer_projects FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_fp_updated BEFORE UPDATE ON public.freelancer_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ COMPRAS ============
CREATE TABLE public.freelancer_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.freelancer_projects(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL,
  buyer_user_id uuid,
  buyer_email text NOT NULL,
  buyer_phone text NOT NULL,
  buyer_iban text,
  buyer_name text,
  amount numeric NOT NULL,
  platform_fee numeric NOT NULL,
  freelancer_payout numeric NOT NULL,
  currency text NOT NULL DEFAULT 'AOA',
  status text NOT NULL DEFAULT 'pending', -- pending | proof_uploaded | paid | released | refunded
  payment_reference text,
  proof_url text,
  download_token text UNIQUE,
  download_expires_at timestamptz,
  paid_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fpur_buyer ON public.freelancer_purchases(buyer_user_id);
CREATE INDEX idx_fpur_freelancer ON public.freelancer_purchases(freelancer_id);
CREATE INDEX idx_fpur_token ON public.freelancer_purchases(download_token);

ALTER TABLE public.freelancer_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer sees own purchases"
  ON public.freelancer_purchases FOR SELECT
  USING (auth.uid() = buyer_user_id
         OR has_role(auth.uid(), 'admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.user_id = auth.uid()));

CREATE POLICY "Anyone can create purchase"
  ON public.freelancer_purchases FOR INSERT
  WITH CHECK ((auth.uid() IS NULL AND buyer_user_id IS NULL)
              OR (auth.uid() IS NOT NULL AND auth.uid() = buyer_user_id));

CREATE POLICY "Buyer updates own pending purchase"
  ON public.freelancer_purchases FOR UPDATE
  USING (auth.uid() = buyer_user_id AND status IN ('pending','proof_uploaded'));

CREATE POLICY "Freelancer confirms payment"
  ON public.freelancer_purchases FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.user_id = auth.uid() AND f.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.user_id = auth.uid() AND f.status = 'active'));

CREATE POLICY "Admins manage purchases"
  ON public.freelancer_purchases FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ PEDIDOS DE CONTRATAÇÃO ============
CREATE TABLE public.freelancer_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL,
  client_user_id uuid,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text NOT NULL,
  client_iban text,
  project_description text NOT NULL,
  budget numeric,
  deadline_days integer,
  status text NOT NULL DEFAULT 'open', -- open | accepted | declined | in_progress | delivered | paid | cancelled
  freelancer_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fc_freelancer ON public.freelancer_contracts(freelancer_id);
CREATE INDEX idx_fc_client ON public.freelancer_contracts(client_user_id);

ALTER TABLE public.freelancer_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client sees own contracts"
  ON public.freelancer_contracts FOR SELECT
  USING (auth.uid() = client_user_id
         OR has_role(auth.uid(), 'admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.user_id = auth.uid()));

CREATE POLICY "Anyone creates contract"
  ON public.freelancer_contracts FOR INSERT
  WITH CHECK ((auth.uid() IS NULL AND client_user_id IS NULL)
              OR (auth.uid() IS NOT NULL AND auth.uid() = client_user_id));

CREATE POLICY "Freelancer responds to contract"
  ON public.freelancer_contracts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.user_id = auth.uid() AND f.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.user_id = auth.uid() AND f.status = 'active'));

CREATE POLICY "Admins manage contracts"
  ON public.freelancer_contracts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_fc_updated BEFORE UPDATE ON public.freelancer_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('freelancer-files', 'freelancer-files', false),
  ('freelancer-covers', 'freelancer-covers', true)
ON CONFLICT (id) DO NOTHING;

-- COVERS (público)
CREATE POLICY "Public reads covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'freelancer-covers');

CREATE POLICY "Freelancer uploads own covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'freelancer-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Freelancer updates own covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'freelancer-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Freelancer deletes own covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'freelancer-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- FILES (privado — só o freelancer dono e admins; download apenas via signed URL gerada por edge function)
CREATE POLICY "Freelancer reads own files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'freelancer-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Freelancer uploads own files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'freelancer-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Freelancer updates own files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'freelancer-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Freelancer deletes own files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'freelancer-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.freelancer_purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.freelancer_contracts;
