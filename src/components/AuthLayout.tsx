import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/muacox-logo.png";

interface Props {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout = ({ children, title, subtitle }: Props) => (
  <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary via-primary to-[hsl(250_100%_50%)] relative overflow-hidden">
    {/* Decorative blobs */}
    <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
    <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />

    {/* Top bar */}
    <div className="relative z-10 px-5 pt-6 flex items-center justify-between">
      <Link to="/" className="text-white/90 hover:text-white flex items-center gap-2 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <img src={logo} alt="MuacoX" className="h-10 brightness-0 invert" />
    </div>

    {/* Hero */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-10 px-6 pt-10 pb-8 text-white"
    >
      <h1 className="text-3xl md:text-4xl font-display font-extrabold leading-tight">{title}</h1>
      <p className="text-white/80 mt-2 text-base">{subtitle}</p>
    </motion.div>

    {/* Sheet */}
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="relative z-10 flex-1 bg-background rounded-t-[2.5rem] px-6 pt-8 pb-10 shadow-strong"
    >
      <div className="max-w-md mx-auto">{children}</div>
    </motion.div>
  </div>
);
