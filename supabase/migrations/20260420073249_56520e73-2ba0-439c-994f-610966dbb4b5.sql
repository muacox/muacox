-- MESSAGES (chat 1-1 cliente <-> admin)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_user_id UUID NOT NULL, -- sempre o id do cliente (admin escreve no slot do cliente)
  sender_id UUID NOT NULL,
  is_admin_sender BOOLEAN NOT NULL DEFAULT false,
  body TEXT,
  attachment_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conv ON public.messages(conversation_user_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own conversation"
  ON public.messages FOR SELECT
  USING (auth.uid() = conversation_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "User sends in own conversation"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      (auth.uid() = conversation_user_id AND is_admin_sender = false)
      OR (public.has_role(auth.uid(), 'admin') AND is_admin_sender = true)
    )
  );

CREATE POLICY "Admin updates messages"
  ON public.messages FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = conversation_user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- PAYMENT PROOFS
CREATE TABLE public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  amount NUMERIC,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own proofs"
  ON public.payment_proofs FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own proofs"
  ON public.payment_proofs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage proofs"
  ON public.payment_proofs FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_proofs;

-- STORAGE BUCKET (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own + admin reads all"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-uploads'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admin updates chat uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-uploads' AND public.has_role(auth.uid(), 'admin'));

-- Permitir cliente associar order ao seu user_id em INSERT (já está na policy existente)
-- Adicionar policy para cliente actualizar dados do seu pedido (notes etc) se quiser
CREATE POLICY "Users update own pending orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');