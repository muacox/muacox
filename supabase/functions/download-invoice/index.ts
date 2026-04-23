// Securely stream an invoice PDF.
// Two access modes:
//   1) /download-invoice/MX-2026-00001.pdf  + Authorization header (admin / order owner / assigned freelancer)
//   2) /download-invoice/MX-2026-00001.pdf?token=<one-time-token>  (anyone with the link, expires in 7 days)
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
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    let file = parts[parts.length - 1] || "";
    if (!file.endsWith(".pdf")) file = url.searchParams.get("file") || "";
    if (!file || !/^MX-\d{4}-\d{4,6}\.pdf$/.test(file)) {
      return text("Factura inválida", 400);
    }
    const invoiceNumber = file.replace(/\.pdf$/, "");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Look up the order
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, user_id, assigned_to, invoice_number")
      .eq("invoice_number", invoiceNumber)
      .maybeSingle();
    if (orderErr || !order) return text("Factura não encontrada", 404);

    // ── Permission gate
    let allowed = false;
    let reason = "";

    // Mode 1: one-time token
    const token = url.searchParams.get("token");
    if (token) {
      const { data: t } = await admin
        .from("invoice_download_tokens")
        .select("token, order_id, expires_at, used_count")
        .eq("token", token)
        .eq("order_id", order.id)
        .maybeSingle();
      if (t && new Date(t.expires_at) > new Date()) {
        allowed = true; reason = "token";
        await admin.from("invoice_download_tokens")
          .update({ used_count: (t.used_count || 0) + 1 })
          .eq("token", token);
      } else {
        return text("Link expirado ou inválido", 403);
      }
    }

    // Mode 2: authenticated user
    if (!allowed) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return text("Não autenticado", 401);
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return text("Sessão inválida", 401);

      // Owner of the order?
      if (order.user_id === user.id) { allowed = true; reason = "owner"; }
      // Admin?
      if (!allowed) {
        const { data: roleRow } = await admin.from("user_roles")
          .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (roleRow) { allowed = true; reason = "admin"; }
      }
      // Assigned freelancer?
      if (!allowed && order.assigned_to === user.id) {
        const { data: f } = await admin.from("freelancers")
          .select("id").eq("user_id", user.id).eq("status", "active").maybeSingle();
        if (f) { allowed = true; reason = "freelancer"; }
      }
      if (!allowed) return text("Sem permissão para esta factura", 403);
    }

    // ── Stream the PDF
    const { data, error } = await admin.storage.from("invoices").download(file);
    if (error || !data) return text("Ficheiro não encontrado", 404);

    const buf = await data.arrayBuffer();
    return new Response(buf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file}"`,
        "Cache-Control": "private, max-age=60, no-store",
        "X-Access-Reason": reason,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err: any) {
    return text("Erro: " + (err.message || "desconhecido"), 500);
  }
});

function text(msg: string, status = 200) {
  return new Response(msg, { status, headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } });
}
