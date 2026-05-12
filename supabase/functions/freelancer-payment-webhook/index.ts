import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Webhook unificado KB Agency Pay.
// Trata 3 tipos de pagamento (distinguidos pelo prefixo da reference):
//   MX... -> compra de projecto no marketplace (freelancer_purchases)
//   SP... -> plano de serviço da MuacoX (orders)
//   FS... -> subscrição mensal do freelancer 2500 Kz (freelancers)
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const payload = await req.json().catch(() => ({}));
    console.log("KB webhook payload:", JSON.stringify(payload));

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

    const now = new Date().toISOString();
    const prefix = reference.slice(0, 2).toUpperCase();

    // === SUBSCRIÇÃO FREELANCER ===
    if (prefix === "FS") {
      const { data: fr } = await admin.from("freelancers")
        .select("id, user_id, full_name, subscription_active")
        .eq("subscription_reference", reference).maybeSingle();
      if (!fr) return ok({ ignored: "freelancer not found" });
      if (fr.subscription_active && isPaid) return ok({ already: true });

      if (isFailed) {
        return ok({ status: "failed" });
      }
      if (isPaid) {
        await admin.from("freelancers").update({
          subscription_active: true,
          subscription_paid_at: now,
        }).eq("id", fr.id);
        if (fr.user_id) {
          await admin.from("notifications").insert({
            user_id: fr.user_id,
            type: "subscription_active",
            title: "Subscrição activa",
            message: "Já podes publicar projectos no marketplace.",
            link: "/freelancer",
          });
        }
      }
      return ok({ status: rawStatus });
    }

    // === PLANO DE SERVIÇO (orders) ===
    if (prefix === "SP") {
      const { data: order } = await admin.from("orders")
        .select("id, user_id, status, customer_name, amount")
        .eq("payment_reference", reference).maybeSingle();
      if (!order) return ok({ ignored: "order not found" });
      if (order.status === "paid" || order.status === "completed") return ok({ already: true });

      if (isFailed) {
        await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
        return ok({ status: "failed" });
      }
      if (isPaid) {
        await admin.from("orders").update({ status: "paid", paid_at: now }).eq("id", order.id);
        if (order.user_id) {
          await admin.from("notifications").insert({
            user_id: order.user_id,
            type: "order_paid",
            title: "Pagamento confirmado",
            message: `O teu pedido foi pago. Vamos começar!`,
            link: "/dashboard",
          });
        }
      }
      return ok({ status: rawStatus });
    }

    // === COMPRA DE PROJECTO MARKETPLACE (default / MX) ===
    const { data: purchase } = await admin
      .from("freelancer_purchases")
      .select("id, project_id, buyer_user_id, status")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (!purchase) return ok({ ignored: "not found" });
    if (purchase.status === "released") return ok({ already: true });

    if (isFailed) {
      await admin.from("freelancer_purchases").update({ status: "failed" }).eq("id", purchase.id);
      return ok({ status: "failed" });
    }

    if (isPaid) {
      const token = crypto.randomUUID() + "-" + Math.random().toString(36).slice(2, 10);
      const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      await admin.from("freelancer_purchases").update({
        status: "released", paid_at: now, released_at: now,
        download_token: token, download_expires_at: expires,
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
            user_id: fr.user_id, type: "purchase_paid",
            title: "Venda confirmada (pago)",
            message: `Pagamento de "${proj.title}" recebido via Multicaixa Express.`,
            link: "/freelancer",
          });
        }
      }
      if (purchase.buyer_user_id) {
        await admin.from("notifications").insert({
          user_id: purchase.buyer_user_id, type: "download_ready",
          title: "Pagamento confirmado",
          message: "O teu projecto está pronto para descarregar.",
          link: "/dashboard",
        });
      }
    }
    return ok({ status: rawStatus });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("freelancer-payment-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
