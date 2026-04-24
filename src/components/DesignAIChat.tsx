import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Loader2, Save, Eye, EyeOff, Trash2, History, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMsg { role: "user" | "assistant"; content: string; css?: string; }
interface Theme { id: string; name: string; description: string | null; css: string; is_active: boolean; created_at: string; }

const STYLE_PREVIEW_ID = "muacox-active-theme";

export const DesignAIChat = () => {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content: "Olá! Sou o teu designer IA. Pede-me para mudar cores, tipografia, sombras, animações ou qualquer detalhe visual do site. Eu só mexo no design — o conteúdo fica intacto.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingCss, setPendingCss] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [savingName, setSavingName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadThemes = async () => {
    const { data } = await supabase.from("site_themes").select("*").order("created_at", { ascending: false });
    if (data) setThemes(data as Theme[]);
  };
  useEffect(() => { loadThemes(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const injectPreview = (css: string) => {
    let el = document.getElementById(STYLE_PREVIEW_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_PREVIEW_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
  };

  const togglePreview = () => {
    if (!pendingCss) return;
    if (previewing) {
      // restore active theme
      supabase.from("site_themes").select("css").eq("is_active", true).maybeSingle().then(({ data }) => {
        injectPreview(data?.css || "");
      });
      setPreviewing(false);
    } else {
      injectPreview(pendingCss);
      setPreviewing(true);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const payload = next.filter(m => m.role !== "assistant" || m.content).map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("design-ai", { body: { messages: payload } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply || "Pronto.";
      const css = (data as any)?.css || "";
      setMessages(prev => [...prev, { role: "assistant", content: reply, css }]);
      if (css) {
        setPendingCss(css);
        injectPreview(css);
        setPreviewing(true);
        toast.success("Pré-visualização aplicada — guarda para tornar permanente.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao falar com a IA");
      setMessages(prev => [...prev, { role: "assistant", content: "Tive um problema a gerar o CSS. Tenta de novo." }]);
    } finally {
      setSending(false);
    }
  };

  const saveAndActivate = async () => {
    if (!pendingCss) { toast.error("Sem CSS para guardar"); return; }
    const name = savingName.trim() || `Tema ${new Date().toLocaleString("pt-AO")}`;
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("site_themes").insert({
      name,
      description: lastUser?.content?.slice(0, 200) || null,
      css: pendingCss,
      is_active: true,
      created_by: userRes.user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Tema "${name}" activado para todos os visitantes`);
    setSavingName("");
    setPendingCss("");
    setPreviewing(false);
    loadThemes();
  };

  const activate = async (id: string) => {
    const { error } = await supabase.from("site_themes").update({ is_active: true }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Tema activado"); loadThemes(); }
  };
  const deactivateAll = async () => {
    const { error } = await supabase.from("site_themes").update({ is_active: false }).eq("is_active", true);
    if (error) toast.error(error.message); else { toast.success("Tema base restaurado"); injectPreview(""); setPreviewing(false); loadThemes(); }
  };
  const removeTheme = async (id: string) => {
    if (!confirm("Apagar este tema?")) return;
    const { error } = await supabase.from("site_themes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); loadThemes(); }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      {/* CHAT */}
      <div className="bg-background rounded-2xl border border-border flex flex-col h-[calc(100vh-14rem)] overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-gradient-blue text-white">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Designer IA · Claude</p>
            <p className="text-[11px] text-white/80">Só altera o design. Nunca toca em conteúdo.</p>
          </div>
          {pendingCss && (
            <Button size="sm" variant="secondary" onClick={togglePreview} className="rounded-full h-8">
              {previewing ? <><EyeOff className="h-3.5 w-3.5 mr-1" />Ocultar</> : <><Eye className="h-3.5 w-3.5 mr-1" />Pré-ver</>}
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/30">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-gradient-blue text-white rounded-br-sm" : "bg-background border border-border rounded-bl-sm"
                }`}>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  {m.css && (
                    <details className="mt-2">
                      <summary className="text-[11px] cursor-pointer opacity-70 hover:opacity-100">Ver CSS gerado</summary>
                      <pre className="mt-1 text-[10px] bg-black/5 dark:bg-white/5 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap break-words font-mono max-h-48 overflow-y-auto">{m.css}</pre>
                    </details>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A pensar no design…
            </div>
          )}
        </div>

        {pendingCss && (
          <div className="border-t border-border p-3 bg-primary/5 flex flex-wrap items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary shrink-0" />
            <Input value={savingName} onChange={e => setSavingName(e.target.value)}
              placeholder="Nome do tema (opcional)" className="flex-1 min-w-[160px] h-9 rounded-lg" />
            <Button size="sm" onClick={saveAndActivate} className="rounded-lg bg-gradient-blue text-white h-9">
              <Save className="h-3.5 w-3.5 mr-1" />Activar para todos
            </Button>
          </div>
        )}

        <div className="p-3 border-t border-border flex items-center gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ex: muda a paleta para tons verdes e adiciona sombras suaves…"
            disabled={sending} className="rounded-full h-11" />
          <Button onClick={send} disabled={sending || !input.trim()} size="icon" className="rounded-full bg-gradient-blue text-white shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* THEMES SIDEBAR */}
      <div className="bg-background rounded-2xl border border-border p-4 h-[calc(100vh-14rem)] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold flex items-center gap-2"><History className="h-4 w-4 text-primary" />Temas guardados</p>
          <Button size="sm" variant="ghost" onClick={deactivateAll} className="text-xs h-7">Restaurar base</Button>
        </div>
        {themes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Sem temas guardados ainda. Conversa com a IA para criar o primeiro.</p>
        )}
        <div className="space-y-2">
          {themes.map(t => (
            <div key={t.id} className={`p-3 rounded-xl border transition ${t.is_active ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{t.name}</p>
                  {t.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(t.created_at).toLocaleDateString("pt-AO")}</p>
                </div>
                {t.is_active && <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full shrink-0">ACTIVO</span>}
              </div>
              <div className="flex gap-1 mt-2">
                {!t.is_active && (
                  <Button size="sm" variant="outline" onClick={() => activate(t.id)} className="flex-1 h-7 text-xs rounded-lg">Activar</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => removeTheme(t.id)} className="h-7 text-destructive hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
