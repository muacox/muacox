import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `És o "Designer IA da MuacoX" — um assistente que conversa em português de Angola e SÓ devolve CSS para alterar o **design visual** do site.

REGRAS CRÍTICAS (não podes violar):
1. NUNCA alteres textos, conteúdo, cópia, links ou estrutura HTML — apenas estilo.
2. Devolve APENAS um bloco CSS válido entre <css> e </css>. Nada de JS, nada de HTML.
3. Não uses @import, url() externo, expression(), behavior:, javascript:, nem nada que possa executar código.
4. Podes mudar cores (HSL), tipografia (font-family CSS já carregada — Sora, Inter), espaçamentos, bordas, sombras, gradientes, animações CSS, opacidade, blur.
5. Usa selectores específicos (classes, IDs, atributos data-*). Evita * e !important quando puderes.
6. Tudo é injectado num <style> global no fim do <head>, então o teu CSS sobrepõe-se ao tema base.
7. Antes do bloco <css>, escreve 1-2 frases curtas em português a explicar o que mudaste (sem markdown).
8. Se o pedido não for sobre design, recusa educadamente e não devolvas <css>.

Exemplo de resposta:
"Mudei a paleta para tons quentes de laranja e adicionei brilho nas caixas.
<css>
:root { --primary: 25 95% 55%; --primary-glow: 35 100% 60%; }
.bg-gradient-blue { background: linear-gradient(135deg, hsl(25 95% 55%), hsl(35 100% 60%)) !important; }
.liquid-glass { box-shadow: 0 12px 40px hsl(25 95% 55% / 0.25); }
</css>"`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    // Verify admin
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "Sem mensagens" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional: include the current active CSS so the AI can iterate
    const { data: active } = await admin.from("site_themes").select("css, name").eq("is_active", true).maybeSingle();
    const contextMsg = active?.css
      ? `CSS actualmente activo (tema "${active.name}"):\n${active.css.slice(0, 4000)}`
      : "Não existe tema activo — partes do tema base.";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: contextMsg },
          ...messages,
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite atingido. Tenta de novo em alguns segundos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adiciona créditos em Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Erro do gateway de IA" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const reply: string = data?.choices?.[0]?.message?.content || "";
    const cssMatch = reply.match(/<css>([\s\S]*?)<\/css>/i);
    let css = cssMatch ? cssMatch[1].trim() : "";
    // Strip dangerous patterns just in case
    css = css.replace(/@import[^;]*;/gi, "").replace(/expression\s*\(/gi, "").replace(/javascript:/gi, "");
    const explanation = reply.replace(/<css>[\s\S]*?<\/css>/i, "").trim();

    return new Response(JSON.stringify({ reply: explanation || "Pronto.", css }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("design-ai error:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
