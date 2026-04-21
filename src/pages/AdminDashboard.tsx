import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp, DollarSign, Users, ShoppingBag, CheckCircle2, XCircle,
  MessageCircle, Receipt, Package, Image as ImageIcon, Bell, Plus,
  Trash2, Edit3, Send, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChatPanel } from "@/components/ChatPanel";
import { formatKz } from "@/lib/site";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid
} from "recharts";

interface Order {
  id: string; user_id: string | null; customer_name: string; customer_email: string;
  customer_phone: string; amount: number; status: string; notes: string | null;
  plan_id: string | null; created_at: string;
}
interface Proof { id: string; user_id: string; order_id: string | null; image_url: string; amount: number | null; status: string; created_at: string; notes: string | null; }
interface Conv { user_id: string; full_name: string | null; avatar_url: string | null; last: string; unread: number; }
interface Plan { id: string; name: string; category: string; price: number; description: string; features: any; active: boolean; highlighted: boolean; billing_cycle: string; display_order: number; }
interface Flyer { id: string; title: string; image_url: string; category: string | null; description: string | null; active: boolean; display_order: number; }
interface Profile { user_id: string; full_name: string | null; phone: string | null; avatar_url: string | null; created_at: string; }

const COLORS = ["hsl(230 100% 50%)", "hsl(38 92% 50%)", "hsl(142 76% 36%)", "hsl(0 84% 60%)"];

const AdminDashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) navigate("/login", { replace: true });
      else if (!isAdmin) navigate("/dashboard", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [{ data: o }, { data: p }, { data: msgs }, { data: pl }, { data: fl }, { data: pr }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("payment_proofs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("messages").select("conversation_user_id, body, created_at, is_admin_sender").order("created_at", { ascending: false }).limit(500),
        supabase.from("service_plans").select("*").order("display_order"),
        supabase.from("flyer_gallery").select("*").order("display_order"),
        supabase.from("profiles").select("user_id, full_name, phone, avatar_url, created_at").order("created_at", { ascending: false }),
      ]);
      if (o) setOrders(o as Order[]);
      if (p) setProofs(p as Proof[]);
      if (pl) setPlans(pl as any);
      if (fl) setFlyers(fl as Flyer[]);
      if (pr) setProfiles(pr as Profile[]);
      if (msgs) {
        const map = new Map<string, Conv>();
        (msgs as any[]).forEach(m => {
          if (!map.has(m.conversation_user_id)) {
            map.set(m.conversation_user_id, {
              user_id: m.conversation_user_id, full_name: null, avatar_url: null,
              last: m.body || "anexo", unread: 0,
            });
          }
        });
        const ids = Array.from(map.keys());
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids);
          (profs || []).forEach(p => { const c = map.get(p.user_id); if (c) { c.full_name = p.full_name; c.avatar_url = p.avatar_url; } });
        }
        setConvs(Array.from(map.values()));
      }
    };
    load();
    const ch = supabase.channel("admin-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_proofs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_plans" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "flyer_gallery" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  if (!isAdmin) return null;

  const totalRevenue = orders.filter(o => o.status === "paid" || o.status === "completed").reduce((s, o) => s + Number(o.amount), 0);
  const uniqueCustomers = new Set(orders.map(o => o.customer_email)).size;
  const proofsPending = proofs.filter(p => p.status === "pending").length;
  const last30 = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().slice(0, 10);
    const total = orders.filter(o => o.created_at.slice(0, 10) === key).reduce((s, o) => s + Number(o.amount), 0);
    const count = orders.filter(o => o.created_at.slice(0, 10) === key).length;
    return { day: d.getDate().toString(), total, count };
  });
  const statusData = [
    { name: "Pendente", value: orders.filter(o => o.status === "pending").length },
    { name: "Pago", value: orders.filter(o => o.status === "paid").length },
    { name: "Em curso", value: orders.filter(o => o.status === "in_progress").length },
    { name: "Concluído", value: orders.filter(o => o.status === "completed").length },
  ].filter(d => d.value > 0);

  const updateOrderStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Pedido actualizado");
  };

  const reviewProof = async (id: string, status: "approved" | "rejected", orderId?: string | null) => {
    const { error } = await supabase.from("payment_proofs").update({
      status, reviewed_by: user!.id, reviewed_at: new Date().toISOString()
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (status === "approved" && orderId) await updateOrderStatus(orderId, "paid");
    toast.success("Comprovativo " + (status === "approved" ? "aprovado" : "rejeitado"));
  };

  return (
    <DashboardLayout admin>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary mb-1">Painel Admin</p>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight">Visão geral</h1>
        </motion.div>

        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="rounded-2xl h-auto p-1.5 grid grid-cols-4 md:flex md:flex-wrap gap-1 bg-secondary">
            <Tab value="overview" icon={LayoutDashboard} label="Visão" />
            <Tab value="orders" icon={ShoppingBag} label="Pedidos" badge={orders.filter(o=>o.status==="pending").length} />
            <Tab value="proofs" icon={Receipt} label="Pagamentos" badge={proofsPending} />
            <Tab value="chats" icon={MessageCircle} label="Chats" />
            <Tab value="customers" icon={Users} label="Clientes" />
            <Tab value="plans" icon={Package} label="Planos" />
            <Tab value="gallery" icon={ImageIcon} label="Galeria" />
            <Tab value="notify" icon={Bell} label="Avisos" />
          </TabsList>

          {/* 1. VISÃO GERAL */}
          <TabsContent value="overview" className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={DollarSign} label="Receita" value={formatKz(totalRevenue)} />
              <Kpi icon={ShoppingBag} label="Pedidos" value={orders.length.toString()} />
              <Kpi icon={Users} label="Clientes" value={uniqueCustomers.toString()} />
              <Kpi icon={Receipt} label="Por aprovar" value={proofsPending.toString()} accent={proofsPending > 0} />
            </div>
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-background rounded-2xl border border-border p-5">
                <p className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Receita últimos 30 dias</p>
                <div className="h-64">
                  <ResponsiveContainer>
                    <AreaChart data={last30}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(230 100% 50%)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(230 100% 50%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: any) => formatKz(Number(v))} />
                      <Area type="monotone" dataKey="total" stroke="hsl(230 100% 50%)" strokeWidth={2} fill="url(#rev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-background rounded-2xl border border-border p-5">
                <p className="font-bold mb-4">Estado dos pedidos</p>
                <div className="h-64">
                  {statusData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                  ) : (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={4}>
                          {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-background rounded-2xl border border-border p-5">
              <p className="font-bold mb-4">Pedidos por dia (30d)</p>
              <div className="h-48">
                <ResponsiveContainer>
                  <BarChart data={last30}>
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                    <Bar dataKey="count" fill="hsl(230 100% 50%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* 2. PEDIDOS */}
          <TabsContent value="orders">
            <div className="grid gap-3">
              {orders.map(o => (
                <div key={o.id} className="bg-background rounded-2xl border border-border p-4 flex flex-wrap gap-3 items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-bold">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_email} · {o.customer_phone}</p>
                    {o.notes && <p className="text-xs mt-1 line-clamp-1 max-w-md">{o.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold">{formatKz(o.amount)}</p>
                    <select value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)}
                      className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-semibold">
                      <option value="pending">Pendente</option>
                      <option value="paid">Pago</option>
                      <option value="in_progress">Em curso</option>
                      <option value="completed">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <p className="text-center text-muted-foreground py-10">Sem pedidos.</p>}
            </div>
          </TabsContent>

          {/* 3. COMPROVATIVOS */}
          <TabsContent value="proofs">
            <div className="grid md:grid-cols-2 gap-4">
              {proofs.map(p => (
                <div key={p.id} className="bg-background rounded-2xl border border-border p-4">
                  <a href={p.image_url} target="_blank" rel="noopener">
                    <img src={p.image_url} alt="comprovativo" className="w-full h-48 object-cover rounded-xl mb-3" />
                  </a>
                  <p className="text-sm"><b>Valor:</b> {p.amount ? formatKz(p.amount) : "—"}</p>
                  {p.notes && <p className="text-sm text-muted-foreground">{p.notes}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-AO")}</p>
                  <div className="flex gap-2 mt-3">
                    {p.status === "pending" ? (
                      <>
                        <Button size="sm" onClick={() => reviewProof(p.id, "approved", p.order_id)}
                          className="flex-1 bg-success text-white hover:bg-success/90 rounded-full"><CheckCircle2 className="h-4 w-4 mr-1" />Aprovar</Button>
                        <Button size="sm" variant="outline" onClick={() => reviewProof(p.id, "rejected", p.order_id)}
                          className="flex-1 rounded-full"><XCircle className="h-4 w-4 mr-1" />Rejeitar</Button>
                      </>
                    ) : (
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        p.status === "approved" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                      }`}>{p.status === "approved" ? "Aprovado" : "Rejeitado"}</span>
                    )}
                  </div>
                </div>
              ))}
              {proofs.length === 0 && <p className="col-span-full text-center text-muted-foreground py-10">Sem comprovativos.</p>}
            </div>
          </TabsContent>

          {/* 4. CHATS */}
          <TabsContent value="chats">
            <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-16rem)]">
              <div className="bg-background rounded-2xl border border-border p-2 overflow-y-auto">
                {convs.length === 0 && <p className="text-center text-muted-foreground p-6 text-sm">Sem conversas.</p>}
                {convs.map(c => (
                  <button key={c.user_id} onClick={() => setActiveChat(c.user_id)}
                    className={`w-full text-left p-3 rounded-xl transition flex items-center gap-3 ${
                      activeChat === c.user_id ? "bg-gradient-blue text-white" : "hover:bg-secondary"
                    }`}>
                    <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold shrink-0 ${
                      activeChat === c.user_id ? "bg-white/20" : "bg-gradient-blue text-white"
                    }`}>
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (c.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{c.full_name || "Cliente"}</p>
                      <p className={`text-xs truncate ${activeChat === c.user_id ? "text-white/70" : "text-muted-foreground"}`}>{c.last}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div>
                {activeChat ? (
                  <ChatPanel conversationUserId={activeChat} currentUserId={user!.id} isAdmin fullScreen />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground bg-background rounded-2xl border border-dashed border-border p-10 text-center">
                    <div>
                      <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p>Escolhe uma conversa</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 5. CLIENTES (CRM) */}
          <TabsContent value="customers">
            <CustomersTab profiles={profiles} orders={orders} />
          </TabsContent>

          {/* 6. PLANOS CRUD */}
          <TabsContent value="plans">
            <PlansTab plans={plans} />
          </TabsContent>

          {/* 7. GALERIA CRUD */}
          <TabsContent value="gallery">
            <GalleryTab flyers={flyers} userId={user!.id} />
          </TabsContent>

          {/* 8. NOTIFICAÇÕES BROADCAST */}
          <TabsContent value="notify">
            <BroadcastTab profiles={profiles} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const Tab = ({ value, icon: Icon, label, badge }: any) => (
  <TabsTrigger value={value} className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-soft text-xs md:text-sm gap-1.5 h-10 relative">
    <Icon className="h-3.5 w-3.5" />
    <span className="hidden md:inline">{label}</span>
    <span className="md:hidden">{label.slice(0, 4)}</span>
    {!!badge && badge > 0 && (
      <span className="absolute -top-1 -right-1 bg-warning text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{badge}</span>
    )}
  </TabsTrigger>
);

const Kpi = ({ icon: Icon, label, value, accent }: any) => (
  <motion.div whileHover={{ y: -2 }}
    className={`p-4 md:p-5 rounded-2xl border ${accent ? "border-warning bg-warning/5" : "border-border bg-background"} shadow-soft`}>
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent ? "bg-warning/20 text-warning" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground font-semibold">{label}</p>
    </div>
    <p className="text-xl md:text-2xl font-display font-extrabold truncate">{value}</p>
  </motion.div>
);

// ====== TAB 5: CLIENTES ======
const CustomersTab = ({ profiles, orders }: { profiles: Profile[]; orders: Order[] }) => {
  const [q, setQ] = useState("");
  const filtered = profiles.filter(p =>
    !q || (p.full_name || "").toLowerCase().includes(q.toLowerCase()) || (p.phone || "").includes(q)
  );
  return (
    <div className="space-y-3">
      <Input placeholder="Pesquisar cliente…" value={q} onChange={e => setQ(e.target.value)} className="rounded-xl h-11" />
      <div className="grid gap-3">
        {filtered.map(p => {
          const userOrders = orders.filter(o => o.user_id === p.user_id);
          const total = userOrders.reduce((s, o) => s + Number(o.amount), 0);
          return (
            <div key={p.user_id} className="bg-background rounded-2xl border border-border p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-blue text-white flex items-center justify-center font-bold shrink-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (p.full_name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold truncate">{p.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.phone || "—"}</p>
                  <p className="text-xs text-muted-foreground">Membro desde {new Date(p.created_at).toLocaleDateString("pt-AO")}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{userOrders.length} pedido(s)</p>
                <p className="font-bold">{formatKz(total)}</p>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">Sem clientes.</p>}
      </div>
    </div>
  );
};

// ====== TAB 6: PLANOS CRUD ======
const PlansTab = ({ plans }: { plans: Plan[] }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: "", category: "website", description: "", price: "", features: "", billing_cycle: "one_time", highlighted: false, active: true });

  const startEdit = (p: Plan | null) => {
    setEditing(p);
    setForm(p ? {
      name: p.name, category: p.category, description: p.description || "", price: String(p.price),
      features: Array.isArray(p.features) ? p.features.join("\n") : "",
      billing_cycle: p.billing_cycle, highlighted: p.highlighted, active: p.active,
    } : { name: "", category: "website", description: "", price: "", features: "", billing_cycle: "one_time", highlighted: false, active: true });
    setOpen(true);
  };

  const save = async () => {
    const payload: any = {
      name: form.name, category: form.category, description: form.description,
      price: Number(form.price), billing_cycle: form.billing_cycle,
      features: form.features.split("\n").map(s => s.trim()).filter(Boolean),
      highlighted: form.highlighted, active: form.active,
    };
    const { error } = editing
      ? await supabase.from("service_plans").update(payload).eq("id", editing.id)
      : await supabase.from("service_plans").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Plano actualizado" : "Plano criado"); setOpen(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminar plano?")) return;
    const { error } = await supabase.from("service_plans").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Eliminado");
  };

  const toggle = async (p: Plan) => {
    await supabase.from("service_plans").update({ active: !p.active }).eq("id", p.id);
  };

  return (
    <div className="space-y-3">
      <Button onClick={() => startEdit(null)} className="rounded-full bg-gradient-blue text-white"><Plus className="h-4 w-4 mr-2" />Novo plano</Button>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map(p => (
          <div key={p.id} className={`bg-background rounded-2xl border p-4 ${!p.active ? "opacity-60" : ""} border-border`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-[10px] uppercase font-bold text-primary tracking-wider">{p.category}</p>
                <p className="font-bold">{p.name}</p>
              </div>
              <p className="text-sm font-extrabold">{formatKz(p.price)}</p>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(p)} className="rounded-full flex-1"><Edit3 className="h-3 w-3 mr-1" />Editar</Button>
              <Button size="sm" variant="outline" onClick={() => toggle(p)} className="rounded-full">{p.active ? "Desact." : "Activar"}</Button>
              <Button size="sm" variant="outline" onClick={() => remove(p.id)} className="rounded-full text-destructive"><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Preço (Kz)</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Categoria</Label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full h-10 rounded-md border border-input px-3 text-sm">
                  <option value="website">Website</option><option value="hosting">Hospedagem</option><option value="flyer">Flyer</option>
                </select>
              </div>
              <div><Label>Ciclo</Label>
                <select value={form.billing_cycle} onChange={e => setForm({ ...form, billing_cycle: e.target.value })} className="w-full h-10 rounded-md border border-input px-3 text-sm">
                  <option value="one_time">Único</option><option value="monthly">Mensal</option><option value="yearly">Anual</option>
                </select>
              </div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Funcionalidades (1 por linha)</Label><Textarea value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} rows={4} /></div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.highlighted} onChange={e => setForm({ ...form, highlighted: e.target.checked })} />Destacado</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Activo</label>
            </div>
            <Button onClick={save} className="w-full rounded-xl bg-gradient-blue text-white h-12">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ====== TAB 7: GALERIA ======
const GalleryTab = ({ flyers, userId }: { flyers: Flyer[]; userId: string }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !title) { toast.error("Adiciona título primeiro"); return; }
    setUploading(true);
    const path = `gallery/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
    const { error: upErr } = await supabase.storage.from("public-assets").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
    const { error } = await supabase.from("flyer_gallery").insert({
      title, category: category || null, image_url: data.publicUrl, active: true,
    });
    if (error) toast.error(error.message);
    else { toast.success("Flyer adicionado"); setTitle(""); setCategory(""); setOpen(false); }
    setUploading(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminar flyer?")) return;
    await supabase.from("flyer_gallery").delete().eq("id", id);
    toast.success("Eliminado");
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="rounded-full bg-gradient-blue text-white"><Plus className="h-4 w-4 mr-2" />Adicionar flyer</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo flyer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
            <Input placeholder="Categoria (opcional)" value={category} onChange={e => setCategory(e.target.value)} />
            <Input type="file" accept="image/*" onChange={upload} disabled={uploading} />
            {uploading && <p className="text-sm text-muted-foreground">A enviar…</p>}
          </div>
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {flyers.map(f => (
          <div key={f.id} className="bg-background rounded-2xl border border-border overflow-hidden">
            <img src={f.image_url} alt={f.title} className="w-full aspect-[4/5] object-cover" />
            <div className="p-3">
              <p className="font-bold text-sm truncate">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.category || "—"}</p>
              <Button size="sm" variant="outline" onClick={() => remove(f.id)} className="w-full mt-2 rounded-full text-destructive"><Trash2 className="h-3 w-3 mr-1" />Eliminar</Button>
            </div>
          </div>
        ))}
        {flyers.length === 0 && <p className="col-span-full text-center text-muted-foreground py-10">Sem flyers na galeria.</p>}
      </div>
    </div>
  );
};

// ====== TAB 8: BROADCAST ======
const BroadcastTab = ({ profiles }: { profiles: Profile[] }) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title || !message) { toast.error("Preenche tudo"); return; }
    setSending(true);
    const rows = profiles.map(p => ({ user_id: p.user_id, title, message, type: "broadcast" }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) toast.error(error.message);
    else { toast.success(`Enviado a ${rows.length} clientes`); setTitle(""); setMessage(""); }
    setSending(false);
  };

  return (
    <div className="max-w-2xl space-y-4 bg-background rounded-2xl border border-border p-6">
      <div>
        <p className="font-bold mb-1">Enviar aviso a todos os clientes</p>
        <p className="text-xs text-muted-foreground">Será criada uma notificação para cada utilizador registado ({profiles.length}).</p>
      </div>
      <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl h-11" />
      <Textarea placeholder="Mensagem…" value={message} onChange={e => setMessage(e.target.value)} rows={5} className="rounded-xl" />
      <Button onClick={send} disabled={sending} className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
        <Send className="h-4 w-4 mr-2" />{sending ? "A enviar…" : `Enviar a ${profiles.length} clientes`}
      </Button>
    </div>
  );
};

export default AdminDashboard;
