import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Code2, Sparkles, ArrowLeft, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatKz } from "@/lib/site";

interface Project {
  id: string; slug: string; title: string; description: string | null;
  language: string | null; category: string | null; price: number; currency: string;
  cover_url: string | null; sales_count: number; freelancer_id: string;
}

interface Freelancer { id: string; full_name: string | null; avatar_url: string | null; specialty: string | null; }

const CATEGORIES = ["Todos", "Web", "Mobile", "Bot", "Script", "Design", "API"];

const Marketplace = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [freelancers, setFreelancers] = useState<Map<string, Freelancer>>(new Map());
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("Todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("freelancer_projects")
        .select("id,slug,title,description,language,category,price,currency,cover_url,sales_count,freelancer_id")
        .eq("active", true)
        .order("created_at", { ascending: false });
      const list = (data || []) as Project[];
      setProjects(list);
      const ids = Array.from(new Set(list.map(p => p.freelancer_id)));
      if (ids.length) {
        const { data: fr } = await supabase
          .from("freelancers")
          .select("id,full_name,avatar_url,specialty")
          .in("id", ids);
        const m = new Map<string, Freelancer>();
        (fr || []).forEach((f: any) => m.set(f.id, f));
        setFreelancers(m);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.language || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = cat === "Todos" || p.category?.toLowerCase() === cat.toLowerCase();
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <h1 className="font-display font-extrabold text-xl">Marketplace</h1>
            <p className="text-xs text-muted-foreground">Projectos prontos por freelancers verificados</p>
          </div>
          <Link to="/dashboard"><Button size="sm" variant="outline" className="rounded-full"><ShoppingBag className="h-4 w-4 mr-1.5" />As minhas compras</Button></Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar projecto, linguagem..." className="pl-10 h-12 rounded-2xl" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`shrink-0 px-4 h-9 rounded-full text-sm font-bold transition ${cat === c ? "bg-foreground text-background" : "bg-secondary hover:bg-secondary/80"}`}>
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">A carregar…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold mb-1">Nada encontrado</p>
            <p className="text-sm text-muted-foreground">Ainda não há projectos nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {filtered.map((p, i) => {
              const f = freelancers.get(p.freelancer_id);
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Link to={`/marketplace/${p.slug}`} className="block bg-background rounded-3xl border border-border overflow-hidden shadow-soft hover:shadow-medium transition group">
                    <div className="aspect-video bg-gradient-to-br from-primary/15 to-primary/5 relative overflow-hidden">
                      {p.cover_url ? (
                        <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Code2 className="h-12 w-12 text-primary/40" /></div>
                      )}
                      {p.language && (
                        <span className="absolute top-2 left-2 text-[10px] font-bold bg-foreground/90 text-background px-2 py-1 rounded-full uppercase tracking-wider">{p.language}</span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-bold line-clamp-1">{p.title}</p>
                      {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-blue text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {f?.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : (f?.full_name || "?").charAt(0)}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{f?.full_name || "Freelancer"}</p>
                        </div>
                        <p className="font-display font-extrabold text-primary">{formatKz(p.price)}</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
