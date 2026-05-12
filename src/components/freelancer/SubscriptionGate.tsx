import { useEffect, useState } from "react";
import { Loader2, Check, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatKz } from "@/lib/site";
import { toast } from "sonner";

interface Props {
  freelancerId: string;
  active: boolean;
  onActivated: () => void;
  children: React.ReactNode;
}

export const SubscriptionGate = ({ freelancerId, active, onActivated, children }: Props) => {
  const { profile } = useAuth();
  const [step, setStep] = useState<"idle" | "form" | "waiting" | "success" | "failed">("idle");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [reference, setReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (active) setStep("success");
  }, [active]);

  // Polling
  useEffect(() => {
    if (step !== "waiting" || !reference) return;
    let attempts = 0;
    const id = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/freelancer-payment-status?reference=${encodeURIComponent(reference)}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        const data = await r.json();
        if (data.status === "paid") {
          clearInterval(id);
          setStep("success");
          toast.success("Subscrição activa! Já podes publicar.");
          onActivated();
        } else if (data.status === "failed") {
          clearInterval(id);
          setErrorMsg("Pagamento falhou ou foi cancelado.");
          setStep("failed");
        } else if (attempts >= 60) {
          clearInterval(id);
          setErrorMsg("Tempo esgotado. Tenta novamente.");
          setStep("failed");
        }
      } catch {/* ignore */}
    }, 3000);
    return () => clearInterval(id);
  }, [step, reference, onActivated]);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("freelancer-subscribe", {
        body: { phone },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setReference((data as any).payment.reference);
      setStep("waiting");
      toast.success("Push enviado para o teu MCX Express.");
    } catch (e: any) {
      setErrorMsg(e.message || "Erro");
      toast.error(e.message || "Erro");
    } finally { setBusy(false); }
  };

  if (active) return <>{children}</>;

  if (step === "waiting") {
    return (
      <div className="bg-background rounded-3xl border border-border p-8 text-center max-w-md mx-auto">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
        <h3 className="font-display font-extrabold text-lg mb-1">A aguardar confirmação</h3>
        <p className="text-sm text-muted-foreground">
          Aceita o pagamento de <b>{formatKz(2500)}</b> na app Multicaixa Express ({phone}).
        </p>
      </div>
    );
  }

  if (step === "failed") {
    return (
      <div className="bg-background rounded-3xl border border-border p-8 text-center max-w-md mx-auto">
        <p className="text-destructive mb-4">{errorMsg}</p>
        <Button onClick={() => setStep("form")} className="rounded-full">Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="bg-background rounded-3xl border border-border p-6 md:p-8 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-gradient-blue flex items-center justify-center mb-4">
        <CreditCard className="h-6 w-6 text-white" />
      </div>
      <h3 className="font-display font-extrabold text-xl mb-1">Activa a tua subscrição</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Para publicar e vender projectos no marketplace paga <b>{formatKz(2500)}/mês</b> via Multicaixa Express.
      </p>
      <ul className="space-y-2 text-sm mb-5">
        {[
          "Publica projectos ilimitados",
          "Recebe contratos personalizados",
          "Recebes 93% de cada venda (taxa 7%)",
          "Pagamento automático via MCX Express",
        ].map(t => (
          <li key={t} className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" />{t}</li>
        ))}
      </ul>
      <form onSubmit={subscribe} className="space-y-3">
        <div>
          <Label>Telefone Multicaixa Express</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} required maxLength={9}
            placeholder="9XXXXXXXX" className="rounded-xl h-11" />
        </div>
        <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pagar ${formatKz(2500)} agora`}
        </Button>
      </form>
    </div>
  );
};
