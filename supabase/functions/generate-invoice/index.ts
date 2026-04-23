// Generate invoice PDF for a paid order — Modelo Angolano Premium
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://owtcqvefxjncwunhkxdc.supabase.co/storage/v1/object/public/public-assets/muacox-logo.png";
const SITE_URL = "muacox.wuaze.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Apenas admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id;
    if (!orderId) return json({ error: "order_id obrigatório" }, 400);

    const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return json({ error: "Pedido não encontrado" }, 404);

    let planName = "Serviço personalizado";
    let planCategory = "";
    if (order.plan_id) {
      const { data: plan } = await admin.from("service_plans").select("name, category").eq("id", order.plan_id).maybeSingle();
      if (plan) { planName = plan.name; planCategory = plan.category; }
    }

    let profile: any = null;
    if (order.user_id) {
      const { data } = await admin.from("profiles").select("full_name, phone, address, tax_id").eq("user_id", order.user_id).maybeSingle();
      profile = data;
    }

    let invoiceNumber = order.invoice_number;
    if (!invoiceNumber) {
      let num: number = Date.now() % 100000;
      try {
        const { data: rpcData } = await admin.rpc("next_invoice_number" as any);
        if (typeof rpcData === "number") num = rpcData;
        else if (rpcData != null) num = Number(rpcData);
      } catch (_e) { /* fallback */ }
      invoiceNumber = `MX-${new Date().getFullYear()}-${String(num).padStart(5, "0")}`;
    }

    // Fetch logo as base64
    let logoData: string | null = null;
    try {
      const r = await fetch(LOGO_URL);
      if (r.ok) {
        const buf = new Uint8Array(await r.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        logoData = "data:image/png;base64," + btoa(bin);
      }
    } catch (_e) { /* ignore */ }

    const pdf = buildPDF({
      invoiceNumber,
      issueDate: new Date(),
      paidDate: order.paid_at ? new Date(order.paid_at) : new Date(),
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      address: profile?.address || "",
      taxId: profile?.tax_id || "",
      serviceName: planName,
      serviceCategory: planCategory || order.service_type || "Serviço",
      notes: order.notes || "",
      amount: Number(order.amount),
      currency: order.currency || "AOA",
      logoData,
    });

    const pdfBytes = pdf.output("arraybuffer");
    const path = `${invoiceNumber}.pdf`;
    const { error: upErr } = await admin.storage.from("invoices")
      .upload(path, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: true });
    if (upErr) return json({ error: upErr.message }, 500);

    // Use the secure download endpoint instead of exposing the raw storage URL
    const downloadUrl = `${supabaseUrl}/functions/v1/download-invoice/${path}`;

    await admin.from("orders").update({
      invoice_url: downloadUrl,
      invoice_number: invoiceNumber,
      service_type: planCategory || order.service_type,
    }).eq("id", orderId);

    if (order.user_id) {
      await admin.from("notifications").insert({
        user_id: order.user_id,
        title: "Factura disponível",
        message: `A tua factura ${invoiceNumber} já está disponível para download.`,
        type: "invoice",
        link: downloadUrl,
      });
    }

    return json({ url: downloadUrl, invoice_number: invoiceNumber });
  } catch (err: any) {
    console.error("invoice error", err);
    return json({ error: err.message || "Erro" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildPDF(d: {
  invoiceNumber: string; issueDate: Date; paidDate: Date;
  customerName: string; customerEmail: string; customerPhone: string;
  address: string; taxId: string;
  serviceName: string; serviceCategory: string; notes: string;
  amount: number; currency: string;
  logoData: string | null;
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-AO", { style: "currency", currency: d.currency, maximumFractionDigits: 2 }).format(n);
  const date = (dt: Date) => dt.toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });

  // ─── Cores Modelo Angolano Premium ───
  const PRIMARY: [number, number, number] = [0, 70, 255];      // Azul real
  const ACCENT: [number, number, number] = [220, 38, 38];      // Vermelho Angola
  const GOLD: [number, number, number] = [234, 179, 8];        // Dourado Angola
  const DARK: [number, number, number] = [17, 24, 39];         // Texto principal
  const MUTED: [number, number, number] = [107, 114, 128];     // Texto secundário
  const LIGHT: [number, number, number] = [243, 244, 246];     // Fundo claro

  // ═══ HEADER (faixa azul com triângulos angolanos) ═══
  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 0, W, 60, "F");

  // Faixa decorativa dourada e vermelha (cores de Angola)
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 60, W, 1.5, "F");
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, 61.5, W, 1.5, "F");

  // Triângulos decorativos (estilo Angola)
  pdf.setFillColor(255, 255, 255);
  pdf.setGState(new (pdf as any).GState({ opacity: 0.06 }));
  pdf.triangle(W - 60, 0, W, 0, W, 60, "F");
  pdf.triangle(W - 25, 0, W - 5, 0, W - 5, 25, "F");
  pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

  // ─── Logo ───
  if (d.logoData) {
    try {
      pdf.addImage(d.logoData, "PNG", 12, 10, 26, 26);
    } catch (_e) { /* ignore image errors */ }
  }

  // ─── Brand text ───
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.text("MuacoX", 42, 22);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("Estúdio digital · Luanda, Angola", 42, 28);
  pdf.setFontSize(7.5);
  pdf.text("+244 943 443 400  ·  isaacmuaco528@gmail.com", 42, 33);
  pdf.text(SITE_URL, 42, 38);

  // ─── FACTURA label (right) ───
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("FACTURA", W - 14, 20, { align: "right" });

  // Pill PAGA
  pdf.setFillColor(34, 197, 94);
  pdf.roundedRect(W - 38, 24, 24, 6.5, 3.25, 3.25, "F");
  pdf.setFontSize(8);
  pdf.text("PAGA", W - 26, 28.5, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(`Nº ${d.invoiceNumber}`, W - 14, 36, { align: "right" });
  pdf.setFontSize(7.5);
  pdf.text(`Emitida: ${date(d.issueDate)}`, W - 14, 41, { align: "right" });
  pdf.text(`Paga em: ${date(d.paidDate)}`, W - 14, 45, { align: "right" });

  // ═══ Reset cor texto ═══
  pdf.setTextColor(...DARK);

  // ═══ FACTURAR A (esquerda) ═══
  let y = 78;
  pdf.setFillColor(...LIGHT);
  pdf.roundedRect(12, y - 5, 88, 42, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...PRIMARY);
  pdf.text("FACTURAR A", 16, y);
  pdf.setTextColor(...DARK);
  pdf.setFontSize(11.5);
  pdf.text(d.customerName.substring(0, 35), 16, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  let cy = y + 12;
  pdf.text(d.customerEmail.substring(0, 40), 16, cy); cy += 4;
  pdf.text(d.customerPhone, 16, cy); cy += 4;
  if (d.address) { pdf.text(`Morada: ${d.address.substring(0, 38)}`, 16, cy); cy += 4; }
  if (d.taxId) { pdf.text(`NIF: ${d.taxId}`, 16, cy); cy += 4; }

  // ═══ EMITIDA POR (direita) ═══
  pdf.setFillColor(...LIGHT);
  pdf.roundedRect(110, y - 5, 88, 42, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...PRIMARY);
  pdf.text("EMITIDA POR", 114, y);
  pdf.setTextColor(...DARK);
  pdf.setFontSize(11.5);
  pdf.text("MuacoX — Estúdio Digital", 114, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  let ey = y + 12;
  pdf.text("Luanda, Angola", 114, ey); ey += 4;
  pdf.text("+244 943 443 400", 114, ey); ey += 4;
  pdf.text("isaacmuaco528@gmail.com", 114, ey); ey += 4;
  pdf.text(SITE_URL, 114, ey); ey += 4;

  // ═══ TABELA DE SERVIÇOS ═══
  y = 132;
  pdf.setFillColor(...PRIMARY);
  pdf.roundedRect(12, y, W - 24, 10, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Nº", 17, y + 6.5);
  pdf.text("DESCRIÇÃO DO SERVIÇO", 26, y + 6.5);
  pdf.text("CATEGORIA", 120, y + 6.5);
  pdf.text("VALOR (Kz)", W - 17, y + 6.5, { align: "right" });

  // Linha de serviço
  y += 14;
  pdf.setDrawColor(229, 231, 235);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(12, y - 3, W - 24, 16, 2, 2, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...DARK);
  pdf.text("01", 17, y + 4);
  pdf.text(d.serviceName.substring(0, 45), 26, y + 4);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  const catLabel = d.serviceCategory === "website" ? "Criação de site"
                 : d.serviceCategory === "hosting" ? "Hospedagem web"
                 : d.serviceCategory === "flyer" ? "Design gráfico"
                 : d.serviceCategory;
  pdf.text(catLabel, 120, y + 4);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...DARK);
  pdf.text(fmt(d.amount), W - 17, y + 4, { align: "right" });

  // Notas dentro da linha
  if (d.notes) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    const lines = pdf.splitTextToSize(d.notes.substring(0, 150), 90);
    pdf.text(lines.slice(0, 1), 26, y + 9);
  }

  // ═══ TOTAIS ═══
  y += 24;
  const totalsX = W - 90;

  pdf.setDrawColor(229, 231, 235);
  pdf.line(totalsX, y, W - 12, y);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text("Subtotal", totalsX, y + 6);
  pdf.setTextColor(...DARK);
  pdf.text(fmt(d.amount), W - 14, y + 6, { align: "right" });

  pdf.setTextColor(...MUTED);
  pdf.text("IVA (Isento — RT)", totalsX, y + 12);
  pdf.setTextColor(...DARK);
  pdf.text("0,00 Kz", W - 14, y + 12, { align: "right" });

  // Box total
  y += 18;
  pdf.setFillColor(...PRIMARY);
  pdf.roundedRect(totalsX - 2, y, W - totalsX - 10, 16, 2.5, 2.5, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("TOTAL PAGO", totalsX + 2, y + 6.5);
  pdf.setFontSize(13);
  pdf.text(fmt(d.amount), W - 14, y + 11, { align: "right" });

  // ═══ Observações fiscais (modelo Angola) ═══
  y += 28;
  pdf.setTextColor(...DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("OBSERVAÇÕES", 12, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  pdf.text("Documento processado pelo sistema MuacoX. Isento de IVA nos termos do Regime de Transparência Fiscal.", 12, y + 5);
  pdf.text(`Pagamento confirmado e validado pela administração em ${date(d.paidDate)}.`, 12, y + 9);
  pdf.text(`Para autenticação ou questões: WhatsApp +244 943 443 400  ·  ${SITE_URL}`, 12, y + 13);

  // ═══ Mensagem de agradecimento ═══
  y += 24;
  pdf.setFillColor(...LIGHT);
  pdf.roundedRect(12, y, W - 24, 18, 3, 3, "F");
  pdf.setTextColor(...PRIMARY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Obrigado pela tua confiança em nós.", 18, y + 7);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  pdf.text("Continuamos a criar a presença digital que o teu negócio merece.", 18, y + 13);

  // ═══ FOOTER ═══
  pdf.setFillColor(...DARK);
  pdf.rect(0, H - 22, W, 22, "F");

  // Mini stripe Angola colors no footer
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, H - 22, W / 2, 1, "F");
  pdf.setFillColor(0, 0, 0);
  pdf.rect(W / 2, H - 22, W / 2, 1, "F");
  pdf.setFillColor(...GOLD);
  pdf.rect(W / 2 - 8, H - 22, 16, 1, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("MuacoX", 12, H - 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(180, 190, 210);
  pdf.text("Sites · Hospedagem · Design Gráfico · Marketing Digital", 12, H - 7);

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(`Factura ${d.invoiceNumber}`, W - 12, H - 12, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(180, 190, 210);
  pdf.text(SITE_URL, W - 12, H - 7, { align: "right" });

  return pdf;
}
