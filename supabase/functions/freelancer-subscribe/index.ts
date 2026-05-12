import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const KB_BASE = "https://pay.kbagency.me";
const SUB_AMOUNT = 2500;

// Inicia subscrição do freelancer (2500 Kz / mês) via KB Agency MCX Express push.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const KB_KEY = Deno.env.get("KB_AGENCY_API_KEY");
    if (!KB_KEY) return j({ error: "KB_AGENCY_API_KEY não configurada" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return j({ error: "Sem autenticação" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return j({ error: "Sessão inválida" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { phone } = await req.json();
    const phoneClean = String(phone || "").replace(/\D/g, "").slice(-9);
    if (!/^9\d{8}$/.test(phoneClean)) return j({ error: "Telefone inválido (9XXXXXXXX)" }, 400);

    const { data: fr } = await admin.from("freelancers")
      .select("id, status, subscription_active").eq("user_id", u.user.id).maybeSingle();
    if (!fr) return j({ error: "Conta de freelancer não encontrada" }, 404);
    if (fr.subscription_active) return j({ error: "Subscrição já está activa" }, 400);

    const reference = `FS${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 99)}`;
    await admin.from("freelancers").update({
      subscription_reference: reference, subscription_amount: SUB_AMOUNT,
    }).eq("id", fr.id);

    const webhook_url = `${SUPABASE_URL}/functions/v1/freelancer-payment-webhook`;
    const r = await fetch(`${KB_BASE}/api/ultra/charge`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${KB_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "express", phone: phoneClean, amount: SUB_AMOUNT, reference,
        description: "Subscrição freelancer MuacoX", webhook_url,
      }),
    });
    const kb = await r.json().catch(() => ({}));
    if (!r.ok) return j({ error: kb?.message || kb?.error || `Erro do gateway (${r.status})` }, 502);

    return j({
      success: true,
      payment: { reference, amount: SUB_AMOUNT, phone: phoneClean,
        message: kb?.message || "Confirma na app Multicaixa Express." },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("freelancer-subscribe error:", msg);
    return j({ error: msg }, 500);
  }
});

function j(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
