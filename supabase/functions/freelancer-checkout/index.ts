import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KB_BASE = "https://pay.kbagency.me";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KB_KEY = Deno.env.get("KB_AGENCY_API_KEY");
    if (!KB_KEY) {
      return new Response(JSON.stringify({ error: "KB_AGENCY_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const { project_id, buyer_email, buyer_phone, buyer_iban, buyer_name } = body;

    if (!project_id || !buyer_email || !buyer_phone) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios em falta" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar telefone Angolano (9 dígitos começando por 9)
    const phoneClean = String(buyer_phone).replace(/\D/g, "").slice(-9);
    if (!/^9\d{8}$/.test(phoneClean)) {
      return new Response(JSON.stringify({ error: "Telefone inválido. Usa 9XXXXXXXX (9 dígitos)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth opcional
    let buyerUserId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data } = await admin.auth.getUser(auth.replace("Bearer ", ""));
      buyerUserId = data?.user?.id ?? null;
    }

    const { data: project, error: pErr } = await admin
      .from("freelancer_projects")
      .select("id, freelancer_id, title, price, currency, active")
      .eq("id", project_id)
      .maybeSingle();

    if (pErr || !project || !project.active) {
      return new Response(JSON.stringify({ error: "Projecto não disponível" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = Number(project.price);
    if (amount < 100) {
      return new Response(JSON.stringify({ error: "Valor mínimo é 100 AOA" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const platform_fee = Math.round(amount * 0.15 * 100) / 100;
    const freelancer_payout = Math.round((amount - platform_fee) * 100) / 100;
    const reference = `MX${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 99)}`;

    // Cria registo da compra
    const { data: purchase, error: insErr } = await admin
      .from("freelancer_purchases")
      .insert({
        project_id,
        freelancer_id: project.freelancer_id,
        buyer_user_id: buyerUserId,
        buyer_email, buyer_phone: phoneClean, buyer_iban: buyer_iban || null, buyer_name: buyer_name || null,
        amount, platform_fee, freelancer_payout,
        currency: project.currency || "AOA",
        payment_reference: reference,
        status: "pending",
      })
      .select()
      .single();

    if (insErr) throw new Error(insErr.message);

    // Chama KB Agency Pay API Ultra
    const webhook_url = `${SUPABASE_URL}/functions/v1/freelancer-payment-webhook`;
    const kbResp = await fetch(`${KB_BASE}/api/ultra/charge`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KB_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "express",
        phone: phoneClean,
        amount,
        reference,
        description: `Compra: ${project.title}`,
        webhook_url,
      }),
    });

    const kbData = await kbResp.json().catch(() => ({}));
    if (!kbResp.ok) {
      await admin.from("freelancer_purchases").update({ status: "failed" }).eq("id", purchase.id);
      console.error("KB Agency error:", kbResp.status, kbData);
      return new Response(JSON.stringify({
        error: kbData?.message || kbData?.error || `Erro do gateway (${kbResp.status})`,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Notifica freelancer
    const { data: fr } = await admin.from("freelancers").select("user_id").eq("id", project.freelancer_id).maybeSingle();
    if (fr?.user_id) {
      await admin.from("notifications").insert({
        user_id: fr.user_id,
        type: "purchase_pending",
        title: "Nova compra iniciada",
        message: `Cliente iniciou compra de "${project.title}" por ${amount} ${project.currency}`,
        link: "/freelancer",
      });
    }

    return new Response(JSON.stringify({
      success: true,
      purchase,
      payment: {
        method: "express",
        reference,
        amount,
        currency: project.currency,
        phone: phoneClean,
        message: kbData?.message || "Confirma o pagamento na app Multicaixa Express",
        check_status_url: kbData?.check_status_url || null,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("freelancer-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
