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

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Token em falta", { status: 400, headers: corsHeaders });
    }

    const { data: purchase } = await admin
      .from("freelancer_purchases")
      .select("id, project_id, status, download_expires_at")
      .eq("download_token", token)
      .maybeSingle();

    if (!purchase || purchase.status !== "released") {
      return new Response("Link inválido ou pagamento não confirmado", { status: 404, headers: corsHeaders });
    }
    if (purchase.download_expires_at && new Date(purchase.download_expires_at) < new Date()) {
      return new Response("Link expirou", { status: 410, headers: corsHeaders });
    }

    const { data: project } = await admin
      .from("freelancer_projects")
      .select("files_path, title")
      .eq("id", purchase.project_id)
      .maybeSingle();

    if (!project?.files_path) {
      return new Response("Ficheiros não disponíveis", { status: 404, headers: corsHeaders });
    }

    const { data: signed, error: sErr } = await admin
      .storage
      .from("freelancer-files")
      .createSignedUrl(project.files_path, 60 * 10); // 10 min

    if (sErr || !signed?.signedUrl) {
      return new Response("Erro a gerar link", { status: 500, headers: corsHeaders });
    }

    return Response.redirect(signed.signedUrl, 302);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("freelancer-download error:", msg);
    return new Response(msg, { status: 500, headers: corsHeaders });
  }
});
