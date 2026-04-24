import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, Clock, CheckCircle2, XCircle, MessageCircle, Receipt, ExternalLink, User as UserIcon, Download, Globe, Server, Image as ImageIcon, FileBadge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChatPanel, PaymentProofUpload } from "@/components/ChatPanel";
import { ProfileSettings } from "@/components/ProfileSettings";
import { SITE, formatKz } from "@/lib/site";
import { downloadInvoice } from "@/lib/invoice";
import { toast } from "sonner";

interface Plan { id: string; name: string; category: string; price: number; }
interface Order {
  id: string; customer_name: string; amount: number; status: string;
  notes: string | null; created_at: string; plan_id: string | null;
  invoice_url?: string | null; invoice_number?: string | null; service_type?: string | null;
}

const Dashboard = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
        .then(({ data }) => data && setOrders(data as Order[]));
    };
    load();
    supabase.from("service_plans").select("id,name,category,price").eq("active", true).order("display_order")
      .then(({ data }) => data && setPlans(data as Plan[]));

    const ch = supabase.channel(`orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (!user) return null;

  // KPI cards (organize the dashboard)
  const totalSpent = orders.filter(o => ["paid","completed"].includes(o.status)).reduce((s,o)=>s+Number(o.amount),0);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const inProgressCount = orders.filter(o => o.status === "in_progress").length;
  const completedCount = orders.filter(o => ["paid","completed"].includes(o.status)).length;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-primary/40 ring-offset-2 ring-offset-background bg-gradient-blue text-white flex items-center justify-center font-display font-extrabold text-xl shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (profile?.full_name || user.email || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-display font-extrabold truncate">Olá, {profile?.full_name?.split(" ")[0] || "amigo"}</h1>
            <p className="text-sm text-muted-foreground">Faz um pedido ou conversa connosco no chat.</p>
          </div>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard icon={FileText} label="Total pedidos" value={orders.length.toString()} tone="blue" />
          <KpiCard icon={Clock} label="Pendentes" value={pendingCount.toString()} tone="warning" />
          <KpiCard icon={CheckCircle2} label="Concluídos" value={completedCount.toString()} tone="success" />
          <KpiCard icon={Receipt} label="Total investido" value={formatKz(totalSpent)} tone="dark" />
        </div>

        <Tabs defaultValue="pedidos" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid h-12 rounded-2xl bg-secondary p-1.5">
            <TabsTrigger value="pedidos" className="rounded-xl"><FileText className="h-4 w-4 mr-2" />Pedidos</TabsTrigger>
            <TabsTrigger value="chat" className="rounded-xl"><MessageCircle className="h-4 w-4 mr-2" />Chat</TabsTrigger>
            <TabsTrigger value="perfil" className="rounded-xl"><UserIcon className="h-4 w-4 mr-2" />Perfil</TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos" className="space-y-4">
            <NewOrderDialog open={open} setOpen={setOpen} plans={plans} user={user} profile={profile} />
            {orders.length === 0 ? (
              <div className="text-center py-16 bg-background rounded-3xl border border-dashed border-border">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Ainda não tens pedidos.</p>
                <Button onClick={() => setOpen(true)} className="mt-4 rounded-full bg-gradient-blue text-white">
                  <Plus className="h-4 w-4 mr-2" />Criar primeiro pedido
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {orders.map(o => {
                  const plan = plans.find(p => p.id === o.plan_id);
                  const cat = plan?.category || o.service_type;
                  const CatIcon = cat === "website" ? Globe : cat === "hosting" ? Server : cat === "flyer" ? ImageIcon : FileText;
                  const catLabel = cat === "website" ? "Site" : cat === "hosting" ? "Hospedagem" : cat === "flyer" ? "Flyer" : "Personalizado";
                  return (
                    <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-background rounded-3xl border border-border p-5 shadow-soft hover:shadow-medium transition">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <CatIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold truncate">{plan?.name || "Pedido personalizado"}</p>
                              <p className="text-[11px] uppercase font-bold tracking-wider text-primary">{catLabel}</p>
                            </div>
                            <StatusBadge status={o.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(o.created_at).toLocaleString("pt-AO")}</p>
                        </div>
                      </div>
                      {o.notes && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{o.notes}</p>}
                      {o.invoice_number && (
                        <div className="mb-3 bg-success/10 border border-success/20 rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <FileBadge className="h-4 w-4 text-success shrink-0" />
                            <span className="flex-1 text-xs font-bold text-success truncate">
                              Factura <span className="font-mono">{o.invoice_number}</span>
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => downloadInvoice(o.invoice_number!, "view")}
                              className="flex-1 h-9 rounded-lg">
                              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Ver
                            </Button>
                            <Button size="sm" onClick={() => downloadInvoice(o.invoice_number!, "download")}
                              className="flex-1 h-9 rounded-lg bg-success text-white hover:bg-success/90">
                              <Download className="h-3.5 w-3.5 mr-1.5" />Baixar
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-2xl font-display font-extrabold">{formatKz(o.amount)}</p>
                        <div className="flex gap-2">
                          <Dialog open={proofOpen === o.id} onOpenChange={v => setProofOpen(v ? o.id : null)}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="rounded-full">
                                <Receipt className="h-4 w-4 mr-1" />Comprovativo
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Enviar comprovativo</DialogTitle></DialogHeader>
                              <p className="text-sm text-muted-foreground mb-2">
                                Faz a transferência e envia a foto. O admin vai aprovar manualmente.
                              </p>
                              <PaymentProofUpload userId={user.id} orderId={o.id} onUploaded={() => setProofOpen(null)} />
                            </DialogContent>
                          </Dialog>
                          <a href={`${SITE.whatsapp}?text=${encodeURIComponent(`Olá! Pedido #${o.id.slice(0,8)}`)}`} target="_blank" rel="noopener">
                            <Button size="sm" className="rounded-full bg-gradient-blue text-white">
                              WhatsApp <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="chat">
            <ChatPanel conversationUserId={user.id} currentUserId={user.id} isAdmin={false} fullScreen />
          </TabsContent>

          <TabsContent value="perfil">
            <ProfileSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const KpiCard = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "blue" | "warning" | "success" | "dark" }) => {
  const tones: any = {
    blue:    { bg: "bg-primary/10",     text: "text-primary" },
    warning: { bg: "bg-warning/15",     text: "text-warning" },
    success: { bg: "bg-success/15",     text: "text-success" },
    dark:    { bg: "bg-foreground/5",   text: "text-foreground" },
  };
  return (
    <motion.div whileHover={{ y: -2 }} className="bg-background rounded-2xl border border-border p-3 md:p-4 shadow-soft">
      <div className={`w-9 h-9 rounded-xl ${tones[tone].bg} ${tones[tone].text} flex items-center justify-center mb-2`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
      <p className="text-base md:text-lg font-display font-extrabold truncate">{value}</p>
    </motion.div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: "Pendente", cls: "bg-warning/15 text-warning", icon: Clock },
    paid: { label: "Pago", cls: "bg-success/15 text-success", icon: CheckCircle2 },
    in_progress: { label: "Em curso", cls: "bg-primary/15 text-primary", icon: Clock },
    completed: { label: "Concluído", cls: "bg-success/15 text-success", icon: CheckCircle2 },
    cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive", icon: XCircle },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${s.cls}`}>
      <s.icon className="h-3 w-3" />{s.label}
    </span>
  );
};

const NewOrderDialog = ({ open, setOpen, plans, user, profile }: any) => {
  const [planId, setPlanId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const plan = plans.find((p: Plan) => p.id === planId);
    if (!plan) { toast.error("Escolhe um plano"); return; }
    setSaving(true);
    const { error } = await supabase.from("orders").insert({
      user_id: user.id, plan_id: planId,
      customer_name: profile?.full_name || user.email, customer_email: user.email,
      customer_phone: profile?.phone || "",
      amount: plan.price, notes,
    });
    if (error) toast.error(error.message);
    else { toast.success("Pedido criado!"); setOpen(false); setPlanId(""); setNotes(""); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full bg-gradient-blue text-white shadow-medium">
          <Plus className="h-4 w-4 mr-2" />Novo pedido
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Criar pedido</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Plano</Label>
            <select value={planId} onChange={e => setPlanId(e.target.value)} required
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="">— Escolher —</option>
              {["website", "hosting", "flyer"].map(cat => (
                <optgroup key={cat} label={cat === "website" ? "Sites" : cat === "hosting" ? "Hospedagem" : "Flyers"}>
                  {plans.filter((p: Plan) => p.category === cat).map((p: Plan) => (
                    <option key={p.id} value={p.id}>{p.name} — {formatKz(p.price)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Detalhes do projecto</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              placeholder="Conta-nos sobre o teu negócio, ideias, cores preferidas…" className="rounded-xl" />
          </div>
          <Button type="submit" disabled={saving} className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
            {saving ? "A criar…" : "Criar pedido"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Dashboard;
