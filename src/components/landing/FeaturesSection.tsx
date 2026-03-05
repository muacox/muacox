import { motion } from "framer-motion";
import { BookOpen, ShoppingBag, Wallet, Users, Shield, Gift } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Venda PDFs",
    description: "Publique seus e-books e conteúdos digitais. Receba 85% do valor de cada venda.",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Aceda a uma loja de conteúdos educativos de alta qualidade criados pela comunidade.",
  },
  {
    icon: Wallet,
    title: "Carteira Digital",
    description: "Receba pagamentos por referência PlinqPay e faça saques via IBAN.",
  },
  {
    icon: Users,
    title: "Comunidade",
    description: "Conecte-se com outros criadores de conteúdo. Partilhe conhecimento e resultados.",
  },
  {
    icon: Shield,
    title: "Segurança",
    description: "Verificação KYC obrigatória para garantir transações seguras na plataforma.",
  },
  {
    icon: Gift,
    title: "Programa de Afiliados",
    description: "Ganhe 5% de comissão sobre as vendas dos usuários que você indicar.",
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/20" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="font-display text-4xl md:text-5xl font-extrabold text-foreground mb-5 tracking-tight">
            Tudo que precisa para{" "}
            <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              vender mais
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Uma plataforma completa para infoprodutores e criadores de conteúdo em Angola e Moçambique.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className="liquid-glass rounded-3xl p-7 cursor-default group"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <Icon className="text-primary" size={26} />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
