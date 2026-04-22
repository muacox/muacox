import { useState, useRef } from "react";
import { Loader2, Camera, Save, KeyRound, User as UserIcon, Mail, MapPin, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const ProfileSettings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [address, setAddress] = useState((profile as any)?.address || "");
  const [taxId, setTaxId] = useState((profile as any)?.tax_id || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAuth, setSavingAuth] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initial = (profile?.full_name || user?.email || "?").charAt(0).toUpperCase();

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Máx 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Foto actualizada!"); await refreshProfile(); }
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName, phone,
      address: address || null,
      tax_id: taxId || null,
    } as any).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Perfil guardado"); await refreshProfile(); }
    setSavingProfile(false);
  };

  const saveAuth = async () => {
    setSavingAuth(true);
    const updates: any = {};
    if (email && email !== user?.email) updates.email = email;
    if (password) {
      if (password.length < 6) { toast.error("Senha mínimo 6 caracteres"); setSavingAuth(false); return; }
      if (password !== confirmPassword) { toast.error("Senhas não coincidem"); setSavingAuth(false); return; }
      updates.password = password;
    }
    if (Object.keys(updates).length === 0) { toast.info("Nada para actualizar"); setSavingAuth(false); return; }
    const { error } = await supabase.auth.updateUser(updates);
    if (error) toast.error(error.message);
    else {
      if (updates.email) toast.success("Email actualizado — verifica a tua caixa");
      if (updates.password) toast.success("Senha actualizada");
      setPassword(""); setConfirmPassword("");
    }
    setSavingAuth(false);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Avatar card */}
      <div className="bg-background rounded-3xl border border-border p-6 shadow-soft">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-blue flex items-center justify-center text-white text-3xl font-display font-extrabold ring-4 ring-primary/15">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : initial}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center shadow-medium hover:scale-105 transition">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{profile?.full_name || "Sem nome"}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-1">Toca na câmara para mudar a foto</p>
          </div>
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="bg-background rounded-3xl border border-border p-6 space-y-4 shadow-soft">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-primary" />
          <p className="font-bold">Dados pessoais</p>
        </div>
        <div className="space-y-2">
          <Label>Nome completo</Label>
          <Input value={fullName} onChange={e => setFullName(e.target.value)} className="rounded-xl h-11" />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} className="rounded-xl h-11" placeholder="+244…" />
        </div>
        <Button onClick={saveProfile} disabled={savingProfile}
          className="w-full h-12 rounded-xl bg-gradient-blue text-white font-bold">
          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar dados
        </Button>
      </div>

      {/* Dados de facturação */}
      <div className="bg-background rounded-3xl border border-border p-6 space-y-4 shadow-soft">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-primary" />
          <p className="font-bold">Dados de facturação</p>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">opcional</span>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Usados para gerar facturas em PDF quando o pagamento é confirmado.</p>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Morada</Label>
          <Input value={address} onChange={e => setAddress(e.target.value)} className="rounded-xl h-11" placeholder="Ex: Rua da Missão, 123 — Luanda" />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />NIF / Contribuinte</Label>
          <Input value={taxId} onChange={e => setTaxId(e.target.value)} className="rounded-xl h-11" placeholder="Ex: 5417654321" />
        </div>
        <Button onClick={saveProfile} disabled={savingProfile}
          variant="outline" className="w-full h-11 rounded-xl font-semibold">
          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar facturação
        </Button>
      </div>

      {/* Email + senha */}
      <div className="bg-background rounded-3xl border border-border p-6 space-y-4 shadow-soft">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <p className="font-bold">Conta e segurança</p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl h-11" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="rounded-xl h-11" placeholder="Mínimo 6" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar senha</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-xl h-11" />
          </div>
        </div>
        <Button onClick={saveAuth} disabled={savingAuth}
          className="w-full h-12 rounded-xl bg-foreground text-background font-bold">
          {savingAuth ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Actualizar conta
        </Button>
      </div>
    </div>
  );
};
