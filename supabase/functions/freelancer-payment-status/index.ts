import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const KB_BASE = "https://pay.kbagency.me";

// Polling unificado. Devolve { status: 'paid'|'failed'|'pending', download_url? }
// Identifica o tipo via prefixo da reference (MX/SP/FS).
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KB_KEY = Deno.env.get("KB_AGENCY_API_KEY");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const url = new URL(req.url);
    const reference = url.searchParams.get("reference");
    if (!reference) return json({ error: "reference obrigatória" }, 400);

    const prefix = reference.slice(0, 2).toUpperCase();
    const now = new Date().toISOString();

    // ----- FREELANCER SUBSCRIPTION -----
    if (prefix === "FS") {
      const { data: fr } = await admin.from("freelancers")
        .select("id, subscription_active").eq("subscription_reference", reference).maybeSingle();
      if (!fr) return json({ status: "unknown" });
      if (fr.subscription_active) return json({ status: "paid" });

      const remote = await fetchKB(KB_KEY, reference);
      if (remote === "paid") {
        await admin.from("freelancers").update({
          subscription_active: true, subscription_paid_at: now,
        }).eq("id", fr.id);
        return json({ status: "paid" });
      }
      if (remote === "failed") return json({ status: "failed" });
      return json({ status: "pending" });
    }

    // ----- SERVICE PLAN ORDER -----
    if (prefix === "SP") {
      const { data: order } = await admin.from("orders")
        .select("id, status").eq("payment_reference", reference).maybeSingle();
      if (!order) return json({ status: "unknown" });
      if (order.status === "paid" || order.status === "completed") return json({ status: "paid" });
      if (order.status === "failed") return json({ status: "failed" });

      const remote = await fetchKB(KB_KEY, reference);
      if (remote === "paid") {
        await admin.from("orders").update({ status: "paid", paid_at: now }).eq("id", order.id);
        return json({ status: "paid" });
      }
      if (remote === "failed") {
        await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
        return json({ status: "failed" });
      }
      return json({ status: "pending" });
    }

    // ----- MARKETPLACE PURCHASE (default) -----
    const { data: purchase } = await admin
      .from("freelancer_purchases")
      .select("id, project_id, status, download_token")
      .eq("payment_reference", reference)
      .maybeSingle();
    if (!purchase) return json({ status: "unknown" });
    if (purchase.status === "released") {
      return json({
        status: "paid",
        download_url: `${SUPABASE_URL}/functions/v1/freelancer-download?token=${purchase.download_token}`,
      });
    }
    if (purchase.status === "failed") return json({ status: "failed" });

    const remote = await fetchKB(KB_KEY, reference);
    if (remote === "paid") {
      const token = crypto.randomUUID() + "-" + Math.random().toString(36).slice(2, 10);
      const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("freelancer_purchases").update({
        status: "released", paid_at: now, released_at: now,
        download_token: token, download_expires_at: expires,
      }).eq("id", purchase.id);
      const { data: proj } = await admin.from("freelancer_projects")
        .select("sales_count").eq("id", purchase.project_id).maybeSingle();
      if (proj) await admin.from("freelancer_projects")
        .update({ sales_count: (proj.sales_count || 0) + 1 }).eq("id", purchase.project_id);
      return json({ status: "paid", download_url: `${SUPABASE_URL}/functions/v1/freelancer-download?token=${token}` });
    }
    if (remote === "failed") {
      await admin.from("freelancer_purchases").update({ status: "failed" }).eq("id", purchase.id);
      return json({ status: "failed" });
    }
    return json({ status: "pending" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("freelancer-payment-status error:", msg);
    return json({ error: msg }, 500);
  }
});

async function fetchKB(KB_KEY: string | undefined, reference: string): Promise<"paid" | "failed" | "pending"> {
  if (!KB_KEY) return "pending";
  try {
    const r = await fetch(`${KB_BASE}/api/ultra/status/${encodeURIComponent(reference)}`, {
      headers: { "Authorization": `Bearer ${KB_KEY}` },
    });
    const data = await r.json().catch(() => ({}));
    const s = String(data?.status || data?.data?.status || "").toLowerCase();
    if (s.includes("paid") || s.includes("success")) return "paid";
    if (s.includes("fail") || s.includes("decline") || s.includes("expired") || s.includes("cancel")) return "failed";
    return "pending";
  } catch { return "pending"; }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
