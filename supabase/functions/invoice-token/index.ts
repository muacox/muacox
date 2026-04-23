// Issue a one-time download token for an invoice. Admin only.
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

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id;
    if (!orderId) return json({ error: "order_id obrigatório" }, 400);

    const { data: order } = await admin.from("orders")
      .select("id, invoice_number").eq("id", orderId).maybeSingle();
    if (!order || !order.invoice_number) return json({ error: "Factura ainda não emitida" }, 404);

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await admin.from("invoice_download_tokens").insert({
      token,
      order_id: order.id,
      invoice_number: order.invoice_number,
    });

    const url = `${SUPABASE_URL}/functions/v1/download-invoice/${order.invoice_number}.pdf?token=${token}`;
    return json({ url, expires_in_days: 7 });
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
