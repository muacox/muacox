import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Mail, Trash2, UserCheck, UserX, Loader2, Briefcase, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Freelancer {
  id: string;
  user_id: string | null;
  invited_email: string;
  full_name: string | null;
  specialty: string | null;
  avatar_url: string | null;
  available: boolean;
  is_online: boolean;
  last_seen: string | null;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

export const FreelancersManager = () => {
  const [list, setList] = useState<Freelancer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("freelancers")
      .select("*").order("created_at", { ascending: false });
    if (data) setList(data as Freelancer[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-freelancers")
      .on("postgres_changes", { event: "*", schema: "public", table: "freelancers" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("freelancers").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Estado actualizado");
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este freelancer da equipa?")) return;
    const { error } = await supabase.from("freelancers").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Removido");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-display font-extrabold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />Equipa MuacoX
          </h3>
          <p className="text-xs text-muted-foreground">Convida freelancers para responderem ao chat e tratarem de pedidos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full bg-gradient-blue text-white">
              <Plus className="h-4 w-4 mr-1" />Convidar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Convidar freelancer</DialogTitle></DialogHeader>
            <InviteForm
              loading={loading}
              setLoading={setLoading}
              onDone={() => { setOpen(false); load(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 bg-background rounded-2xl border border-dashed border-border">
          <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Ainda sem freelancers. Convida o teu primeiro membro.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          <AnimatePresence>
            {list.map(f => {
              const isLive = f.is_online && f.last_seen && (Date.now() - new Date(f.last_seen).getTime() < 90_000);
              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-background rounded-2xl border border-border p-4 flex gap-3 items-start"
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-blue flex items-center justify-center text-white font-bold">
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (f.full_name || f.invited_email).charAt(0).toUpperCase()}
                    </div>
                    <Circle
                      className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                        isLive ? "fill-success text-success" : "fill-muted text-muted"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold truncate">{f.full_name || f.invited_email.split("@")[0]}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        f.status === "active" ? "bg-success/15 text-success" :
                        f.status === "invited" ? "bg-warning/15 text-warning" :
                        "bg-destructive/15 text-destructive"
                      }`}>{f.status}</span>
                      {isLive && <span className="text-[10px] font-bold text-success">● online</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="h-3 w-3" />{f.invited_email}
                    </p>
                    {f.specialty && <p className="text-xs text-primary font-semibold mt-0.5">{f.specialty}</p>}
                    <div className="flex gap-1.5 mt-2">
                      {f.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={() => setStatus(f.id, "suspended")}
                          className="h-7 text-xs rounded-full"><UserX className="h-3 w-3 mr-1" />Suspender</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setStatus(f.id, "active")}
                          className="h-7 text-xs rounded-full"><UserCheck className="h-3 w-3 mr-1" />Activar</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(f.id)}
                        className="h-7 text-xs rounded-full text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

const InviteForm = ({ loading, setLoading, onDone }: any) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("freelancers").insert({
      invited_email: email.toLowerCase().trim(),
      full_name: name || null,
      specialty: specialty || null,
      invited_by: user!.id,
      status: "invited",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Convite registado! Pede ao freelancer para criar conta com este email.");
      setEmail(""); setName(""); setSpecialty(""); onDone();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <Label>Email do freelancer *</Label>
        <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="freelancer@email.com" className="rounded-xl" />
      </div>
      <div className="space-y-1">
        <Label>Nome completo</Label>
        <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl" />
      </div>
      <div className="space-y-1">
        <Label>Especialidade</Label>
        <Input value={specialty} onChange={e => setSpecialty(e.target.value)}
          placeholder="Designer · Programador · Suporte" className="rounded-xl" />
      </div>
      <p className="text-xs text-muted-foreground bg-secondary rounded-xl p-3">
        Quando o freelancer criar conta com este email, recebe automaticamente acesso ao painel de suporte.
      </p>
      <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-gradient-blue text-white font-bold">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar convite"}
      </Button>
    </form>
  );
};
