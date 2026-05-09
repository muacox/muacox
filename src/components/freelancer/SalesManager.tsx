import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Eye, ShoppingBag, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatKz } from "@/lib/site";
import { toast } from "sonner";

interface Purchase {
  id: string; project_id: string; buyer_email: string; buyer_phone: string;
  buyer_iban: string | null; buyer_name: string | null; amount: number;
  platform_fee: number; freelancer_payout: number; status: string;
  payment_reference: string | null; proof_url: string | null;
  download_token: string | null; created_at: string;
}

const STATUS = {
  pending: { label: "Aguarda pagamento", cls: "bg-warning/15 text-warning" },
  proof_uploaded: { label: "Comprovativo enviado", cls: "bg-primary/15 text-primary" },
  paid: { label: "Pago", cls: "bg-success/15 text-success" },
  released: { label: "Libertado", cls: "bg-success/15 text-success" },
  refunded: { label: "Reembolsado", cls: "bg-destructive/15 text-destructive" },
} as const;

export const SalesManager = ({ freelancerId }: { freelancerId: string }) => {
  const [sales, setSales] = useState<Purchase[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("freelancer_purchases").select("*").eq("freelancer_id", freelancerId).order("created_at", { ascending: false });
    const list = (data || []) as Purchase[];
    setSales(list);
    const ids = Array.from(new Set(list.map(s => s.project_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("freelancer_projects").select("id,title").in("id", ids);
      const m: Record<string, string> = {};
      (ps || []).forEach((p: any) => { m[p.id] = p.title; });
      setTitles(m);
    }
  };
  useEffect(() => {
    load();
    const ch = supabase.channel(`fp-sales-${freelancerId}`).on("postgres_changes",
      { event: "*", schema: "public", table: "freelancer_purchases", filter: `freelancer_id=eq.${freelancerId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [freelancerId]);

  const confirmPaid = async (id: string) => {
    setBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("freelancer-payment-confirm", { body: { purchase_id: id } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Pagamento confirmado e download libertado!");
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  if (sales.length === 0) {
    return (
      <div className="text-center py-16 bg-background rounded-2xl border border-dashed border-border">
        <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Sem vendas ainda.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sales.map(s => {
        const st = STATUS[s.status as keyof typeof STATUS] || STATUS.pending;
        return (
          <div key={s.id} className="bg-background rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-bold truncate">{titles[s.project_id] || "Projecto"}</p>
                <p className="text-xs text-muted-foreground">{s.buyer_name || s.buyer_email}</p>
                <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-AO")}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${st.cls} shrink-0`}>{st.label}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs my-3">
              <div><p className="text-muted-foreground">Total</p><p className="font-bold">{formatKz(s.amount)}</p></div>
              <div><p className="text-muted-foreground">Plataforma 15%</p><p className="font-bold text-destructive">-{formatKz(s.platform_fee)}</p></div>
              <div><p className="text-muted-foreground">Para ti</p><p className="font-bold text-success">{formatKz(s.freelancer_payout)}</p></div>
            </div>

            <div className="text-xs space-y-1 mb-3 bg-secondary/50 rounded-lg p-2">
              <p>📞 {s.buyer_phone}</p>
              {s.buyer_iban && <p className="font-mono">🏦 {s.buyer_iban}</p>}
              {s.payment_reference && (
                <button onClick={() => { navigator.clipboard.writeText(s.payment_reference!); toast.success("Copiado"); }} className="font-mono flex items-center gap-1 hover:text-primary">
                  REF: {s.payment_reference} <Copy className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {s.proof_url && (
                <a href={s.proof_url} target="_blank" rel="noopener" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full rounded-lg"><Eye className="h-3.5 w-3.5 mr-1" />Ver comprovativo</Button>
                </a>
              )}
              {(s.status === "proof_uploaded" || s.status === "pending") && (
                <Button size="sm" onClick={() => confirmPaid(s.id)} disabled={busy === s.id} className="flex-1 rounded-lg bg-success text-white hover:bg-success/90">
                  {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Confirmar pago</>}
                </Button>
              )}
              {s.status === "released" && (
                <p className="text-xs text-success font-bold">✓ Cliente recebeu link de download</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
