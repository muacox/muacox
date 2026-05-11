import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KB_BASE = "https://pay.kbagency.me";

// Endpoint de polling. Consulta KB Agency e, se "paid", liberta o download (idempotente com webhook).
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KB_KEY = Deno.env.get("KB_AGENCY_API_KEY");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const url = new URL(req.url);
    const reference = url.searchParams.get("reference");
    if (!reference) {
      return new Response(JSON.stringify({ error: "reference obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: purchase } = await admin
      .from("freelancer_purchases")
      .select("id, project_id, status, download_token, buyer_user_id")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (!purchase) {
      return new Response(JSON.stringify({ status: "unknown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Já liberto
    if (purchase.status === "released") {
      return new Response(JSON.stringify({
        status: "paid",
        download_url: `${SUPABASE_URL}/functions/v1/freelancer-download?token=${purchase.download_token}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (purchase.status === "failed") {
      return new Response(JSON.stringify({ status: "failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consulta KB Agency
    if (KB_KEY) {
      const r = await fetch(`${KB_BASE}/api/ultra/status/${encodeURIComponent(reference)}`, {
        headers: { "Authorization": `Bearer ${KB_KEY}` },
      });
      const data = await r.json().catch(() => ({}));
      const status = String(data?.status || "").toLowerCase();

      if (status === "paid") {
        const token = crypto.randomUUID() + "-" + Math.random().toString(36).slice(2, 10);
        const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const now = new Date().toISOString();
        await admin.from("freelancer_purchases").update({
          status: "released", paid_at: now, released_at: now,
          download_token: token, download_expires_at: expires,
        }).eq("id", purchase.id);

        const { data: proj } = await admin.from("freelancer_projects")
          .select("sales_count").eq("id", purchase.project_id).maybeSingle();
        if (proj) {
          await admin.from("freelancer_projects")
            .update({ sales_count: (proj.sales_count || 0) + 1 })
            .eq("id", purchase.project_id);
        }

        return new Response(JSON.stringify({
          status: "paid",
          download_url: `${SUPABASE_URL}/functions/v1/freelancer-download?token=${token}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (status === "failed") {
        await admin.from("freelancer_purchases").update({ status: "failed" }).eq("id", purchase.id);
        return new Response(JSON.stringify({ status: "failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ status: "pending" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("freelancer-payment-status error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
