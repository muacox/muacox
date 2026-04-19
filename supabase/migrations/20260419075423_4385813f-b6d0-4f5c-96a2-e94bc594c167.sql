DROP POLICY IF EXISTS "Anyone can create order" ON public.orders;
CREATE POLICY "Authenticated or guest can create order" ON public.orders
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated insert own notification" ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public) VALUES ('public-assets', 'public-assets', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read public-assets" ON storage.objects;
CREATE POLICY "Public read public-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-assets');

DROP POLICY IF EXISTS "Admins manage public-assets" ON storage.objects;
CREATE POLICY "Admins manage public-assets" ON storage.objects
  FOR ALL USING (bucket_id = 'public-assets' AND has_role(auth.uid(), 'admin'));