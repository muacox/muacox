import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const CTASection = () => {
  return (
    <section className="py-28 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground/95 to-foreground/90" />
      
      {/* Floating glass circles */}
      <motion.div 
        animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-1/4 left-[10%] w-64 h-64 rounded-full border border-white/10"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)" }}
      />
      <motion.div 
        animate={{ x: [0, -15, 0], y: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute bottom-1/4 right-[10%] w-48 h-48 rounded-full border border-white/5"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)" }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full liquid-glass-dark text-white/90 text-sm font-semibold mb-10">
            <Sparkles size={16} className="text-primary" />
            <span>Plataforma #1 de Vendas Digitais</span>
          </div>

          <h2 className="font-display text-4xl md:text-6xl font-extrabold text-white mb-8 tracking-tight leading-[1.1]">
            Comece a vender seus e-books{" "}
            <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              hoje
            </span>
          </h2>
          
          <p className="text-white/60 text-lg md:text-xl mb-12 max-w-xl mx-auto leading-relaxed">
            Junte-se a milhares de criadores que já estão a faturar com a PayVendas. 
            Crie sua conta grátis e receba um bônus de boas-vindas.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/registro">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-10 py-7 w-full sm:w-auto rounded-2xl font-bold shadow-2xl shadow-primary/30 hover:-translate-y-0.5 transition-all">
                <Sparkles className="mr-2" size={20} />
                Criar Conta Grátis
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </Link>
            <Link to="/loja">
              <Button className="liquid-glass-dark text-white/90 hover:text-white text-lg px-10 py-7 w-full sm:w-auto rounded-2xl font-semibold border-0">
                Ver Loja de PDFs
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
