import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp, DollarSign, Users, ShoppingBag, CheckCircle2, XCircle,
  MessageCircle, Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChatPanel } from "@/components/ChatPanel";
import { formatKz } from "@/lib/site";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface Order {
  id: string; user_id: string | null; customer_name: string; customer_email: string;
  customer_phone: string; amount: number; status: string; notes: string | null;
  plan_id: string | null; created_at: string;
}
interface Proof { id: string; user_id: string; order_id: string | null; image_url: string; amount: number | null; status: string; created_at: string; notes: string | null; }
interface Conv { user_id: string; full_name: string | null; last: string; unread: number; }

const COLORS = ["hsl(230 100% 50%)", "hsl(38 92% 50%)", "hsl(142 76% 36%)", "hsl(0 84% 60%)"];

const AdminDashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [{ data: o }, { data: p }, { data: msgs }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("payment_proofs").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("messages").select("conversation_user_id, body, created_at, is_admin_sender").order("created_at", { ascending: false }).limit(500),
      ]);
      if (o) setOrders(o as Order[]);
      if (p) setProofs(p as Proof[]);
      if (msgs) {
        const map = new Map<string, Conv>();
        (msgs as any[]).forEach(m => {
          if (!map.has(m.conversation_user_id)) {
            map.set(m.conversation_user_id, {
              user_id: m.conversation_user_id,
              full_name: null,
              last: m.body || "📎 anexo",
              unread: 0,
            });
          }
        });
        const ids = Array.from(map.keys());
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
          (profs || []).forEach(p => { const c = map.get(p.user_id); if (c) c.full_name = p.full_name; });
        }
        setConvs(Array.from(map.values()));
      }
    };
    load();
    const ch = supabase.channel("admin-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_proofs" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  if (!isAdmin) return null;

  const totalRevenue = orders.filter(o => o.status === "paid" || o.status === "completed").reduce((s, o) => s + Number(o.amount), 0);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const uniqueCustomers = new Set(orders.map(o => o.customer_email)).size;
  const proofsPending = proofs.filter(p => p.status === "pending").length;

  // Charts data
  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const total = orders.filter(o => o.created_at.slice(0, 10) === key).reduce((s, o) => s + Number(o.amount), 0);
    return { day: d.toLocaleDateString("pt-AO", { weekday: "short" }), total };
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
          <h1 className="text-3xl md:text-4xl font-display font-extrabold">Painel Admin</h1>
          <p className="text-muted-foreground">Visão geral em tempo real.</p>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <Kpi icon={DollarSign} label="Receita total" value={formatKz(totalRevenue)} />
          <Kpi icon={ShoppingBag} label="Pedidos" value={orders.length.toString()} />
          <Kpi icon={Users} label="Clientes" value={uniqueCustomers.toString()} />
          <Kpi icon={Receipt} label="Comprovativos" value={proofsPending.toString()} accent={proofsPending > 0} />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2 bg-background rounded-2xl border border-border p-5 shadow-soft">
            <p className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Receita últimos 7 dias</p>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={last7}>
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                    formatter={(v: any) => formatKz(Number(v))}
                  />
                  <Bar dataKey="total" fill="hsl(230 100% 50%)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-background rounded-2xl border border-border p-5 shadow-soft">
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
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="rounded-2xl h-12 grid grid-cols-3 md:inline-grid md:grid-cols-3">
            <TabsTrigger value="orders" className="rounded-xl">Pedidos</TabsTrigger>
            <TabsTrigger value="proofs" className="rounded-xl">
              Comprovativos {proofsPending > 0 && <span className="ml-2 bg-warning text-white text-xs rounded-full px-2">{proofsPending}</span>}
            </TabsTrigger>
            <TabsTrigger value="chats" className="rounded-xl">Chats</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <div className="grid gap-3">
              {orders.map(o => (
                <div key={o.id} className="bg-background rounded-2xl border border-border p-4 flex flex-wrap gap-3 items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-bold">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_email} · {o.customer_phone}</p>
                    {o.notes && <p className="text-xs mt-1 line-clamp-1">{o.notes}</p>}
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
                          className="flex-1 bg-success text-white rounded-full"><CheckCircle2 className="h-4 w-4 mr-1" />Aprovar</Button>
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

          <TabsContent value="chats">
            <div className="grid md:grid-cols-[280px_1fr] gap-4">
              <div className="bg-background rounded-2xl border border-border p-2 max-h-[70vh] overflow-y-auto">
                {convs.length === 0 && <p className="text-center text-muted-foreground p-6 text-sm">Sem conversas.</p>}
                {convs.map(c => (
                  <button key={c.user_id} onClick={() => setActiveChat(c.user_id)}
                    className={`w-full text-left p-3 rounded-xl transition flex items-center gap-3 ${
                      activeChat === c.user_id ? "bg-gradient-blue text-white" : "hover:bg-secondary"
                    }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      activeChat === c.user_id ? "bg-white/20" : "bg-gradient-blue text-white"
                    }`}>
                      {(c.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{c.full_name || "Cliente"}</p>
                      <p className={`text-xs truncate ${activeChat === c.user_id ? "text-white/70" : "text-muted-foreground"}`}>{c.last}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="min-h-[400px]">
                {activeChat ? (
                  <ChatPanel conversationUserId={activeChat} currentUserId={user!.id} isAdmin />
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

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

export default AdminDashboard;
