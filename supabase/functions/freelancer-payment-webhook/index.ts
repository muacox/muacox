import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Webhook recebido do KB Agency Pay quando um pagamento muda de estado.
// Quando "paid"/"success", liberta o download automaticamente.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const payload = await req.json().catch(() => ({}));
    console.log("KB webhook payload:", JSON.stringify(payload));

    // Suporta dois formatos: { event, data: { reference, status } } ou { reference, status }
    const data = payload?.data || payload;
    const reference: string | undefined = data?.reference;
    const rawStatus: string = String(data?.status || payload?.event || "").toLowerCase();
    const isPaid = rawStatus.includes("paid") || rawStatus.includes("success");
    const isFailed = rawStatus.includes("fail") || rawStatus.includes("decline") || rawStatus.includes("expired") || rawStatus.includes("cancel");

    if (!reference) {
      return new Response(JSON.stringify({ ok: true, ignored: "no reference" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: purchase } = await admin
      .from("freelancer_purchases")
      .select("id, project_id, buyer_user_id, status")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (!purchase) {
      return new Response(JSON.stringify({ ok: true, ignored: "not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (purchase.status === "released") {
      return new Response(JSON.stringify({ ok: true, already: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isFailed) {
      await admin.from("freelancer_purchases").update({ status: "failed" }).eq("id", purchase.id);
      return new Response(JSON.stringify({ ok: true, status: "failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isPaid) {
      const token = crypto.randomUUID() + "-" + Math.random().toString(36).slice(2, 10);
      const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      await admin.from("freelancer_purchases").update({
        status: "released",
        paid_at: now,
        released_at: now,
        download_token: token,
        download_expires_at: expires,
      }).eq("id", purchase.id);

      const { data: proj } = await admin.from("freelancer_projects")
        .select("sales_count, title, freelancer_id").eq("id", purchase.project_id).maybeSingle();

      if (proj) {
        await admin.from("freelancer_projects")
          .update({ sales_count: (proj.sales_count || 0) + 1 })
          .eq("id", purchase.project_id);

        const { data: fr } = await admin.from("freelancers")
          .select("user_id").eq("id", proj.freelancer_id).maybeSingle();
        if (fr?.user_id) {
          await admin.from("notifications").insert({
            user_id: fr.user_id,
            type: "purchase_paid",
            title: "Venda confirmada (pago)",
            message: `Pagamento de "${proj.title}" recebido via Multicaixa Express.`,
            link: "/freelancer",
          });
        }
      }

      if (purchase.buyer_user_id) {
        await admin.from("notifications").insert({
          user_id: purchase.buyer_user_id,
          type: "download_ready",
          title: "Pagamento confirmado",
          message: "O teu projecto está pronto para descarregar.",
          link: "/dashboard",
        });
      }

      return new Response(JSON.stringify({ ok: true, status: "released" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, status: rawStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("freelancer-payment-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
