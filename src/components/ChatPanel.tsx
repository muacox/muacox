import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, Loader2, Image as ImageIcon, X, Mic, Square, Play, Pause, Trash2, SmilePlus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import isaacPhoto from "@/assets/isaac-muaco.webp";

interface Reaction { id: string; message_id: string; user_id: string; emoji: string; }
interface Msg {
  id: string;
  conversation_user_id: string;
  sender_id: string;
  is_admin_sender: boolean;
  body: string | null;
  attachment_url: string | null;
  attachment_kind?: string | null;
  created_at: string;
  deleted_at?: string | null;
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface OnlineAgent {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "freelancer";
}

interface Props {
  conversationUserId: string;
  currentUserId: string;
  isAdmin: boolean;
  fullScreen?: boolean;
}

export const ChatPanel = ({ conversationUserId, currentUserId, isAdmin, fullScreen }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [agents, setAgents] = useState<OnlineAgent[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Fetch online agents from real presence (no hardcoded Isaac duplication) ──
  // Admins are tracked via `freelancers` rows where status='active' AND we look up their role.
  // To keep things simple & consistent with the existing presence system, we list every
  // freelancers row with is_online=true. If a row's user_id has the 'admin' role we tag it as admin.
  useEffect(() => {
    let mounted = true;
    const loadAgents = async () => {
      // 1. Online freelancers
      const { data: online } = await supabase
        .from("freelancers")
        .select("user_id, full_name, avatar_url, status, is_online")
        .eq("status", "active")
        .eq("is_online", true);

      // 2. Admins (always shown as available — Isaac é o suporte principal)
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));

      // 3. Profiles for admins (so we have name/avatar)
      let adminProfiles: any[] = [];
      if (adminIds.size > 0) {
        const { data } = await supabase.functions.invoke("public-avatars");
        adminProfiles = ((data as any)?.avatars || []).filter((p: any) => adminIds.has(p.user_id));
      }

      if (!mounted) return;
      const seen = new Set<string>();
      const list: OnlineAgent[] = [];

      // Add admins first (always visible)
      for (const a of adminProfiles) {
        if (seen.has(a.user_id)) continue;
        seen.add(a.user_id);
        list.push({
          user_id: a.user_id,
          full_name: a.full_name || "Isaac Muaco",
          avatar_url: a.avatar_url || isaacPhoto,
          role: "admin",
        });
      }
      // Fallback: if no admin profile loaded but role exists, show Isaac card
      if (list.length === 0 && adminIds.size > 0) {
        list.push({ user_id: Array.from(adminIds)[0]!, full_name: "Isaac Muaco", avatar_url: isaacPhoto, role: "admin" });
      }

      // Add online freelancers (skip duplicates of admin)
      for (const f of online || []) {
        if (!f.user_id || seen.has(f.user_id) || adminIds.has(f.user_id)) continue;
        seen.add(f.user_id);
        list.push({
          user_id: f.user_id,
          full_name: f.full_name || "Freelancer",
          avatar_url: f.avatar_url,
          role: "freelancer",
        });
      }
      setAgents(list);
    };
    loadAgents();
    const ch = supabase
      .channel("freelancers-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "freelancers" }, loadAgents)
      .subscribe();
    const t = setTimeout(() => setShowWelcome(false), 5000);
    return () => { mounted = false; supabase.removeChannel(ch); clearTimeout(t); };
  }, []);

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

  const send = async (attachmentUrl?: string, kind?: string) => {
    const text = body.trim();
    if (!text && !attachmentUrl) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_user_id: conversationUserId,
      sender_id: currentUserId,
      is_admin_sender: isAdmin,
      body: text || null,
      attachment_url: attachmentUrl || null,
      attachment_kind: kind || (attachmentUrl ? "image" : null),
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
    await send(signed?.signedUrl, "image");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Audio recording (uses MediaRecorder + chat-audio bucket) ──
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 800) { toast.error("Áudio demasiado curto"); return; }
        if (blob.size > 5 * 1024 * 1024) { toast.error("Áudio demasiado longo (máx 5MB)"); return; }
        setSending(true);
        const ext = mime.includes("mp4") ? "m4a" : "webm";
        const path = `${currentUserId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("chat-audio").upload(path, blob, { contentType: mime });
        if (error) { toast.error("Erro no envio do áudio"); setSending(false); return; }
        const { data: signed } = await supabase.storage.from("chat-audio").createSignedUrl(path, 60 * 60 * 24 * 365);
        await send(signed?.signedUrl, "audio");
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = window.setInterval(() => setRecSeconds(s => {
        if (s >= 119) { stopRec(); return s; }
        return s + 1;
      }), 1000);
    } catch {
      toast.error("Permissão do microfone negada");
    }
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (recTimerRef.current) { window.clearInterval(recTimerRef.current); recTimerRef.current = null; }
  };

  // Fullscreen takes the entire viewport (mobile-app feel) on small screens.
  const containerClass = fullScreen
    ? "fixed inset-0 z-40 md:static md:inset-auto md:z-auto flex flex-col bg-background overflow-hidden md:rounded-2xl md:border md:border-border md:h-[calc(100vh-8rem)]"
    : "flex flex-col h-full bg-background border border-border rounded-2xl overflow-hidden";

  return (
    <div className={containerClass}>
      <div className="px-4 py-3 border-b border-border bg-gradient-blue text-white flex items-center gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/40 shrink-0">
          <img src={isaacPhoto} alt="Isaac Muaco" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">Suporte MuacoX</p>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${agents.length > 0 ? "bg-success animate-pulse" : "bg-white/40"}`} />
            <p className="text-[11px] text-white/80">
              {agents.length === 0
                ? "Equipa offline — responderemos em breve"
                : `${agents.length} ${agents.length === 1 ? "agente online" : "agentes online"}`}
            </p>
          </div>
        </div>
        {fullScreen && (
          <button
            onClick={() => window.history.back()}
            className="md:hidden w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Online agents strip — slides in when chat opens */}
      <AnimatePresence>
        {showWelcome && agents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden border-b border-border bg-gradient-to-r from-primary/5 via-success/5 to-primary/5"
          >
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="flex -space-x-3">
                {agents.slice(0, 5).map((a, i) => (
                  <motion.div
                    key={a.user_id}
                    initial={{ x: -20, opacity: 0, scale: 0.6 }}
                    animate={{ x: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.12, type: "spring", stiffness: 200 }}
                    className="relative w-10 h-10 rounded-full ring-2 ring-background overflow-hidden bg-gradient-blue text-white flex items-center justify-center text-xs font-bold shadow-medium"
                    title={`${a.full_name} (${a.role === "admin" ? "Admin" : "Freelancer"})`}
                  >
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt={a.full_name || ""} className="w-full h-full object-cover" />
                    ) : (a.full_name || "?").charAt(0).toUpperCase()}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-background animate-pulse" />
                  </motion.div>
                ))}
              </div>
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="text-xs font-semibold text-foreground/80"
              >
                {agents[0].full_name?.split(" ")[0]} {agents.length > 1 && `e mais ${agents.length - 1}`} {agents.length === 1 ? "está" : "estão"} online para te ajudar
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/30">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-10">
            <p>Olá — envia uma mensagem, áudio ou comprovativo.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map(m => {
            const mine = m.sender_id === currentUserId;
            const isAudio = m.attachment_kind === "audio" || (m.attachment_url || "").match(/\.(webm|m4a|mp3|ogg|wav)/i);
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine ? "bg-gradient-blue text-white rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                }`}>
                  {!mine && m.is_admin_sender && (
                    <p className="text-xs font-bold opacity-70 mb-1">Equipa MuacoX</p>
                  )}
                  {m.attachment_url && isAudio && (
                    <audio controls src={m.attachment_url} className="max-w-[240px] mb-1" preload="metadata" />
                  )}
                  {m.attachment_url && !isAudio && (
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

      <div className="p-3 border-t border-border bg-background flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        {!recording ? (
          <>
            <Button type="button" size="icon" variant="ghost" onClick={() => fileRef.current?.click()} disabled={sending}>
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={startRec} disabled={sending} title="Gravar áudio">
              <Mic className="h-5 w-5" />
            </Button>
            <Input value={body} onChange={e => setBody(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Escreve uma mensagem…" className="rounded-full h-11" />
            <Button type="button" size="icon" onClick={() => send()} disabled={sending || !body.trim()}
              className="rounded-full bg-gradient-blue text-white">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-3 px-4 h-11 rounded-full bg-destructive/10 border border-destructive/30">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-mono font-bold text-destructive">
                {String(Math.floor(recSeconds / 60)).padStart(2, "0")}:{String(recSeconds % 60).padStart(2, "0")}
              </span>
              <span className="text-xs text-muted-foreground">A gravar…</span>
            </div>
            <Button type="button" size="icon" variant="destructive" onClick={stopRec} className="rounded-full">
              <Square className="h-4 w-4" />
            </Button>
          </>
        )}
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
