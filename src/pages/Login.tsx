import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { AuthLayout } from "@/components/AuthLayout";

const Login = () => {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch {} finally { setLoading(false); }
  };

  return (
    <AuthLayout title="Bem-vindo de volta" subtitle="Entra para gerir os teus pedidos">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="font-semibold">Email</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="h-14 pl-12 rounded-2xl text-base" placeholder="exemplo@email.com" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="font-semibold">Senha</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="h-14 pl-12 rounded-2xl text-base" placeholder="••••••••" />
          </div>
        </div>
        <Button type="submit" disabled={loading}
          className="w-full h-14 rounded-2xl bg-gradient-blue text-white text-base font-bold shadow-strong hover:shadow-glow">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
        </Button>
        <p className="text-center text-sm text-muted-foreground pt-2">
          Não tens conta?{" "}
          <Link to="/cadastro" className="text-primary font-bold">Criar conta</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
