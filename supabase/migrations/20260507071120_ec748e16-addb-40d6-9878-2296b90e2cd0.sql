
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Allow sender to soft-delete their own message (or admin)
DROP POLICY IF EXISTS "Users can soft delete own messages" ON public.messages;
CREATE POLICY "Users can soft delete own messages"
ON public.messages FOR UPDATE
USING (auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin'));

-- Reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read reactions"
ON public.message_reactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users add own reactions"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own reactions"
ON public.message_reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
