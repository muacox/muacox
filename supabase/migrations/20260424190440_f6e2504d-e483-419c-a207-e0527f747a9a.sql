-- Site themes table for AI-generated CSS overrides
CREATE TABLE IF NOT EXISTS public.site_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  css text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_themes ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can read the currently-active theme so the CSS applies on the public site
CREATE POLICY "Anyone reads active theme"
  ON public.site_themes
  FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage themes"
  ON public.site_themes
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ensure only ONE active theme at a time
CREATE OR REPLACE FUNCTION public.ensure_single_active_theme()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.site_themes SET is_active = false
     WHERE id <> NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_active_theme ON public.site_themes;
CREATE TRIGGER trg_single_active_theme
BEFORE INSERT OR UPDATE ON public.site_themes
FOR EACH ROW EXECUTE FUNCTION public.ensure_single_active_theme();

DROP TRIGGER IF EXISTS trg_site_themes_updated_at ON public.site_themes;
CREATE TRIGGER trg_site_themes_updated_at
BEFORE UPDATE ON public.site_themes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime so all browsers update instantly when the active theme changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_themes;