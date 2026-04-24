import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PROJECT = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_BASE = `https://${PROJECT}.supabase.co/functions/v1/download-invoice`;

/**
 * Baixa o PDF da factura via edge function.
 * Não toca na base de dados directamente — passa por edge function autenticada.
 *
 * @param invoiceNumber  Ex.: "MX-2026-00001"
 * @param mode           "download" força guardar; "view" abre numa nova aba.
 */
export async function downloadInvoice(invoiceNumber: string, mode: "download" | "view" = "download") {
  if (!invoiceNumber) { toast.error("Factura sem número"); return; }
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) { toast.error("Sessão expirada — entra novamente"); return; }

  const url = `${FN_BASE}/${invoiceNumber}.pdf`;

  // Pequeno indicador
  const tid = toast.loading("A preparar factura…");
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    if (mode === "view") {
      window.open(objectUrl, "_blank", "noopener,noreferrer");
    } else {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    toast.success(mode === "view" ? "Factura aberta" : "Download iniciado", { id: tid });
  } catch (err: any) {
    toast.error("Não foi possível abrir a factura: " + (err.message || "erro"), { id: tid });
  }
}
