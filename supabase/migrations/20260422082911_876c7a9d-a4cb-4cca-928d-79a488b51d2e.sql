
-- Testimonials table
CREATE TABLE public.testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  rating SMALLINT NOT NULL DEFAULT 5,
  photo_url TEXT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT testimonials_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT testimonials_message_len CHECK (char_length(message) BETWEEN 5 AND 600),
  CONSTRAINT testimonials_name_len CHECK (char_length(author_name) BETWEEN 2 AND 80)
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved testimonials; admins can view all
CREATE POLICY "View approved or admin"
  ON public.testimonials FOR SELECT
  USING (approved = true OR public.has_role(auth.uid(), 'admin'));

-- Anyone (guest or auth) can submit
CREATE POLICY "Anyone can submit"
  ON public.testimonials FOR INSERT
  WITH CHECK (
    approved = false
    AND (
      (auth.uid() IS NULL AND user_id IS NULL)
      OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    )
  );

-- Admins can update / delete
CREATE POLICY "Admins update testimonials"
  ON public.testimonials FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete testimonials"
  ON public.testimonials FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_testimonials_approved_created ON public.testimonials (approved, created_at DESC);

-- Storage bucket for testimonial photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('testimonial-photos', 'testimonial-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read testimonial photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'testimonial-photos');

CREATE POLICY "Anyone can upload testimonial photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'testimonial-photos');

CREATE POLICY "Admins manage testimonial photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'testimonial-photos' AND public.has_role(auth.uid(), 'admin'));
