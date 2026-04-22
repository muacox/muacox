// Generate invoice PDF for a paid order
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);

    // Admin check
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Apenas admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id;
    if (!orderId) return json({ error: "order_id obrigatório" }, 400);

    // Fetch order + plan + profile
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

    // Sequential number from sequence (admin client bypasses RLS)
    let invoiceNumber = order.invoice_number;
    if (!invoiceNumber) {
      let num: number = Date.now() % 100000;
      try {
        const { data: seqRow } = await admin
          .from("orders").select("id").limit(0); // warm-up no-op
        // Use a raw query through the postgrest function we created
        const { data: rpcData } = await admin.rpc("next_invoice_number" as any);
        if (typeof rpcData === "number") num = rpcData;
        else if (rpcData != null) num = Number(rpcData);
      } catch (_e) { /* fallback to timestamp */ }
      invoiceNumber = `MX-${new Date().getFullYear()}-${String(num).padStart(5, "0")}`;
    }

    // Build PDF
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
    });

    const pdfBytes = pdf.output("arraybuffer");
    const path = `${invoiceNumber}.pdf`;
    const { error: upErr } = await admin.storage.from("invoices")
      .upload(path, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: true });
    if (upErr) return json({ error: upErr.message }, 500);
    const { data: pub } = admin.storage.from("invoices").getPublicUrl(path);

    // Update order with invoice url + number
    await admin.from("orders").update({
      invoice_url: pub.publicUrl,
      invoice_number: invoiceNumber,
      service_type: planCategory || order.service_type,
    }).eq("id", orderId);

    // Notify user
    if (order.user_id) {
      await admin.from("notifications").insert({
        user_id: order.user_id,
        title: "Factura disponível",
        message: `A tua factura ${invoiceNumber} já está disponível.`,
        type: "invoice",
        link: pub.publicUrl,
      });
    }

    return json({ url: pub.publicUrl, invoice_number: invoiceNumber });
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
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const fmt = (n: number) => new Intl.NumberFormat("pt-AO", { style: "currency", currency: d.currency, maximumFractionDigits: 0 }).format(n);
  const date = (dt: Date) => dt.toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });

  // Header band (royal blue)
  pdf.setFillColor(0, 70, 255);
  pdf.rect(0, 0, W, 55, "F");

  // Decorative circle
  pdf.setFillColor(255, 255, 255);
  pdf.setGState(new (pdf as any).GState({ opacity: 0.08 }));
  pdf.circle(W - 10, 10, 35, "F");
  pdf.circle(W - 30, 50, 20, "F");
  pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

  // Brand
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.text("MuacoX", 15, 25);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Estúdio digital premium", 15, 31);
  pdf.setFontSize(8);
  pdf.text("Luanda, Angola  ·  +244 943 443 400  ·  isaacmuaco528@gmail.com", 15, 37);

  // Invoice label (right)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("FACTURA", W - 15, 25, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(d.invoiceNumber, W - 15, 32, { align: "right" });
  pdf.setFontSize(8);
  pdf.text(`Emitida: ${date(d.issueDate)}`, W - 15, 38, { align: "right" });
  pdf.text(`Paga: ${date(d.paidDate)}`, W - 15, 43, { align: "right" });

  // Status pill
  pdf.setFillColor(34, 197, 94);
  pdf.roundedRect(W - 40, 46, 25, 6, 3, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("PAGA", W - 27.5, 50, { align: "center" });

  // Reset color
  pdf.setTextColor(20, 25, 40);

  // Bill to section
  let y = 75;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(0, 70, 255);
  pdf.text("FACTURAR A", 15, y);
  pdf.setTextColor(20, 25, 40);
  y += 6;
  pdf.setFontSize(13);
  pdf.text(d.customerName, 15, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(80, 90, 110);
  y += 5;
  pdf.text(d.customerEmail, 15, y); y += 4;
  pdf.text(d.customerPhone, 15, y); y += 4;
  if (d.address) { pdf.text(`Morada: ${d.address}`, 15, y); y += 4; }
  if (d.taxId) { pdf.text(`NIF: ${d.taxId}`, 15, y); y += 4; }

  // From section (right)
  let yr = 75;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(0, 70, 255);
  pdf.text("EMITIDA POR", W - 15, yr, { align: "right" });
  pdf.setTextColor(20, 25, 40);
  yr += 6;
  pdf.setFontSize(13);
  pdf.text("MuacoX", W - 15, yr, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(80, 90, 110);
  yr += 5;
  pdf.text("Isaac Muaco", W - 15, yr, { align: "right" }); yr += 4;
  pdf.text("Luanda, Angola", W - 15, yr, { align: "right" }); yr += 4;
  pdf.text("+244 943 443 400", W - 15, yr, { align: "right" }); yr += 4;

  // Service table header
  y = Math.max(y, yr) + 14;
  pdf.setFillColor(245, 247, 252);
  pdf.roundedRect(15, y, W - 30, 12, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(0, 70, 255);
  pdf.text("DESCRIÇÃO", 20, y + 8);
  pdf.text("CATEGORIA", 115, y + 8);
  pdf.text("VALOR", W - 20, y + 8, { align: "right" });

  // Service row
  y += 18;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(20, 25, 40);
  pdf.text(d.serviceName, 20, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 110, 130);
  const catLabel = d.serviceCategory === "website" ? "Criação de site"
                 : d.serviceCategory === "hosting" ? "Hospedagem"
                 : d.serviceCategory === "flyer" ? "Design de flyer"
                 : d.serviceCategory;
  pdf.text(catLabel, 115, y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(20, 25, 40);
  pdf.text(fmt(d.amount), W - 20, y, { align: "right" });

  // Notes
  if (d.notes) {
    y += 8;
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 130, 150);
    const lines = pdf.splitTextToSize(d.notes, W - 70);
    pdf.text(lines, 20, y);
    y += lines.length * 4;
  }

  // Divider
  y += 10;
  pdf.setDrawColor(220, 225, 235);
  pdf.line(15, y, W - 15, y);

  // Totals
  y += 10;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 110, 130);
  pdf.text("Subtotal", W - 60, y);
  pdf.setTextColor(20, 25, 40);
  pdf.text(fmt(d.amount), W - 20, y, { align: "right" });
  y += 6;
  pdf.setTextColor(100, 110, 130);
  pdf.text("Taxa", W - 60, y);
  pdf.setTextColor(20, 25, 40);
  pdf.text("Isento", W - 20, y, { align: "right" });

  // Total box
  y += 10;
  pdf.setFillColor(0, 70, 255);
  pdf.roundedRect(W - 90, y, 75, 16, 3, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("TOTAL PAGO", W - 85, y + 7);
  pdf.setFontSize(14);
  pdf.text(fmt(d.amount), W - 20, y + 11, { align: "right" });

  // Thank you
  y += 30;
  pdf.setTextColor(0, 70, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Obrigado pela tua confiança!", 15, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 110, 130);
  y += 6;
  pdf.text("Esta factura comprova o pagamento dos serviços listados acima.", 15, y);
  y += 4;
  pdf.text("Para qualquer questão, contacta-nos via WhatsApp +244 943 443 400.", 15, y);

  // Footer
  pdf.setFillColor(15, 20, 35);
  pdf.rect(0, H - 22, W, 22, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("MuacoX", 15, H - 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(180, 190, 210);
  pdf.text("Sites · Hospedagem · Flyers", 15, H - 7);
  pdf.text(`Factura ${d.invoiceNumber}`, W - 15, H - 12, { align: "right" });
  pdf.text("muacox.lovable.app", W - 15, H - 7, { align: "right" });

  return pdf;
}
