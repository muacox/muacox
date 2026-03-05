-- Re-create triggers that were missing
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE TRIGGER on_profile_created_assign_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_admin_role();

-- Enable realtime for transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Fix missing profiles for existing users
INSERT INTO public.profiles (user_id, full_name, phone, iban_virtual, wallet_activated)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  COALESCE(u.raw_user_meta_data->>'phone', ''),
  'BIOLO-AO-' || LPAD(FLOOR(RANDOM() * 999999999)::TEXT, 9, '0'),
  true
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;