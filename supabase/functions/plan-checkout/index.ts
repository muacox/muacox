import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const KB_BASE = "https://pay.kbagency.me";

// Cria order para um service_plan e dispara push MCX Express via KB Agency.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KB_KEY = Deno.env.get("KB_AGENCY_API_KEY");
    if (!KB_KEY) return j({ error: "KB_AGENCY_API_KEY não configurada" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const { plan_id, customer_name, customer_email, customer_phone, notes } = body;
    if (!plan_id || !customer_name || !customer_email || !customer_phone)
      return j({ error: "Campos obrigatórios em falta" }, 400);

    const phoneClean = String(customer_phone).replace(/\D/g, "").slice(-9);
    if (!/^9\d{8}$/.test(phoneClean))
      return j({ error: "Telefone inválido. Usa 9XXXXXXXX." }, 400);

    let userId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data } = await admin.auth.getUser(auth.replace("Bearer ", ""));
      userId = data?.user?.id ?? null;
    }

    const { data: plan } = await admin.from("service_plans")
      .select("id, name, price, category, active").eq("id", plan_id).maybeSingle();
    if (!plan || !plan.active) return j({ error: "Plano não disponível" }, 404);

    const amount = Number(plan.price);
    if (amount < 100) return j({ error: "Valor mínimo 100 Kz" }, 400);

    const reference = `SP${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 99)}`;

    const { data: order, error: insErr } = await admin.from("orders").insert({
      user_id: userId, plan_id,
      customer_name, customer_email, customer_phone: phoneClean,
      amount, currency: "AOA", status: "pending",
      service_type: plan.category, notes: notes || null,
      payment_method: "multicaixa_express", payment_entity: "kb_agency",
      payment_reference: reference,
    }).select().single();
    if (insErr) throw new Error(insErr.message);

    const webhook_url = `${SUPABASE_URL}/functions/v1/freelancer-payment-webhook`;
    const r = await fetch(`${KB_BASE}/api/ultra/charge`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${KB_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "express", phone: phoneClean, amount, reference,
        description: `Plano: ${plan.name}`, webhook_url,
      }),
    });
    const kb = await r.json().catch(() => ({}));
    if (!r.ok) {
      await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
      return j({ error: kb?.message || kb?.error || `Erro do gateway (${r.status})` }, 502);
    }

    return j({
      success: true, order,
      payment: { method: "express", reference, amount, currency: "AOA", phone: phoneClean,
        message: kb?.message || "Confirma o pagamento na app Multicaixa Express." },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("plan-checkout error:", msg);
    return j({ error: msg }, 500);
  }
});

function j(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
