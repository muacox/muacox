import { Link } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import {
  ArrowRight, Globe, Server, Image as ImageIcon, Mail, Phone, Check,
  LayoutDashboard, LogIn, Menu, X, Zap, Shield, Headphones, Rocket,
  Star, MapPin, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SITE, formatKz } from "@/lib/site";
import { AuthAvatarStrip } from "@/components/AuthAvatarStrip";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import logo from "@/assets/muacox-logo.png";
import isaacPhoto from "@/assets/isaac-muaco.webp";
import flyer1 from "@/assets/flyers/flyer-marketing.webp";
import flyer2 from "@/assets/flyers/flyer-freddy.webp";
import flyer3 from "@/assets/flyers/flyer-programador.webp";
import flyer4 from "@/assets/flyers/flyer-konsola.webp";
import flyer5 from "@/assets/flyers/flyer-voto.webp";

interface Plan {
  id: string; category: string; name: string; description: string;
  features: string[]; price: number; billing_cycle: string; highlighted: boolean;
}

const flyers = [
  { src: flyer1, title: "Marketing Digital" },
  { src: flyer2, title: "Branding Pessoal" },
  { src: flyer3, title: "Evento Tech" },
  { src: flyer4, title: "Konsola Wifi" },
  { src: flyer5, title: "Campanha Política" },
];

const Index = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paidCount, setPaidCount] = useState(0);
  const { scrollY } = useScroll();
  const { user } = useAuth();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = scrollY.getPrevious() ?? 0;
    if (latest > prev && latest > 120) setHidden(true);
    else setHidden(false);
  });

  useEffect(() => {
    supabase.from("service_plans").select("*").eq("active", true).order("display_order").then(({ data }) => {
      if (data) setPlans(data as any);
    });
    // Contagem real: apenas pedidos pagos/concluídos (admin marca pago após validar comprovativo)
    const loadCount = () => {
      supabase.from("orders").select("id", { count: "exact", head: true })
        .in("status", ["paid", "completed"])
        .then(({ count }) => setPaidCount(count || 0));
    };
    loadCount();
    const ch = supabase.channel("public-orders-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const websitePlans = plans.filter(p => p.category === 'website');
  const hostingPlans = plans.filter(p => p.category === 'hosting');
  const flyerPlans = plans.filter(p => p.category === 'flyer');
  const cycleLabel = (c: string) => c === 'monthly' ? '/mês' : c === 'yearly' ? '/ano' : '';

  return (
    <div className="min-h-screen bg-background no-select">
      {/* NAV — App-style flutuante */}
      <motion.nav
        animate={{ y: hidden ? -100 : 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed top-3 inset-x-3 md:top-4 md:inset-x-6 z-50 rounded-2xl liquid-glass shadow-medium"
      >
        <div className="px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="MuacoX" className="h-12 md:h-14 w-auto" />
          </Link>
          <div className="hidden lg:flex items-center gap-7 text-[13px] font-semibold">
            <a href="#planos" className="hover:text-primary transition">Planos</a>
            <a href="#flyers" className="hover:text-primary transition">Flyers</a>
            <a href="#sobre" className="hover:text-primary transition">Sobre</a>
            <a href="#contacto" className="hover:text-primary transition">Contacto</a>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" className="rounded-xl bg-foreground text-background hover:bg-foreground/90 h-10 px-3 md:px-4">
                  <LayoutDashboard className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Painel</span>
                </Button>
              </Link>
            ) : (
              <Link to="/login" className="hidden sm:block">
                <Button size="sm" variant="ghost" className="rounded-xl font-semibold h-10">
                  <LogIn className="h-4 w-4 mr-1" />Entrar
                </Button>
              </Link>
            )}
            <a href={SITE.whatsapp} target="_blank" rel="noopener" className="hidden sm:block">
              <Button size="sm" className="rounded-xl bg-gradient-blue text-white shadow-soft hover:shadow-glow h-10">
                Orçamento <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </a>
            <button onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden p-2 rounded-xl hover:bg-secondary" aria-label="Menu">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="lg:hidden border-t border-border/50 px-4 py-4 flex flex-col gap-1 text-sm font-semibold overflow-hidden">
            {[["#planos", "Planos"], ["#flyers", "Flyers"], ["#sobre", "Sobre"], ["#contacto", "Contacto"]].map(([h, l]) => (
              <a key={h} onClick={() => setMobileOpen(false)} href={h} className="py-2.5 px-3 rounded-xl hover:bg-secondary">{l}</a>
            ))}
            {!user && (
              <div className="flex gap-2 pt-2">
                <Link to="/login" className="flex-1"><Button variant="outline" className="w-full rounded-xl">Entrar</Button></Link>
                <Link to="/cadastro" className="flex-1"><Button className="w-full rounded-xl bg-gradient-blue text-white">Criar conta</Button></Link>
              </div>
            )}
          </motion.div>
        )}
      </motion.nav>

      {/* HERO — App style com card grande */}
      <section className="pt-24 md:pt-28 pb-12 md:pb-20 mesh-bg relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-12 items-center max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <AuthAvatarStrip />
              <h1 className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-[-0.04em] leading-[0.95] mb-5">
                Sites que <span className="gradient-text">vendem</span>.<br />
                Flyers que <span className="gradient-text">impressionam</span>.
              </h1>
              <p className="text-base md:text-lg text-muted-foreground mb-7 max-w-xl">
                Criamos a presença digital do teu negócio em Angola — desde {formatKz(98000)}. Domínio + hospedagem + design tudo incluído.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="#planos">
                  <Button size="lg" className="w-full sm:w-auto rounded-2xl bg-foreground text-background hover:bg-foreground/90 h-14 px-7 text-[15px] font-bold">
                    Ver planos <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <a href={SITE.whatsapp} target="_blank" rel="noopener">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-2xl h-14 px-7 text-[15px] border-2 font-bold">
                    Falar agora
                  </Button>
                </a>
              </div>

              {/* Stats em row — sem bordas */}
              <div className="grid grid-cols-3 gap-3 md:gap-6 mt-10 max-w-md">
                {[[`${paidCount}+`, "Projectos"], ["100%", "Satisfação"], ["24/7", "Suporte"]].map(([n, l]) => (
                  <div key={l}>
                    <p className="text-2xl md:text-3xl font-display font-extrabold gradient-text">{n}</p>
                    <p className="text-[11px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">{l}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Mock device (Apple-style) */}
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }} className="relative hidden lg:block">
              <div className="relative aspect-[3/4] max-w-md mx-auto">
                <div className="absolute inset-0 bg-gradient-blue rounded-[3rem] rotate-6 opacity-20 blur-2xl" />
                <div className="relative bg-foreground rounded-[2.5rem] p-3 shadow-strong">
                  <div className="bg-gradient-blue rounded-[2rem] aspect-[3/4] p-6 flex flex-col justify-between text-white overflow-hidden relative">
                    <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
                    <div className="relative">
                      <p className="text-xs font-bold opacity-80 tracking-wider uppercase">Site Premium</p>
                      <p className="text-2xl font-display font-extrabold mt-2">Restaurante Sabor</p>
                    </div>
                    <div className="relative space-y-2">
                      {["Design responsivo", "SEO optimizado", "Domínio incluído"].map(s => (
                        <div key={s} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4" />{s}
                        </div>
                      ))}
                      <div className="pt-3 mt-3 border-t border-white/20 flex items-baseline justify-between">
                        <span className="text-xs opacity-70">desde</span>
                        <span className="text-2xl font-extrabold">{formatKz(98000)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap justify-center md:justify-between items-center gap-6 text-xs md:text-sm font-semibold text-muted-foreground">
            {[
              [Zap, "Entrega rápida"],
              [Shield, "Pagamento seguro"],
              [Headphones, "Suporte humano"],
              [Rocket, "Performance premium"],
              [MapPin, "100% Angolano"],
            ].map(([Icon, label]: any) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-7xl">
          <PlanGroup icon={Globe} tag="Criação de Sites" title="Sites profissionais"
            sub="Domínio + hospedagem incluídos. Entregamos chave-na-mão." plans={websitePlans} cycleLabel={cycleLabel} />

          <PlanGroup icon={Server} tag="Hospedagem" title="Planos de hospedagem"
            sub="Servidores rápidos, SSL grátis e suporte dedicado." plans={hostingPlans} cycleLabel={cycleLabel} />

          <PlanGroup icon={ImageIcon} tag="Design Gráfico" title="Criação de flyers"
            sub="Designs profissionais que convertem." plans={flyerPlans} cycleLabel={cycleLabel} last />
        </div>
      </section>

      {/* GALERIA */}
      <section id="flyers" className="py-20 md:py-28 bg-secondary/40">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-12 md:mb-14">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary mb-3">Portfolio</p>
            <h2 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight mb-3">Trabalhos recentes</h2>
            <p className="text-muted-foreground">Cada peça criada por <span className="text-foreground font-bold">{SITE.founder}</span></p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {flyers.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.06 }} whileHover={{ y: -6 }}
                className="group relative rounded-2xl md:rounded-3xl overflow-hidden bg-card aspect-[4/5] shadow-soft hover:shadow-strong transition-all">
                <img src={f.src} alt={f.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 to-transparent translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-white text-xs md:text-sm font-bold">{f.title}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section id="sobre" className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
              className="relative w-40 h-40 md:w-56 md:h-56 mx-auto md:mx-0">
              <div className="absolute inset-0 bg-gradient-blue rounded-3xl rotate-6" />
              <img src={isaacPhoto} alt={SITE.founder}
                className="absolute inset-0 w-full h-full object-cover rounded-3xl -rotate-3 shadow-strong" />
            </motion.div>
            <div className="text-center md:text-left">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary mb-3">Sobre</p>
              <h2 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight mb-3">{SITE.founder}</h2>
              <p className="text-primary font-semibold mb-4">Fundador & Criador da MuacoX</p>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                Programador e designer apaixonado por criar soluções digitais que ajudam empreendedores angolanos
                a conquistar o mercado online. Cada projecto é tratado como uma obra única.
              </p>
              <div className="flex items-center gap-1 mt-4 justify-center md:justify-start">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-4 w-4 fill-warning text-warning" />)}
                <span className="ml-2 text-sm font-semibold">5.0 — Clientes felizes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <TestimonialsSection />

      {/* CONTACTO */}
      <section id="contacto" className="py-20 md:py-28 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 mesh-bg opacity-20" />
        <div className="container mx-auto px-4 relative z-10 max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary-glow mb-3">Contacto</p>
            <h2 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight mb-3">Vamos conversar</h2>
            <p className="text-background/70">Pronto para o digital?</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3 md:gap-4 mb-8">
            <ContactCard icon={Phone} label="Telefone / WhatsApp" value={SITE.phone} href={`tel:+${SITE.phoneRaw}`} />
            <ContactCard icon={Mail} label="Email" value={SITE.email} href={`mailto:${SITE.email}`} />
          </div>
          <div className="text-center">
            <a href={SITE.whatsapp} target="_blank" rel="noopener">
              <Button size="lg" className="rounded-2xl bg-background text-foreground hover:bg-background/90 h-14 px-10 text-base font-bold">
                Iniciar projecto agora <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-background border-t border-border py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <Link to="/"><img src={logo} alt="MuacoX" className="h-16 md:h-20 w-auto" /></Link>
            <p className="text-muted-foreground text-xs md:text-sm text-center">{SITE.copyright}</p>
            <p className="text-muted-foreground text-xs">Criado por {SITE.founder}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const PlanGroup = ({ icon: Icon, tag, title, sub, plans, cycleLabel, last }: any) => (
  <div className={last ? "" : "mb-20 md:mb-28"}>
    <div className="text-center mb-10 md:mb-14">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary mb-4">
        <Icon className="h-3.5 w-3.5" /><span className="text-[11px] font-bold tracking-wider uppercase">{tag}</span>
      </div>
      <h2 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight mb-3">{title}</h2>
      <p className="text-muted-foreground max-w-xl mx-auto">{sub}</p>
    </div>
    <div className="grid md:grid-cols-3 gap-5 md:gap-6">
      {plans.map((p: Plan) => <PlanCard key={p.id} plan={p} cycleLabel={cycleLabel(p.billing_cycle)} />)}
    </div>
  </div>
);

const PlanCard = ({ plan, cycleLabel }: { plan: Plan; cycleLabel: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ y: -6 }}
        className={`relative rounded-3xl p-7 md:p-8 transition-all overflow-hidden ${
          plan.highlighted
            ? "bg-foreground text-background shadow-strong"
            : "bg-card border border-border shadow-soft hover:shadow-medium"
        }`}
      >
        {plan.highlighted && (
          <>
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-blue opacity-30 blur-3xl" />
            <div className="absolute top-4 right-4 bg-gradient-blue text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              Popular
            </div>
          </>
        )}
        <div className="relative">
          <h3 className="text-xl md:text-2xl font-display font-extrabold mb-1">{plan.name}</h3>
          <p className={`text-sm mb-6 ${plan.highlighted ? "text-background/70" : "text-muted-foreground"}`}>{plan.description}</p>
          <div className="mb-6 flex items-baseline gap-1">
            <span className="text-3xl md:text-4xl font-display font-extrabold">{formatKz(plan.price)}</span>
            {cycleLabel && <span className={`text-sm ${plan.highlighted ? "text-background/60" : "text-muted-foreground"}`}>{cycleLabel}</span>}
          </div>
          <ul className="space-y-2.5 mb-7">
            {(plan.features || []).map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  plan.highlighted ? "bg-background/15" : "bg-primary/10"
                }`}>
                  <Check className={`h-3 w-3 ${plan.highlighted ? "text-background" : "text-primary"}`} />
                </div>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button onClick={() => setOpen(true)} className={`w-full rounded-2xl font-bold h-12 ${
            plan.highlighted ? "bg-gradient-blue text-white hover:shadow-glow" : "bg-foreground text-background hover:bg-foreground/90"
          }`}>
            Pagar com Multicaixa Express
          </Button>
        </div>
      </motion.div>
      <PlanCheckoutModal open={open} setOpen={setOpen} plan={plan} />
    </>
  );
};

const PlanCheckoutModal = ({ open, setOpen, plan }: { open: boolean; setOpen: (v: boolean) => void; plan: Plan }) => {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<"form" | "waiting" | "success" | "failed">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      setName(profile?.full_name || "");
      setEmail(user?.email || "");
      setPhone(profile?.phone || "");
    }
    if (!open) { setStep("form"); setReference(null); setErrorMsg(""); setNotes(""); }
  }, [open, user, profile]);

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
        if (data.status === "paid") { clearInterval(id); setStep("success"); toast.success("Pagamento recebido!"); }
        else if (data.status === "failed") { clearInterval(id); setErrorMsg("Pagamento falhou."); setStep("failed"); }
        else if (attempts >= 60) { clearInterval(id); setErrorMsg("Tempo esgotado."); setStep("failed"); }
      } catch {/* ignore */}
    }, 3000);
    return () => clearInterval(id);
  }, [step, reference]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("plan-checkout", {
        body: { plan_id: plan.id, customer_name: name, customer_email: email, customer_phone: phone, notes },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setReference((data as any).payment.reference);
      setStep("waiting");
      toast.success("Push enviado para o teu Multicaixa Express.");
    } catch (e: any) { toast.error(e.message); setErrorMsg(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "form" && `Pagar ${plan.name}`}
            {step === "waiting" && "A aguardar confirmação"}
            {step === "success" && "Pagamento confirmado"}
            {step === "failed" && "Pagamento não confirmado"}
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required className="rounded-xl h-11" /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl h-11" /></div>
            <div>
              <Label>Telefone Multicaixa Express</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} required maxLength={9}
                placeholder="9XXXXXXXX" className="rounded-xl h-11" />
              <p className="text-[11px] text-muted-foreground mt-1">9 dígitos. Receberás push na app MCX Express.</p>
            </div>
            <div><Label>Notas (opcional)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="rounded-xl" placeholder="Detalhes do projecto…" /></div>
            <div className="bg-secondary rounded-xl p-3 text-sm flex justify-between"><span>{plan.name}</span><span className="font-bold">{formatKz(plan.price)}</span></div>
            <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pagar ${formatKz(plan.price)}`}
            </Button>
            {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
          </form>
        )}

        {step === "waiting" && (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div>
              <p className="font-bold">Confirma na app Multicaixa Express</p>
              <p className="text-sm text-muted-foreground mt-1">
                Pedido enviado para <span className="font-mono font-bold">{phone}</span>. Aceita {formatKz(plan.price)}.
              </p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
            <p className="font-bold">Pagamento recebido!</p>
            <p className="text-sm text-muted-foreground">A nossa equipa vai contactar-te em breve para iniciar.</p>
            <Button onClick={() => setOpen(false)} className="w-full h-11 rounded-xl bg-gradient-blue text-white">Fechar</Button>
          </div>
        )}

        {step === "failed" && (
          <div className="py-6 text-center space-y-4">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <Button onClick={() => setStep("form")} variant="outline" className="w-full h-11 rounded-xl">Tentar novamente</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ContactCard = ({ icon: Icon, label, value, href }: any) => (
  <a href={href} className="group bg-background/5 hover:bg-background/10  border border-background/10 rounded-2xl p-5 flex items-center gap-4 transition">
    <div className="w-12 h-12 rounded-xl bg-gradient-blue flex items-center justify-center shrink-0 group-hover:scale-110 transition">
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-background/60 uppercase tracking-wider font-bold">{label}</p>
      <p className="font-bold text-base md:text-lg break-all">{value}</p>
    </div>
  </a>
);

export default Index;
