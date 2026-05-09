import { useEffect, useState } from "react";
import { Plus, Edit3, Trash2, Upload, Eye, EyeOff, Loader2, Code2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatKz } from "@/lib/site";
import { toast } from "sonner";

interface Project {
  id: string; slug: string; title: string; description: string | null;
  language: string | null; category: string | null; price: number;
  cover_url: string | null; demo_url: string | null; files_path: string | null;
  features: any; active: boolean; sales_count: number;
}

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + Math.random().toString(36).slice(2, 6);

export const ProjectsManager = ({ freelancerId, userId }: { freelancerId: string; userId: string }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const load = async () => {
    const { data } = await supabase.from("freelancer_projects").select("*").eq("freelancer_id", freelancerId).order("created_at", { ascending: false });
    setProjects((data || []) as Project[]);
  };
  useEffect(() => { load(); }, [freelancerId]);

  const toggleActive = async (p: Project) => {
    await supabase.from("freelancer_projects").update({ active: !p.active }).eq("id", p.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Apagar projecto?")) return;
    await supabase.from("freelancer_projects").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{projects.length} projecto(s) publicado(s)</p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)} className="rounded-full bg-gradient-blue text-white">
              <Plus className="h-4 w-4 mr-1" />Novo projecto
            </Button>
          </DialogTrigger>
          <ProjectForm open={open} setOpen={setOpen} freelancerId={freelancerId} userId={userId} editing={editing} onSaved={load} />
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-background rounded-2xl border border-dashed border-border">
          <Code2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Sem projectos ainda. Cria o primeiro!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {projects.map(p => (
            <div key={p.id} className="bg-background rounded-2xl border border-border overflow-hidden">
              <div className="aspect-video bg-secondary relative">
                {p.cover_url ? <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><Code2 className="h-10 w-10 text-muted-foreground/40" /></div>}
                {!p.active && <span className="absolute top-2 right-2 bg-foreground text-background text-[10px] px-2 py-0.5 rounded-full font-bold">INACTIVO</span>}
              </div>
              <div className="p-3">
                <p className="font-bold truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.language} · {p.sales_count} vendas</p>
                <p className="font-display font-extrabold text-primary mt-1">{formatKz(p.price)}</p>
                <div className="flex gap-1 mt-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(p); setOpen(true); }} className="flex-1 rounded-lg h-8"><Edit3 className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => toggleActive(p)} className="rounded-lg h-8">{p.active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                  <Button size="sm" variant="outline" onClick={() => remove(p.id)} className="rounded-lg h-8 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectForm = ({ open, setOpen, freelancerId, userId, editing, onSaved }: any) => {
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("Web"); const [price, setPrice] = useState(""); const [demo, setDemo] = useState("");
  const [features, setFeatures] = useState(""); const [coverFile, setCoverFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title); setDesc(editing.description || ""); setLanguage(editing.language || "");
      setCategory(editing.category || "Web"); setPrice(String(editing.price)); setDemo(editing.demo_url || "");
      setFeatures((editing.features || []).join("\n"));
    } else {
      setTitle(""); setDesc(""); setLanguage(""); setCategory("Web"); setPrice(""); setDemo(""); setFeatures("");
      setCoverFile(null); setZipFile(null);
    }
  }, [editing, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      let cover_url = editing?.cover_url || null;
      let files_path = editing?.files_path || null;

      if (coverFile) {
        const cp = `${userId}/${Date.now()}-${coverFile.name}`;
        const { error } = await supabase.storage.from("freelancer-covers").upload(cp, coverFile, { upsert: true });
        if (error) throw error;
        const { data: pub } = supabase.storage.from("freelancer-covers").getPublicUrl(cp);
        cover_url = pub.publicUrl;
      }
      if (zipFile) {
        const fp = `${userId}/${Date.now()}-${zipFile.name}`;
        const { error } = await supabase.storage.from("freelancer-files").upload(fp, zipFile, { upsert: true });
        if (error) throw error;
        files_path = fp;
      }

      const payload = {
        freelancer_id: freelancerId, title, description: desc, language, category,
        price: Number(price), cover_url, demo_url: demo || null, files_path,
        features: features.split("\n").map(s => s.trim()).filter(Boolean),
      };

      if (editing) {
        const { error } = await supabase.from("freelancer_projects").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("freelancer_projects").insert({ ...payload, slug: slugify(title) });
        if (error) throw error;
      }
      toast.success("Guardado!"); setOpen(false); onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{editing ? "Editar projecto" : "Novo projecto"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} required className="rounded-xl h-11" /></div>
        <div><Label>Descrição</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className="rounded-xl" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Linguagem/Stack</Label><Input value={language} onChange={e => setLanguage(e.target.value)} placeholder="React, Python..." className="rounded-xl h-11" /></div>
          <div><Label>Categoria</Label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm">
              {["Web", "Mobile", "Bot", "Script", "Design", "API"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div><Label>Preço (Kz)</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} required className="rounded-xl h-11" /></div>
        <div><Label>URL Demo (opcional)</Label><Input value={demo} onChange={e => setDemo(e.target.value)} placeholder="https://..." className="rounded-xl h-11" /></div>
        <div><Label>Funcionalidades (uma por linha)</Label><Textarea value={features} onChange={e => setFeatures(e.target.value)} rows={3} className="rounded-xl" /></div>
        <div><Label>Capa (imagem)</Label><input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] || null)} className="w-full text-sm" /></div>
        <div><Label>Ficheiros do projecto (ZIP)</Label><input type="file" accept=".zip,.rar,.7z" onChange={e => setZipFile(e.target.files?.[0] || null)} className="w-full text-sm" />
          {editing?.files_path && !zipFile && <p className="text-xs text-success mt-1">✓ Ficheiros já carregados</p>}
        </div>
        <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? "Actualizar" : "Publicar")}
        </Button>
      </form>
    </DialogContent>
  );
};
