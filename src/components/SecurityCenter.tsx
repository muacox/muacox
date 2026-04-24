import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Plus, Trash2, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BlockedIp {
  id: string;
  ip: string;
  reason: string;
  notes: string | null;
  created_at: string;
}

interface Incident {
  id: string;
  ip: string | null;
  kind: string;
  details: string | null;
  user_agent: string | null;
  created_at: string;
}

const KIND_LABEL: Record<string, string> = {
  brute_force: "Brute force",
  devtools_open: "DevTools aberto",
  sql_injection_attempt: "Tentativa SQL",
  suspicious_paste: "Cole suspeito (console)",
  blocked_ip_visit: "Acesso de IP bloqueado",
  rate_limit: "Excedeu limite",
};

export const SecurityCenter = () => {
  const [blocked, setBlocked] = useState<BlockedIp[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("manual");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [b, i] = await Promise.all([
      supabase.from("blocked_ips").select("*").order("created_at", { ascending: false }),
      supabase.from("security_incidents").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (b.data) setBlocked(b.data as BlockedIp[]);
    if (i.data) setIncidents(i.data as Incident[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("security-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "security_incidents" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "blocked_ips" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const block = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = ip.trim();
    if (!cleaned.match(/^[0-9a-fA-F.:]+$/)) { toast.error("IP inválido"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("blocked_ips").insert({
      ip: cleaned,
      reason,
      notes: notes || null,
      blocked_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success(`IP ${cleaned} bloqueado`); setIp(""); setNotes(""); }
    setSaving(false);
  };

  const unblock = async (id: string, ipAddr: string) => {
    if (!confirm(`Desbloquear IP ${ipAddr}?`)) return;
    const { error } = await supabase.from("blocked_ips").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("IP desbloqueado");
  };

  return (
    <div className="space-y-6">
      <div className="bg-background rounded-3xl border border-border p-5 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-lg">Centro de Segurança</h3>
            <p className="text-xs text-muted-foreground">Bloqueio de IPs maliciosos (Kali, Termux, brute-force)</p>
          </div>
        </div>

        <form onSubmit={block} className="grid md:grid-cols-[1fr,160px,1fr,auto] gap-2 mb-5">
          <div className="space-y-1">
            <Label className="text-xs">Endereço IP</Label>
            <Input value={ip} onChange={e => setIp(e.target.value)} placeholder="ex.: 41.221.123.45" required className="rounded-xl h-11" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="manual">Manual</option>
              <option value="brute_force">Brute force</option>
              <option value="devtools">DevTools</option>
              <option value="sql_injection">SQL injection</option>
              <option value="malware">Malware</option>
              <option value="kali">Kali Linux</option>
              <option value="termux">Termux</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas (opcional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="origem, acção…" className="rounded-xl h-11" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={saving} className="h-11 rounded-xl bg-destructive text-destructive-foreground font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Bloquear</>}
            </Button>
          </div>
        </form>

        <div>
          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
            IPs bloqueados ({blocked.length})
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : blocked.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum IP bloqueado.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {blocked.map(b => (
                <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
                  <Globe className="h-4 w-4 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-bold truncate">{b.ip}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {b.reason} · {new Date(b.created_at).toLocaleString("pt-AO")}
                      {b.notes && ` · ${b.notes}`}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => unblock(b.id, b.ip)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-background rounded-3xl border border-border p-5 shadow-soft">
        <h3 className="font-display font-extrabold text-lg mb-3">Incidentes recentes</h3>
        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum incidente registado.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {incidents.map(i => (
              <div key={i.id} className="p-3 rounded-xl bg-secondary/50 border border-border">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning">
                    {KIND_LABEL[i.kind] || i.kind}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(i.created_at).toLocaleString("pt-AO")}
                  </span>
                </div>
                {i.ip && <p className="text-xs font-mono mt-1">{i.ip}</p>}
                {i.details && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{i.details}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
