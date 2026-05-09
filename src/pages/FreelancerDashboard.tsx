import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, ShoppingBag, Users, Receipt, CheckCircle2, XCircle, Clock, Code2, Briefcase, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useFreelancerPresence } from "@/hooks/useFreelancerPresence";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChatPanel } from "@/components/ChatPanel";
import { ProjectsManager } from "@/components/freelancer/ProjectsManager";
import { SalesManager } from "@/components/freelancer/SalesManager";
import { ContractsManager } from "@/components/freelancer/ContractsManager";
import { formatKz } from "@/lib/site";
import { toast } from "sonner";

interface Conv { user_id: string; full_name: string | null; avatar_url: string | null; last: string; }
interface Order { id: string; customer_name: string; amount: number; status: string; notes: string | null; }
interface Proof { id: string; image_url: string; amount: number | null; status: string; created_at: string; order_id: string | null; }

const FreelancerDashboard = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [isFreelancer, setIsFreelancer] = useState<boolean | null>(null);
  const [freelancerId, setFreelancerId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  useFreelancerPresence(user?.id, !!isFreelancer);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("freelancers")
      .select("id,status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setIsFreelancer(data?.status === "active"); setFreelancerId(data?.id || null); });
  }, [user]);

  useEffect(() => {
    if (!isFreelancer || !user) return;
    const load = async () => {
      // assigned conversations: any message in conversation where assigned_to = me
      const { data: msgs } = await supabase.from("messages")
        .select("conversation_user_id, body, created_at")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false }).limit(200);
      const map = new Map<string, Conv>();
      (msgs || []).forEach((m: any) => {
        if (!map.has(m.conversation_user_id)) {
          map.set(m.conversation_user_id, { user_id: m.conversation_user_id, full_name: null, avatar_url: null, last: m.body || "anexo" });
        }
      });
      const ids = Array.from(map.keys());
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles")
          .select("user_id, full_name, avatar_url").in("user_id", ids);
        (profs || []).forEach((p: any) => {
          const c = map.get(p.user_id); if (c) { c.full_name = p.full_name; c.avatar_url = p.avatar_url; }
        });
      }
      setConvs(Array.from(map.values()));

      const { data: o } = await supabase.from("orders")
        .select("id, customer_name, amount, status, notes")
        .eq("assigned_to", user.id).order("created_at", { ascending: false });
      if (o) setOrders(o as Order[]);

      const { data: p } = await supabase.from("payment_proofs")
        .select("*").order("created_at", { ascending: false }).limit(50);
      if (p) setProofs(p as Proof[]);
    };
    load();
    const ch = supabase.channel(`freelancer-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_proofs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isFreelancer, user]);

  const reviewProof = async (id: string, status: "approved" | "rejected", orderId?: string | null) => {
    const { error } = await supabase.from("payment_proofs")
      .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (status === "approved" && orderId) {
      await supabase.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);
    }
    toast.success("Comprovativo " + (status === "approved" ? "aprovado" : "rejeitado"));
  };

  if (loading || isFreelancer === null) return null;
  if (!isFreelancer) {
    return (
      <DashboardLayout>
        <div className="p-8 max-w-md mx-auto text-center">
          <h1 className="text-2xl font-display font-extrabold mb-2">Sem acesso de freelancer</h1>
          <p className="text-muted-foreground mb-4">Esta área é apenas para membros activos da equipa.</p>
          <Button onClick={() => navigate("/dashboard")} className="rounded-full bg-gradient-blue text-white">Ir ao painel</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-5">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary mb-1">Equipa MuacoX</p>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold">Olá, {profile?.full_name?.split(" ")[0] || "freelancer"}</h1>
          <p className="text-sm text-muted-foreground">Estás online — clientes atribuídos a ti aparecem em baixo.</p>
        </motion.div>

        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList className="rounded-2xl h-auto p-1.5 bg-secondary flex flex-wrap gap-1">
            <TabsTrigger value="chat" className="rounded-xl"><MessageCircle className="h-4 w-4 mr-1.5" />Chats</TabsTrigger>
            <TabsTrigger value="orders" className="rounded-xl"><ShoppingBag className="h-4 w-4 mr-1.5" />Pedidos</TabsTrigger>
            <TabsTrigger value="proofs" className="rounded-xl"><Receipt className="h-4 w-4 mr-1.5" />Comprovativos</TabsTrigger>
            <TabsTrigger value="projects" className="rounded-xl"><Code2 className="h-4 w-4 mr-1.5" />Projectos</TabsTrigger>
            <TabsTrigger value="sales" className="rounded-xl"><DollarSign className="h-4 w-4 mr-1.5" />Vendas</TabsTrigger>
            <TabsTrigger value="contracts" className="rounded-xl"><Briefcase className="h-4 w-4 mr-1.5" />Contratos</TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            {activeChat ? (
              <div>
                <Button variant="ghost" onClick={() => setActiveChat(null)} className="mb-2">← Voltar</Button>
                <ChatPanel conversationUserId={activeChat} currentUserId={user!.id} isAdmin={true} fullScreen={false} />
              </div>
            ) : convs.length === 0 ? (
              <div className="text-center py-12 bg-background rounded-2xl border border-dashed border-border">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Sem conversas atribuídas. O admin vai atribuir-te clientes.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {convs.map(c => (
                  <button key={c.user_id} onClick={() => setActiveChat(c.user_id)}
                    className="bg-background rounded-2xl border border-border p-3 flex items-center gap-3 hover:bg-secondary transition text-left">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-blue flex items-center justify-center text-white font-bold shrink-0">
                      {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> : (c.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{c.full_name || "Cliente"}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.last}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders">
            {orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem pedidos atribuídos.</p>
            ) : (
              <div className="grid gap-3">
                {orders.map(o => (
                  <div key={o.id} className="bg-background rounded-2xl border border-border p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{o.customer_name}</p>
                      {o.notes && <p className="text-xs text-muted-foreground line-clamp-1">{o.notes}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{formatKz(o.amount)}</p>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="proofs">
            <div className="grid md:grid-cols-2 gap-3">
              {proofs.map(p => (
                <div key={p.id} className="bg-background rounded-2xl border border-border p-4">
                  <a href={p.image_url} target="_blank" rel="noopener">
                    <img src={p.image_url} alt="comprovativo" className="w-full h-44 object-cover rounded-xl mb-3" />
                  </a>
                  <p className="text-sm"><b>Valor:</b> {p.amount ? formatKz(p.amount) : "—"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-AO")}</p>
                  {p.status === "pending" ? (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => reviewProof(p.id, "approved", p.order_id)}
                        className="flex-1 bg-success text-white hover:bg-success/90 rounded-full"><CheckCircle2 className="h-4 w-4 mr-1" />Aprovar</Button>
                      <Button size="sm" variant="outline" onClick={() => reviewProof(p.id, "rejected", p.order_id)}
                        className="flex-1 rounded-full"><XCircle className="h-4 w-4 mr-1" />Rejeitar</Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-bold uppercase tracking-wider">{p.status}</p>
                  )}
                </div>
              ))}
              {proofs.length === 0 && <p className="text-center text-muted-foreground py-10 col-span-full">Sem comprovativos.</p>}
            </div>
          </TabsContent>
          <TabsContent value="projects">
            {freelancerId && user && <ProjectsManager freelancerId={freelancerId} userId={user.id} />}
          </TabsContent>
          <TabsContent value="sales">
            {freelancerId && <SalesManager freelancerId={freelancerId} />}
          </TabsContent>
          <TabsContent value="contracts">
            {freelancerId && <ContractsManager freelancerId={freelancerId} />}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default FreelancerDashboard;
