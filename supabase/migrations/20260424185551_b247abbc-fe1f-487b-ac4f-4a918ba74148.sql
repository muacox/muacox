DROP POLICY IF EXISTS "Anyone can report incident" ON public.security_incidents;
CREATE POLICY "Anyone can report incident" ON public.security_incidents
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    kind IN ('brute_force','devtools_open','sql_injection_attempt','suspicious_paste','blocked_ip_visit','rate_limit')
    AND length(coalesce(details,'')) <= 500
    AND length(coalesce(user_agent,'')) <= 500
  );