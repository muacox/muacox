import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface AvatarItem { user_id: string; full_name: string | null; avatar_url: string | null; }

/**
 * Anel de avatares públicos — mostra TODOS os utilizadores que têm foto
 * de perfil, independentemente do visitante estar ou não autenticado.
 * RLS na tabela `profiles` apenas permite ao próprio utilizador (ou admin)
 * fazer SELECT, por isso usamos a edge function pública `public-avatars`.
 */
export const AuthAvatarStrip = () => {
  const [avatars, setAvatars] = useState<AvatarItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.functions.invoke("public-avatars");
      if (!error && data?.avatars) setAvatars(data.avatars as AvatarItem[]);
    };
    load();
    const ch = supabase.channel("public-avatars-strip")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (avatars.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 mb-5">
        <div className="flex -space-x-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-8 h-8 rounded-full ring-2 ring-primary/40 bg-gradient-blue" />
          ))}
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Comunidade activa</span>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-3 mb-5">
      <div className="flex -space-x-2.5">
        {avatars.slice(0, 6).map((a, i) => (
          <motion.div
            key={a.user_id}
            initial={{ scale: 0, x: -10 }}
            animate={{ scale: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-background ring-offset-2 ring-offset-background relative"
            style={{ boxShadow: "0 0 0 2px hsl(var(--primary) / 0.6)" }}
            title={a.full_name || "Cliente"}
          >
            <img src={a.avatar_url!} alt="" className="w-full h-full object-cover" loading="lazy" />
          </motion.div>
        ))}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold text-foreground leading-tight">+{avatars.length} clientes activos</span>
        <span className="text-[10px] text-muted-foreground">a confiar na MuacoX</span>
      </div>
    </motion.div>
  );
};
