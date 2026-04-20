import { Link } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { ArrowRight, Sparkles, Globe, Server, Image as ImageIcon, Mail, Phone, Check, LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SITE, formatKz } from "@/lib/site";
import logo from "@/assets/muacox-logo.png";
import flyer1 from "@/assets/flyers/flyer-marketing.png";
import flyer2 from "@/assets/flyers/flyer-freddy.png";
import flyer3 from "@/assets/flyers/flyer-programador.png";
import flyer4 from "@/assets/flyers/flyer-konsola.png";
import flyer5 from "@/assets/flyers/flyer-voto.png";

interface Plan {
  id: string;
  category: string;
  name: string;
  description: string;
  features: string[];
  price: number;
  billing_cycle: string;
  highlighted: boolean;
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
  }, []);

  const websitePlans = plans.filter(p => p.category === 'website');
  const hostingPlans = plans.filter(p => p.category === 'hosting');
  const flyerPlans = plans.filter(p => p.category === 'flyer');

  const cycleLabel = (c: string) => c === 'monthly' ? '/mês' : c === 'yearly' ? '/ano' : '';

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <motion.nav
        animate={{ y: hidden ? -100 : 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed top-0 inset-x-0 z-50 liquid-glass"
      >
        <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="MuacoX" className="h-14 md:h-20 w-auto drop-shadow-md" />
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <a href="#planos" className="hover:text-primary transition">Planos</a>
            <a href="#flyers" className="hover:text-primary transition">Flyers</a>
            <a href="#sobre" className="hover:text-primary transition">Sobre</a>
            <a href="#contacto" className="hover:text-primary transition">Contacto</a>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" className="rounded-full bg-gradient-blue text-white shadow-medium">
                  <LayoutDashboard className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Painel</span>
                </Button>
              </Link>
            ) : (
              <Link to="/login" className="hidden sm:block">
                <Button size="sm" variant="ghost" className="rounded-full font-semibold">
                  <LogIn className="h-4 w-4 mr-1" />Entrar
                </Button>
              </Link>
            )}
            <a href={SITE.whatsapp} target="_blank" rel="noopener" className="hidden sm:block">
              <Button size="sm" className="rounded-full bg-gradient-blue text-white shadow-medium hover:shadow-glow">
                Orçamento <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </a>
            <button onClick={() => setMobileOpen(v => !v)} className="md:hidden p-2 rounded-full hover:bg-secondary" aria-label="Menu">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur px-4 py-4 flex flex-col gap-2 text-sm font-semibold">
            <a onClick={() => setMobileOpen(false)} href="#planos" className="py-2">Planos</a>
            <a onClick={() => setMobileOpen(false)} href="#flyers" className="py-2">Flyers</a>
            <a onClick={() => setMobileOpen(false)} href="#sobre" className="py-2">Sobre</a>
            <a onClick={() => setMobileOpen(false)} href="#contacto" className="py-2">Contacto</a>
            <div className="flex gap-2 pt-2">
              {!user && (
                <>
                  <Link to="/login" className="flex-1"><Button variant="outline" className="w-full rounded-full">Entrar</Button></Link>
                  <Link to="/cadastro" className="flex-1"><Button className="w-full rounded-full bg-gradient-blue text-white">Criar conta</Button></Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </motion.nav>

      {/* HERO */}
      <section className="pt-28 md:pt-32 pb-16 md:pb-20 mesh-bg grid-bg relative overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full liquid-glass mb-5 md:mb-6">
              <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
              <span className="text-xs md:text-sm font-semibold">Criamos história que inovam</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-extrabold tracking-tight mb-5 md:mb-6 leading-[1.05]">
              O seu negócio merece um <span className="gradient-text">site profissional</span>
            </h1>
            <p className="text-base md:text-xl text-muted-foreground mb-7 md:mb-8 max-w-2xl mx-auto px-2">
              Sites + domínio + hospedagem desde <span className="font-bold text-foreground">{formatKz(98000)}</span>.
              Hospedagem premium, flyers de alto impacto e marketing digital em Angola.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 md:gap-4 px-4 sm:px-0">
              <a href="#planos">
                <Button size="lg" className="w-full sm:w-auto rounded-full bg-gradient-blue text-white shadow-strong hover:shadow-glow text-base h-14 px-8">
                  Ver Planos <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              {user ? (
                <Link to="/dashboard">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full h-14 px-8 text-base border-2">
                    Ir para painel
                  </Button>
                </Link>
              ) : (
                <Link to="/cadastro">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full h-14 px-8 text-base border-2">
                    Criar conta
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-24">
        <div className="container mx-auto px-4">
          {/* Sites */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Globe className="h-4 w-4" /><span className="text-sm font-bold">Criação de Sites</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-extrabold mb-3">Sites profissionais</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Domínio + hospedagem incluídos. Entregamos chave-na-mão.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-24">
            {websitePlans.map(p => <PlanCard key={p.id} plan={p} cycleLabel={cycleLabel(p.billing_cycle)} />)}
          </div>

          {/* Hospedagem */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Server className="h-4 w-4" /><span className="text-sm font-bold">Hospedagem</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-extrabold mb-3">Planos de hospedagem</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Servidores rápidos, SSL grátis e suporte dedicado.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-24">
            {hostingPlans.map(p => <PlanCard key={p.id} plan={p} cycleLabel={cycleLabel(p.billing_cycle)} />)}
          </div>

          {/* Flyers */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <ImageIcon className="h-4 w-4" /><span className="text-sm font-bold">Design Gráfico</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-extrabold mb-3">Criação de flyers</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Designs profissionais que convertem.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {flyerPlans.map(p => <PlanCard key={p.id} plan={p} cycleLabel={cycleLabel(p.billing_cycle)} />)}
          </div>
        </div>
      </section>

      {/* GALERIA DE FLYERS */}
      <section id="flyers" className="py-24 bg-gradient-soft">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-display font-extrabold mb-3">Galeria de Flyers</h2>
            <p className="text-muted-foreground">Trabalhos criados por <span className="font-bold text-foreground">Isaac Muaco</span></p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {flyers.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative rounded-2xl overflow-hidden shadow-medium hover:shadow-glow transition-all bg-card aspect-[4/5]"
              >
                <img src={f.src} alt={f.title} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition">
                  <p className="text-white text-sm font-bold">{f.title}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SOBRE / CRIADOR */}
      <section id="sobre" className="py-24">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-display font-extrabold mb-6">Quem está por trás</h2>
          <div className="liquid-glass rounded-3xl p-10 md:p-14 shadow-soft">
            <div className="w-24 h-24 rounded-full bg-gradient-blue mx-auto mb-6 flex items-center justify-center text-white text-3xl font-extrabold shadow-glow">IM</div>
            <h3 className="text-3xl font-display font-bold mb-2">{SITE.founder}</h3>
            <p className="text-primary font-semibold mb-4">Fundador & Criador da MuacoX</p>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Programador e designer apaixonado por criar soluções digitais que ajudam empreendedores angolanos a conquistar o mercado online.
              Cada site, cada flyer, cada projecto é tratado como uma obra única.
            </p>
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="py-24 bg-gradient-dark text-white relative overflow-hidden">
        <div className="absolute inset-0 mesh-bg opacity-20" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-display font-extrabold mb-4">Vamos conversar</h2>
            <p className="text-white/70 mb-10 text-lg">Pronto para levar o seu negócio para o digital?</p>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <a href={`tel:+${SITE.phoneRaw}`} className="liquid-glass-dark rounded-2xl p-6 hover:scale-105 transition flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-gradient-blue flex items-center justify-center"><Phone className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wide">Telefone / WhatsApp</p>
                  <p className="font-bold text-lg">{SITE.phone}</p>
                </div>
              </a>
              <a href={`mailto:${SITE.email}`} className="liquid-glass-dark rounded-2xl p-6 hover:scale-105 transition flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-gradient-blue flex items-center justify-center"><Mail className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wide">Email</p>
                  <p className="font-bold text-lg break-all">{SITE.email}</p>
                </div>
              </a>
            </div>
            <a href={SITE.whatsapp} target="_blank" rel="noopener">
              <Button size="lg" className="rounded-full bg-white text-brand-black hover:bg-white/90 h-14 px-10 text-base font-bold">
                Iniciar projecto agora <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-brand-black text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="MuacoX" className="h-16 md:h-20 brightness-0 invert" />
            </div>
            <p className="text-white/60 text-sm text-center">{SITE.copyright}</p>
            <p className="text-white/40 text-xs">Criado por {SITE.founder}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const PlanCard = ({ plan, cycleLabel }: { plan: Plan; cycleLabel: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    whileHover={{ y: -6 }}
    className={`relative rounded-3xl p-8 transition-all ${
      plan.highlighted
        ? "bg-gradient-blue text-white shadow-strong scale-105"
        : "bg-card border-2 border-border shadow-soft hover:shadow-medium"
    }`}
  >
    {plan.highlighted && (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-warning text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
        Mais Popular
      </div>
    )}
    <h3 className="text-2xl font-display font-extrabold mb-2">{plan.name}</h3>
    <p className={`text-sm mb-6 ${plan.highlighted ? "text-white/80" : "text-muted-foreground"}`}>{plan.description}</p>
    <div className="mb-6">
      <span className="text-4xl font-display font-extrabold">{formatKz(plan.price)}</span>
      {cycleLabel && <span className={`text-sm ${plan.highlighted ? "text-white/70" : "text-muted-foreground"}`}>{cycleLabel}</span>}
    </div>
    <ul className="space-y-3 mb-8">
      {(plan.features || []).map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.highlighted ? "text-white" : "text-primary"}`} />
          <span>{f}</span>
        </li>
      ))}
    </ul>
    <a
      href={`https://wa.me/${SITE.phoneRaw}?text=${encodeURIComponent(`Olá! Quero saber mais sobre o plano: ${plan.name}`)}`}
      target="_blank"
      rel="noopener"
      className="block"
    >
      <Button
        className={`w-full rounded-full font-bold ${
          plan.highlighted
            ? "bg-white text-primary hover:bg-white/90"
            : "bg-gradient-blue text-white hover:shadow-glow"
        }`}
      >
        Contratar agora
      </Button>
    </a>
  </motion.div>
);

export default Index;
