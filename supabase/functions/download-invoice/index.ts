// Stream an invoice PDF from Storage via the edge function.
// URL format: /functions/v1/download-invoice/MX-2026-00001.pdf
// This avoids exposing direct Supabase storage URLs in the frontend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Path looks like /download-invoice/MX-2026-00001.pdf
    const parts = url.pathname.split("/").filter(Boolean);
    let file = parts[parts.length - 1] || "";
    // Allow ?file=... fallback
    if (!file.endsWith(".pdf")) file = url.searchParams.get("file") || "";
    if (!file || !/^MX-\d{4}-\d{4,6}\.pdf$/.test(file)) {
      return new Response("Factura inválida", { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin.storage.from("invoices").download(file);
    if (error || !data) {
      return new Response("Factura não encontrada", { status: 404, headers: corsHeaders });
    }

    const buf = await data.arrayBuffer();
    return new Response(buf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: any) {
    return new Response("Erro: " + (err.message || "desconhecido"), { status: 500, headers: corsHeaders });
  }
});
