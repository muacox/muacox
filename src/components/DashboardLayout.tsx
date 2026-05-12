import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, MessageCircle, FileText, LogOut, Shield, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/muacox-logo.png";

interface Props { children: ReactNode; admin?: boolean; }

export const DashboardLayout = ({ children, admin }: Props) => {
  const { signOut, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const ADMIN_PATH = "/mx-control-9f3a2b";
  const items = admin
    ? [
        { to: ADMIN_PATH, icon: LayoutDashboard, label: "Visão geral" },
      ]
    : [
        { to: "/dashboard", icon: LayoutDashboard, label: "Painel" },
      ];

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  return (
    <div className="min-h-screen bg-secondary/40 flex flex-col md:flex-row">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-background border-r border-border p-6 gap-6 sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="MuacoX" className="h-16 w-auto" />
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          {items.map(it => (
            <Link key={it.to} to={it.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                pathname === it.to ? "bg-gradient-blue text-white shadow-medium" : "hover:bg-secondary"
              }`}>
              <it.icon className="h-4 w-4" />{it.label}
            </Link>
          ))}
          {isAdmin && !admin && (
            <Link to={ADMIN_PATH} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-secondary text-primary">
              <Shield className="h-4 w-4" />Área Admin
            </Link>
          )}
          {admin && (
            <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-secondary">
              <Home className="h-4 w-4" />Painel cliente
            </Link>
          )}
        </nav>
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-blue flex items-center justify-center text-white font-bold shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (profile?.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sessão</p>
              <p className="text-sm font-bold truncate">{profile?.full_name || "Utilizador"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start mt-2 text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4 mr-2" />Sair
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 bg-background border-b border-border px-4 h-14 flex items-center justify-between">
        <Link to="/"><img src={logo} alt="MuacoX" className="h-12 w-auto" /></Link>
        <div className="flex items-center gap-2">
          {isAdmin && !admin && (
            <Link to={ADMIN_PATH}><Button size="sm" variant="outline" className="rounded-full"><Shield className="h-4 w-4" /></Button></Link>
          )}
          <Button size="sm" variant="ghost" onClick={handleSignOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
};
