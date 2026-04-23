// Re-generate ALL paid invoices using the latest template.
// Admin only. Useful after the invoice template changes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Apenas admin" }, 403);

    // Fetch all paid orders
    const { data: orders } = await admin
      .from("orders")
      .select("id, invoice_number")
      .in("status", ["paid", "completed"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (!orders || orders.length === 0) return json({ regenerated: 0 });

    let ok = 0, fail = 0;
    for (const o of orders) {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({ order_id: o.id, force: true }),
      });
      if (r.ok) ok++; else fail++;
    }

    return json({ regenerated: ok, failed: fail, total: orders.length });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
