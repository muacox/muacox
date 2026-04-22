import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Star, Quote, Plus, Send, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

interface Testimonial {
  id: string;
  author_name: string;
  message: string;
  rating: number;
  photo_url: string | null;
  created_at: string;
}

const testimonialSchema = z.object({
  author_name: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  message: z.string().trim().min(5, "Mensagem muito curta").max(600, "Máximo 600 caracteres"),
  rating: z.number().int().min(1).max(5),
});

export const TestimonialsSection = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<Testimonial[]>([]);
  const [open, setOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const load = () => {
    supabase.from("testimonials").select("*").eq("approved", true)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => data && setItems(data as Testimonial[]));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("testimonials-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "testimonials" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Auto-scroll infinito (pausa no hover)
  useEffect(() => {
    if (items.length === 0) return;
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    let paused = false;
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("touchstart", onEnter, { passive: true });
    el.addEventListener("touchend", onLeave, { passive: true });

    const tick = () => {
      if (!paused && el) {
        el.scrollLeft += 0.5;
        if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("touchstart", onEnter);
      el.removeEventListener("touchend", onLeave);
    };
  }, [items.length]);

  const looped = items.length > 0 ? [...items, ...items] : [];

  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-background via-muted/30 to-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block text-xs font-bold uppercase tracking-[0.3em] text-primary mb-3">
            Depoimentos
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-extrabold mb-3">
            O que dizem de nós
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Histórias reais de quem confiou no nosso trabalho.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="mt-6 rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-medium">
                <Plus className="h-4 w-4 mr-2" />Deixar depoimento
              </Button>
            </DialogTrigger>
            <NewTestimonialDialog
              user={user}
              profile={profile}
              onClose={() => setOpen(false)}
            />
          </Dialog>
        </motion.div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Sê o primeiro a deixar um depoimento.
          </div>
        ) : (
          <div className="relative">
            {/* Fade laterais */}
            <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div
              ref={trackRef}
              className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide scroll-smooth py-4"
              style={{ scrollbarWidth: "none" }}
            >
              {looped.map((t, idx) => (
                <TestimonialCard key={`${t.id}-${idx}`} t={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const TestimonialCard = ({ t }: { t: Testimonial }) => (
  <motion.article
    whileHover={{ y: -4 }}
    className="shrink-0 w-[300px] md:w-[360px] rounded-3xl p-6 backdrop-blur-xl bg-foreground/[0.04] border border-foreground/10 shadow-soft hover:shadow-medium transition-all"
  >
    <Quote className="h-7 w-7 text-foreground/20 mb-3" />
    <div className="flex gap-0.5 mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < t.rating ? "fill-warning text-warning" : "text-foreground/15"}`}
        />
      ))}
    </div>
    <p className="text-sm md:text-[15px] text-foreground/85 leading-relaxed mb-5 line-clamp-5">
      {t.message}
    </p>
    <div className="flex items-center gap-3 pt-4 border-t border-foreground/10">
      <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-foreground/10 flex items-center justify-center font-display font-bold text-primary shrink-0">
        {t.photo_url ? (
          <img src={t.photo_url} alt={t.author_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          t.author_name.charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0">
        <p className="font-bold text-sm truncate">{t.author_name}</p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(t.created_at).toLocaleDateString("pt-AO", { month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  </motion.article>
);

const NewTestimonialDialog = ({ user, profile, onClose }: any) => {
  const [name, setName] = useState(profile?.full_name || "");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(profile?.avatar_url || null);
  const [saving, setSaving] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { toast.error("Imagem deve ter menos de 3MB"); return; }
    if (!f.type.startsWith("image/")) { toast.error("Apenas imagens"); return; }
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = testimonialSchema.safeParse({
      author_name: name, message, rating,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      let photo_url: string | null = profile?.avatar_url || null;

      if (photo) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${user?.id || "guest"}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("testimonial-photos").upload(path, photo, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("testimonial-photos").getPublicUrl(path);
        photo_url = pub.publicUrl;
      }

      const { error } = await supabase.from("testimonials").insert({
        user_id: user?.id || null,
        author_name: parsed.data.author_name,
        message: parsed.data.message,
        rating: parsed.data.rating,
        photo_url,
        approved: false,
      });
      if (error) throw error;

      toast.success("Obrigado! O teu depoimento será revisto em breve.");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Deixar depoimento</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer relative group">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-muted border-2 border-dashed border-border flex items-center justify-center group-hover:border-primary transition">
              {preview ? (
                <img src={preview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </label>
          <div className="flex-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Foto (opcional)</p>
            <p className="text-xs text-muted-foreground">Clica para escolher</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Teu nome" className="rounded-xl" />
        </div>

        <div className="space-y-2">
          <Label>Avaliação</Label>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i + 1)}
                onMouseEnter={() => setHoverRating(i + 1)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`h-7 w-7 ${i < (hoverRating || rating) ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            maxLength={600}
            rows={4}
            placeholder="Conta a tua experiência…"
            className="rounded-xl resize-none"
          />
          <p className="text-[11px] text-muted-foreground text-right">{message.length}/600</p>
        </div>

        <Button type="submit" disabled={saving} className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Enviar depoimento</>}
        </Button>
        <p className="text-[11px] text-center text-muted-foreground">
          O depoimento será publicado após aprovação.
        </p>
      </form>
    </DialogContent>
  );
};
