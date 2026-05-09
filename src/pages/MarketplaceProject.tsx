import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingBag, MessageSquare, Code2, Check, Loader2, Upload, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { formatKz } from "@/lib/site";
import { toast } from "sonner";

interface Project {
  id: string; slug: string; title: string; description: string | null;
  language: string | null; category: string | null; price: number; currency: string;
  cover_url: string | null; demo_url: string | null; features: any;
  freelancer_id: string; sales_count: number;
}

const MarketplaceProject = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [freelancer, setFreelancer] = useState<any>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("freelancer_projects").select("*").eq("slug", slug!).maybeSingle();
      if (!data) return;
      setProject(data as Project);
      const { data: f } = await supabase.from("freelancers").select("*").eq("id", data.freelancer_id).maybeSingle();
      setFreelancer(f);
    })();
  }, [slug]);

  if (!project) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">A carregar…</div>;

  const features: string[] = Array.isArray(project.features) ? project.features : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/marketplace"><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <p className="font-bold truncate">{project.title}</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-5 grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div>
          <div className="aspect-video rounded-3xl overflow-hidden bg-gradient-to-br from-primary/15 to-primary/5 mb-4">
            {project.cover_url ? (
              <img src={project.cover_url} alt={project.title} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full"><Code2 className="h-20 w-20 text-primary/40" /></div>
            )}
          </div>
          {project.language && <span className="inline-block text-[11px] font-bold bg-foreground text-background px-3 py-1 rounded-full uppercase tracking-wider mb-3">{project.language}</span>}
          <h1 className="text-3xl font-display font-extrabold mb-2">{project.title}</h1>
          {project.description && <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>}

          {features.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold mb-3">O que está incluído</h3>
              <ul className="space-y-2">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0 mt-0.5" /><span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {project.demo_url && (
            <a href={project.demo_url} target="_blank" rel="noopener" className="inline-block mt-4 text-sm text-primary font-bold hover:underline">
              Ver demo →
            </a>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 self-start">
          <div className="bg-background rounded-3xl border border-border p-5 shadow-medium">
            <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Preço</p>
            <p className="text-4xl font-display font-extrabold gradient-text mb-1">{formatKz(project.price)}</p>
            <p className="text-xs text-muted-foreground mb-4">{project.sales_count} vendas</p>

            <Button onClick={() => setBuyOpen(true)} className="w-full h-12 rounded-2xl bg-gradient-blue text-white font-bold mb-2">
              <ShoppingBag className="h-4 w-4 mr-2" />Comprar agora
            </Button>
            <Button onClick={() => setContractOpen(true)} variant="outline" className="w-full h-12 rounded-2xl font-bold">
              <MessageSquare className="h-4 w-4 mr-2" />Contratar personalizado
            </Button>

            {freelancer && (
              <div className="mt-5 pt-5 border-t border-border flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-blue text-white flex items-center justify-center font-bold">
                  {freelancer.avatar_url ? <img src={freelancer.avatar_url} alt="" className="w-full h-full object-cover" /> : (freelancer.full_name || "?").charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{freelancer.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{freelancer.specialty || "Freelancer"}</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <CheckoutModal open={buyOpen} setOpen={setBuyOpen} project={project} user={user} profile={profile} />
      <ContractModal open={contractOpen} setOpen={setContractOpen} freelancerId={project.freelancer_id} user={user} profile={profile} />
    </div>
  );
};

const CheckoutModal = ({ open, setOpen, project, user, profile }: any) => {
  const [step, setStep] = useState<"form" | "pay" | "proof">("form");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [iban, setIban] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [purchase, setPurchase] = useState<any>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    if (open && user) {
      setEmail(user.email || "");
      setName(profile?.full_name || "");
      setPhone(profile?.phone || "");
    }
  }, [open, user, profile]);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("freelancer-checkout", {
        body: { project_id: project.id, buyer_email: email, buyer_phone: phone, buyer_iban: iban, buyer_name: name },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setPurchase((data as any).purchase);
      setPaymentInfo((data as any).payment);
      setStep("pay");
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally { setBusy(false); }
  };

  const uploadProof = async () => {
    if (!proofFile || !purchase) return;
    setBusy(true);
    try {
      const path = `${user?.id || "guest"}/${purchase.id}-${Date.now()}-${proofFile.name}`;
      const { error: upErr } = await supabase.storage.from("chat-uploads").upload(path, proofFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      const { error: updErr } = await supabase.from("freelancer_purchases").update({
        proof_url: pub.publicUrl, status: "proof_uploaded",
      }).eq("id", purchase.id);
      if (updErr) throw updErr;
      toast.success("Comprovativo enviado! Aguarda confirmação do freelancer.");
      setOpen(false);
      setStep("form"); setProofFile(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado"); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{step === "form" ? "Comprar projecto" : step === "pay" ? "Pagar via PlinqPay" : "Enviar comprovativo"}</DialogTitle></DialogHeader>

        {step === "form" && (
          <form onSubmit={submitForm} className="space-y-3">
            <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required className="rounded-xl h-11" /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl h-11" /></div>
            <div><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="9XX XXX XXX" className="rounded-xl h-11" /></div>
            <div><Label>IBAN (opcional)</Label><Input value={iban} onChange={e => setIban(e.target.value)} placeholder="AO06..." className="rounded-xl h-11" /></div>
            <div className="bg-secondary rounded-xl p-3 text-sm flex justify-between"><span>Total</span><span className="font-bold">{formatKz(project.price)}</span></div>
            <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar para pagamento"}
            </Button>
          </form>
        )}

        {step === "pay" && paymentInfo && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Faz o pagamento via Multicaixa Express ou ATM com estes dados:</p>
            <div className="space-y-2">
              {[["Entidade", paymentInfo.entity], ["Referência", paymentInfo.reference], ["Valor", formatKz(paymentInfo.amount)]].map(([l, v]) => (
                <button key={l} onClick={() => copy(String(v))} className="w-full bg-secondary rounded-xl p-3 flex justify-between items-center hover:bg-secondary/70">
                  <div className="text-left"><p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{l}</p><p className="font-mono font-bold">{v}</p></div>
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
            <Button onClick={() => setStep("proof")} className="w-full h-12 rounded-xl bg-foreground text-background font-bold">Já paguei — enviar comprovativo</Button>
          </div>
        )}

        {step === "proof" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Envia uma foto/captura do comprovativo. O freelancer confirmará e libertará o download.</p>
            <input type="file" accept="image/*,.pdf" onChange={e => setProofFile(e.target.files?.[0] || null)} className="w-full text-sm" />
            {proofFile && <p className="text-xs text-success">✓ {proofFile.name}</p>}
            <Button onClick={uploadProof} disabled={!proofFile || busy} className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-2" />Enviar</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ContractModal = ({ open, setOpen, freelancerId, user, profile }: any) => {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [iban, setIban] = useState(""); const [desc, setDesc] = useState(""); const [budget, setBudget] = useState("");
  const [days, setDays] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && user) { setEmail(user.email || ""); setName(profile?.full_name || ""); setPhone(profile?.phone || ""); }
  }, [open, user, profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const { error } = await supabase.from("freelancer_contracts").insert({
        freelancer_id: freelancerId,
        client_user_id: user?.id || null,
        client_name: name, client_email: email, client_phone: phone, client_iban: iban || null,
        project_description: desc,
        budget: budget ? Number(budget) : null,
        deadline_days: days ? Number(days) : null,
      });
      if (error) throw error;
      toast.success("Pedido enviado! O freelancer vai responder em breve.");
      setOpen(false); setDesc(""); setBudget(""); setDays(""); setIban("");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Contratar personalizado</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required className="rounded-xl h-11" /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl h-11" /></div>
          <div><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} required className="rounded-xl h-11" /></div>
          <div><Label>IBAN</Label><Input value={iban} onChange={e => setIban(e.target.value)} placeholder="AO06..." className="rounded-xl h-11" /></div>
          <div><Label>Descrição do projecto</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} required rows={4} placeholder="O que precisas? Funcionalidades, estilo, referências…" className="rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Orçamento (Kz)</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="rounded-xl h-11" /></div>
            <div><Label>Prazo (dias)</Label><Input type="number" value={days} onChange={e => setDays(e.target.value)} className="rounded-xl h-11" /></div>
          </div>
          <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar pedido"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MarketplaceProject;
