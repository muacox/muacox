import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SecurityGuard } from "@/components/SecurityGuard";
import { useSiteTheme } from "@/hooks/useSiteTheme";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import FreelancerDashboard from "./pages/FreelancerDashboard";
import Marketplace from "./pages/Marketplace";
import MarketplaceProject from "./pages/MarketplaceProject";

const queryClient = new QueryClient();

const ThemeMount = () => { useSiteTheme(); return null; };

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <SecurityGuard />
          <ThemeMount />
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/:slug" element={<MarketplaceProject />} />
            {/* Rota admin oculta — só acessível por link directo + verificação isAdmin */}
            <Route path="/mx-control-9f3a2b" element={<AdminDashboard />} />
            <Route path="/freelancer" element={<FreelancerDashboard />} />
            <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
