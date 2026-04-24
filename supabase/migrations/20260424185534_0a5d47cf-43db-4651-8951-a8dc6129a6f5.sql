-- ── Lista negra de IPs ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  blocked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage blocked ips" ON public.blocked_ips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Registo de incidentes de segurança ─────────────
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT,
  kind TEXT NOT NULL,
  details TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read incidents" ON public.security_incidents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can report incident" ON public.security_incidents
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_security_incidents_ip ON public.security_incidents(ip, created_at DESC);

-- ── Áudio no chat ──────────────────────────────────
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_kind TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-audio', 'chat-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Audio storage policies (mirror chat-uploads behaviour)
DROP POLICY IF EXISTS "Audio: user uploads own folder" ON storage.objects;
CREATE POLICY "Audio: user uploads own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Audio: user reads own folder" ON storage.objects;
CREATE POLICY "Audio: user reads own folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-audio' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_active_freelancer(auth.uid())
  ));

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_user_id, created_at DESC);