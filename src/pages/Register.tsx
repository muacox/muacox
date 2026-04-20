import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { AuthLayout } from "@/components/AuthLayout";

const Register = () => {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) return;
    setLoading(true);
    try {
      await signUp(form.email, form.password, form.fullName, form.phone);
      navigate("/login");
    } catch {} finally { setLoading(false); }
  };

  return (
    <AuthLayout title="Criar conta" subtitle="Junta-te à MuacoX em segundos">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field icon={User} id="fullName" label="Nome completo" placeholder="Isaac Muaco"
          value={form.fullName} onChange={v => setForm(f => ({ ...f, fullName: v }))} />
        <Field icon={Mail} id="email" type="email" label="Email" placeholder="exemplo@email.com"
          value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
        <Field icon={Phone} id="phone" type="tel" label="Telefone" placeholder="+244 943 443 400"
          value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
        <Field icon={Lock} id="password" type="password" label="Senha (mín. 6 caracteres)" placeholder="••••••••"
          value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} />
        <Button type="submit" disabled={loading}
          className="w-full h-14 rounded-2xl bg-gradient-blue text-white text-base font-bold shadow-strong hover:shadow-glow mt-2">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar conta"}
        </Button>
        <p className="text-center text-sm text-muted-foreground pt-2">
          Já tens conta? <Link to="/login" className="text-primary font-bold">Entrar</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

const Field = ({ icon: Icon, id, label, type = "text", placeholder, value, onChange }: any) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="font-semibold">{label}</Label>
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input id={id} type={type} required value={value} onChange={e => onChange(e.target.value)}
        className="h-14 pl-12 rounded-2xl text-base" placeholder={placeholder} />
    </div>
  </div>
);

export default Register;
