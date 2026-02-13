import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Loader2, Globe, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import payvendasLogo from "@/assets/payvendas-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_COUNTRIES = [
  { code: "+244", name: "Angola", flag: "AO" },
  { code: "+258", name: "Moçambique", flag: "MZ" },
];

const Register = () => {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(ALLOWED_COUNTRIES[0]);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const { signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (referralCode) {
      fetchReferrerInfo();
    }
  }, [referralCode]);

  const fetchReferrerInfo = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('referral_code', referralCode)
        .single();
      if (data) setReferrerName(data.full_name);
    } catch (error) {
      console.log('Referral code not found');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    const phoneRegex = /^9\d{8}$/;
    if (!phoneRegex.test(formData.phone)) {
      toast.error("Número de telefone inválido. Use o formato: 9XX XXX XXX");
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `${selectedCountry.code}${formData.phone}`;
      await signUp(formData.email, formData.password, formData.name, fullPhone, referralCode || undefined);
      toast.success("Conta criada! Verifique seu email para ativar a conta.");
      navigate("/login");
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top section */}
      <div className="flex flex-col items-center justify-center px-6 pt-12 pb-6">
        <motion.img
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          src={payvendasLogo}
          alt="PayVendas"
          className="h-14 mb-3"
        />
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display text-2xl font-extrabold text-foreground tracking-tight"
        >
          Criar Conta
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-sm mt-1"
        >
          Junte-se à comunidade PayVendas
        </motion.p>
      </div>

      {/* Bottom form */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="flex-1 bg-card rounded-t-[2rem] px-6 pt-6 pb-10 border-t border-border/30 shadow-xl overflow-y-auto"
      >
        <div className="max-w-md mx-auto space-y-5">
          {referralCode && referrerName && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center gap-3">
              <Gift className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm text-primary font-medium">Indicado por {referrerName}</p>
                <p className="text-xs text-muted-foreground">Você foi convidado!</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-foreground text-sm font-semibold">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  type="text"
                  placeholder="Seu nome completo"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="pl-11 h-12 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary rounded-xl"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-foreground text-sm font-semibold">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="pl-11 h-12 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary rounded-xl"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-foreground text-sm font-semibold">Telefone</label>
              <div className="flex gap-2">
                <Select
                  value={selectedCountry.code}
                  onValueChange={(val) => setSelectedCountry(ALLOWED_COUNTRIES.find(c => c.code === val) || ALLOWED_COUNTRIES[0])}
                >
                  <SelectTrigger className="w-28 h-12 bg-secondary/50 border-border text-foreground rounded-xl">
                    <SelectValue>
                      <span className="flex items-center gap-1.5">
                        <Globe size={14} className="text-muted-foreground" />
                        <span className="text-sm">{selectedCountry.code}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOWED_COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <span className="flex items-center gap-2">
                          <span>{country.name}</span>
                          <span className="text-muted-foreground">{country.code}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    type="tel"
                    placeholder="9XX XXX XXX"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, '').slice(0, 9))}
                    className="pl-11 h-12 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary rounded-xl"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-foreground text-sm font-semibold">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  className="pl-11 pr-10 h-12 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary rounded-xl"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-foreground text-sm font-semibold">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Repita sua senha"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField("confirmPassword", e.target.value)}
                  className="pl-11 h-12 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary rounded-xl"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                className="rounded border-border bg-secondary mt-0.5 w-4 h-4 text-primary focus:ring-primary"
                required
              />
              <span className="text-xs text-muted-foreground leading-tight">
                Li e aceito os{" "}
                <Link to="/termos" className="text-primary hover:underline">Termos</Link>{" "}
                e a{" "}
                <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>
              </span>
            </div>

            <Button
              type="submit"
              className="w-full h-13 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-lg shadow-primary/25"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Criar Conta
                  <ArrowRight className="ml-2" size={18} />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-sm">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-primary hover:underline font-bold">
              Entrar
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pb-4">
            <Globe size={12} />
            <span>Disponível apenas para Angola e Moçambique</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
