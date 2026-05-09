import { useEffect, useState } from "react";
import { Check, X, Briefcase, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatKz } from "@/lib/site";
import { toast } from "sonner";

interface Contract {
  id: string; client_name: string; client_email: string; client_phone: string;
  client_iban: string | null; project_description: string;
  budget: number | null; deadline_days: number | null;
  status: string; freelancer_response: string | null; created_at: string;
}

export const ContractsManager = ({ freelancerId }: { freelancerId: string }) => {
  const [items, setItems] = useState<Contract[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("freelancer_contracts").select("*").eq("freelancer_id", freelancerId).order("created_at", { ascending: false });
    setItems((data || []) as Contract[]);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel(`fc-${freelancerId}`).on("postgres_changes",
      { event: "*", schema: "public", table: "freelancer_contracts", filter: `freelancer_id=eq.${freelancerId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [freelancerId]);

  const respond = async (id: string, status: string) => {
    setBusy(id);
    const { error } = await supabase.from("freelancer_contracts").update({
      status, freelancer_response: reply[id] || null,
    }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Resposta enviada"); load(); }
    setBusy(null);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-16 bg-background rounded-2xl border border-dashed border-border">
        <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Sem pedidos de contratação.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map(c => (
        <div key={c.id} className="bg-background rounded-2xl border border-border p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="font-bold truncate">{c.client_name}</p>
              <p className="text-xs text-muted-foreground">{c.client_email} · {c.client_phone}</p>
              {c.client_iban && <p className="text-xs font-mono text-muted-foreground">{c.client_iban}</p>}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary shrink-0">{c.status}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap mb-2">{c.project_description}</p>
          <div className="flex gap-3 text-xs text-muted-foreground mb-3">
            {c.budget && <span><b>Orçamento:</b> {formatKz(c.budget)}</span>}
            {c.deadline_days && <span><b>Prazo:</b> {c.deadline_days} dias</span>}
          </div>
          {c.freelancer_response && (
            <div className="bg-secondary rounded-lg p-2 text-xs mb-2"><b>Tua resposta:</b> {c.freelancer_response}</div>
          )}
          {c.status === "open" && (
            <>
              <Textarea value={reply[c.id] || ""} onChange={e => setReply(r => ({ ...r, [c.id]: e.target.value }))}
                rows={2} placeholder="Mensagem ao cliente (opcional)…" className="rounded-lg mb-2 text-sm" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => respond(c.id, "accepted")} disabled={busy === c.id}
                  className="flex-1 bg-success text-white hover:bg-success/90 rounded-lg">
                  {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Aceitar</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => respond(c.id, "declined")} disabled={busy === c.id} className="flex-1 rounded-lg">
                  <X className="h-3.5 w-3.5 mr-1" />Recusar
                </Button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
