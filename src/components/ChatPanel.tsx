import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Msg {
  id: string;
  conversation_user_id: string;
  sender_id: string;
  is_admin_sender: boolean;
  body: string | null;
  attachment_url: string | null;
  created_at: string;
}

interface Props {
  conversationUserId: string;
  currentUserId: string;
  isAdmin: boolean;
}

export const ChatPanel = ({ conversationUserId, currentUserId, isAdmin }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    supabase.from("messages")
      .select("*")
      .eq("conversation_user_id", conversationUserId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (mounted && data) setMessages(data as Msg[]); });

    const channel = supabase
      .channel(`chat-${conversationUserId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_user_id=eq.${conversationUserId}` },
        (payload) => setMessages(prev => [...prev, payload.new as Msg]))
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [conversationUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (attachmentUrl?: string) => {
    const text = body.trim();
    if (!text && !attachmentUrl) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_user_id: conversationUserId,
      sender_id: currentUserId,
      is_admin_sender: isAdmin,
      body: text || null,
      attachment_url: attachmentUrl || null,
    });
    if (error) toast.error("Erro ao enviar"); else setBody("");
    setSending(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Máx 10MB"); return; }
    setSending(true);
    const path = `${currentUserId}/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
    const { error } = await supabase.storage.from("chat-uploads").upload(path, file);
    if (error) { toast.error("Erro no upload"); setSending(false); return; }
    const { data: signed } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
    await send(signed?.signedUrl);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-gradient-blue text-white flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <p className="font-bold text-sm">Suporte MuacoX — Isaac Muaco</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[60vh]">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-10">
            <p>👋 Olá! Envia-nos uma mensagem ou comprovativo de pagamento.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map(m => {
            const mine = m.sender_id === currentUserId;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine ? "bg-gradient-blue text-white rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                }`}>
                  {!mine && m.is_admin_sender && (
                    <p className="text-xs font-bold opacity-70 mb-1">Admin</p>
                  )}
                  {m.attachment_url && (
                    <a href={m.attachment_url} target="_blank" rel="noopener" className="block mb-1">
                      <img src={m.attachment_url} alt="anexo" className="rounded-xl max-h-60 object-cover" />
                    </a>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  <p className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="p-3 border-t border-border bg-background flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        <Button type="button" size="icon" variant="ghost" onClick={() => fileRef.current?.click()} disabled={sending}>
          <Paperclip className="h-5 w-5" />
        </Button>
        <Input value={body} onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Escreve uma mensagem…" className="rounded-full h-11" />
        <Button type="button" size="icon" onClick={() => send()} disabled={sending || !body.trim()}
          className="rounded-full bg-gradient-blue text-white">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export const PaymentProofUpload = ({ userId, orderId, onUploaded }: { userId: string; orderId?: string; onUploaded?: () => void }) => {
  const [uploading, setUploading] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${userId}/proofs/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
    const { error } = await supabase.storage.from("chat-uploads").upload(path, file);
    if (error) { toast.error("Erro no upload"); setUploading(false); return; }
    const { data: signed } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
    const { error: insErr } = await supabase.from("payment_proofs").insert({
      user_id: userId,
      order_id: orderId || null,
      image_url: signed!.signedUrl,
      amount: amount ? Number(amount) : null,
      notes: notes || null,
    });
    if (insErr) toast.error("Erro ao registar comprovativo");
    else { toast.success("Comprovativo enviado! Vamos analisar."); setAmount(""); setNotes(""); onUploaded?.(); }
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <Input type="number" placeholder="Valor pago (Kz)" value={amount} onChange={e => setAmount(e.target.value)} className="rounded-xl" />
      <Input placeholder="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl" />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handle} />
      <Button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="w-full rounded-xl bg-gradient-blue text-white h-12 font-bold">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}
        Enviar foto do comprovativo
      </Button>
    </div>
  );
};
