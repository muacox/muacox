-- Update admin auto-assign trigger to include isaacmilagre9@gmail.com
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IN ('isaacmuaco582@gmail.com', 'derivaldokiala@gmail.com', 'isaacmilagre9@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also insert admin role for isaacmilagre9@gmail.com if they already exist
DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE email = 'isaacmilagre9@gmail.com';
  IF _user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
END $$;
