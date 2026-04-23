// Public list of avatars — no auth required, no PII beyond avatar + first name.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await admin.from("profiles")
      .select("user_id, full_name, avatar_url")
      .not("avatar_url", "is", null)
      .order("updated_at", { ascending: false })
      .limit(12);

    // Strip last names — only return first name for privacy
    const avatars = (data || []).map((p: any) => ({
      user_id: p.user_id,
      full_name: (p.full_name || "").split(" ")[0] || null,
      avatar_url: p.avatar_url,
    }));

    return new Response(JSON.stringify({ avatars }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, avatars: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
