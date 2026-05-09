import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userRes } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { purchase_id } = await req.json();
    if (!purchase_id) {
      return new Response(JSON.stringify({ error: "purchase_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica que o utilizador é o freelancer dono OU admin
    const { data: purchase } = await admin
      .from("freelancer_purchases")
      .select("id, freelancer_id, status, buyer_user_id, project_id")
      .eq("id", purchase_id)
      .maybeSingle();

    if (!purchase) {
      return new Response(JSON.stringify({ error: "Compra não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    const { data: fr } = await admin.from("freelancers").select("id").eq("id", purchase.freelancer_id).eq("user_id", userId).maybeSingle();

    if (!isAdmin && !fr) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (purchase.status === "released") {
      return new Response(JSON.stringify({ success: true, already_released: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = crypto.randomUUID() + "-" + Math.random().toString(36).slice(2, 10);
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { error: updErr } = await admin
      .from("freelancer_purchases")
      .update({
        status: "released",
        paid_at: now,
        released_at: now,
        download_token: token,
        download_expires_at: expires,
      })
      .eq("id", purchase_id);

    if (updErr) throw new Error(updErr.message);

    // Incrementar sales_count
    await admin.rpc("execute_sql" as any, {}).catch(() => null);
    const { data: proj } = await admin.from("freelancer_projects").select("sales_count, title").eq("id", purchase.project_id).maybeSingle();
    if (proj) {
      await admin.from("freelancer_projects").update({ sales_count: (proj.sales_count || 0) + 1 }).eq("id", purchase.project_id);
    }

    // Notificar comprador
    if (purchase.buyer_user_id) {
      await admin.from("notifications").insert({
        user_id: purchase.buyer_user_id,
        type: "download_ready",
        title: "Download libertado",
        message: `O teu projecto "${proj?.title || ''}" está pronto para descarregar.`,
        link: "/dashboard",
      });
    }

    return new Response(JSON.stringify({
      success: true,
      download_url: `${SUPABASE_URL}/functions/v1/freelancer-download?token=${token}`,
      expires_at: expires,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("freelancer-payment-confirm error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
