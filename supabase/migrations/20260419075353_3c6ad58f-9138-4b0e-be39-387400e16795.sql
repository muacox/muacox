-- =========================================================
-- RESET: drop tudo do projecto antigo (PayVendas/BIOLOS)
-- =========================================================
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.feed_posts CASCADE;
DROP TABLE IF EXISTS public.post_comments CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.pdf_products CASCADE;
DROP TABLE IF EXISTS public.pdf_purchases CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.trades CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.user_bans CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

DROP FUNCTION IF EXISTS public.process_referral_commission(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.generate_referral_code() CASCADE;

-- Limpar profiles (manter, mas remover colunas de marketplace)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS iban_virtual,
  DROP COLUMN IF EXISTS balance,
  DROP COLUMN IF EXISTS kyc_status,
  DROP COLUMN IF EXISTS kyc_document_url,
  DROP COLUMN IF EXISTS kyc_selfie_url,
  DROP COLUMN IF EXISTS wallet_activated,
  DROP COLUMN IF EXISTS wallet_activation_date,
  DROP COLUMN IF EXISTS pwa_installed,
  DROP COLUMN IF EXISTS pwa_install_date,
  DROP COLUMN IF EXISTS pwa_bonus_claimed,
  DROP COLUMN IF EXISTS signup_bonus_claimed,
  DROP COLUMN IF EXISTS bonus_balance,
  DROP COLUMN IF EXISTS total_profit,
  DROP COLUMN IF EXISTS referral_code,
  DROP COLUMN IF EXISTS referred_by,
  DROP COLUMN IF EXISTS referral_earnings,
  DROP COLUMN IF EXISTS referral_count;

-- Recriar handle_new_user simplificado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

-- Atribuir admin automático a isaacmuaco528@gmail.com
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email TEXT;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;
  IF _email IN ('isaacmuaco528@gmail.com', 'isaacmuaco582@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS auto_admin_on_profile_create ON public.profiles;
CREATE TRIGGER auto_admin_on_profile_create
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_admin_role();

-- =========================================================
-- NOVAS TABELAS — MuacoX
-- =========================================================

-- Notifications (in-app)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all notifications" ON public.notifications FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Service plans
CREATE TABLE public.service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('website', 'hosting', 'flyer')),
  name TEXT NOT NULL,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  price NUMERIC NOT NULL,
  billing_cycle TEXT DEFAULT 'one_time' CHECK (billing_cycle IN ('one_time', 'monthly', 'yearly')),
  highlighted BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.service_plans FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage plans" ON public.service_plans FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  plan_id UUID REFERENCES public.service_plans(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  notes TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'AOA',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_payment', 'paid', 'in_progress', 'delivered', 'cancelled', 'refunded')),
  payment_reference TEXT,
  payment_entity TEXT,
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create order" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Flyer gallery
CREATE TABLE public.flyer_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  category TEXT,
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.flyer_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active flyers" ON public.flyer_gallery FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage flyers" ON public.flyer_gallery FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Hired users (programadores convidados)
CREATE TABLE public.hired_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'developer',
  invited_by UUID NOT NULL,
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  user_id UUID,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'inactive'))
);
ALTER TABLE public.hired_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage hired users" ON public.hired_users FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own hire record" ON public.hired_users FOR SELECT USING (auth.uid() = user_id);

-- Push subscriptions (Web Push)
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  is_admin_device BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins view all subscriptions" ON public.push_subscriptions FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Triggers de updated_at
DROP TRIGGER IF EXISTS update_service_plans_updated ON public.service_plans;
CREATE TRIGGER update_service_plans_updated BEFORE UPDATE ON public.service_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated ON public.orders;
CREATE TRIGGER update_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime para orders e notifications
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Seed: planos iniciais
INSERT INTO public.service_plans (category, name, description, features, price, billing_cycle, highlighted, display_order) VALUES
('website', 'Site Profissional Completo', 'Site responsivo + domínio .com/.ao + 1 ano de hospedagem incluído', '["Design profissional personalizado", "Domínio próprio (1 ano)", "Hospedagem inclusa (1 ano)", "Até 8 páginas", "SEO básico optimizado", "Formulário de contacto", "Integração WhatsApp", "Certificado SSL grátis", "Painel de administração", "Suporte 30 dias"]'::jsonb, 98000, 'one_time', true, 1),
('website', 'Site Landing Page', 'Página única de alta conversão para campanha ou produto', '["Design moderno", "1 página de alto impacto", "Formulário lead", "Optimizado para mobile", "Entrega em 5 dias"]'::jsonb, 45000, 'one_time', false, 2),
('website', 'Site E-commerce', 'Loja online completa com gestão de produtos e pagamentos', '["Catálogo de produtos ilimitado", "Carrinho + checkout", "Integração PlinqPay", "Painel admin completo", "Domínio + hospedagem (1 ano)", "Treino personalizado"]'::jsonb, 180000, 'one_time', false, 3),

('hosting', 'Hospedagem Básica', 'Ideal para sites pequenos e portfólios', '["10 GB de armazenamento", "100 GB tráfego mensal", "1 conta de email profissional", "SSL grátis", "Backup semanal"]'::jsonb, 15000, 'monthly', false, 1),
('hosting', 'Hospedagem Pro', 'Para empresas e sites com tráfego médio', '["50 GB de armazenamento", "500 GB tráfego mensal", "10 contas de email", "SSL grátis", "Backup diário", "Suporte prioritário"]'::jsonb, 30000, 'monthly', true, 2),
('hosting', 'Hospedagem Empresarial', 'Performance máxima para grandes operações', '["200 GB SSD", "Tráfego ilimitado", "Contas de email ilimitadas", "CDN global", "Backup diário", "Suporte 24/7", "Servidor dedicado"]'::jsonb, 60000, 'monthly', false, 3),

('flyer', 'Flyer Simples', 'Flyer digital profissional para redes sociais', '["1 design original", "Formato Instagram/WhatsApp", "Entrega em 24h", "1 revisão incluída"]'::jsonb, 5000, 'one_time', false, 1),
('flyer', 'Pack Flyer Premium', '3 flyers profissionais com identidade visual', '["3 designs originais", "Múltiplos formatos", "Entrega em 48h", "3 revisões incluídas", "Ficheiros editáveis"]'::jsonb, 12000, 'one_time', true, 2),
('flyer', 'Pack Marketing Mensal', 'Campanhas mensais consistentes para a sua marca', '["10 flyers por mês", "Calendário editorial", "Logo incluído", "Entrega semanal", "Suporte dedicado"]'::jsonb, 35000, 'monthly', false, 3);