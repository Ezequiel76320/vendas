import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Boxes, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { localApi } from "@/lib/localApi";
import { useSession } from "@/components/SessionProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Informe um e-mail e uma senha com pelo menos 6 caracteres.");
      return;
    }
    setSaving(true);
    const result = mode === "signin"
      ? await localApi.auth.signInWithPassword({ email: email.trim(), password })
      : await localApi.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } });
    setSaving(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(mode === "signin" ? "Login realizado com sucesso." : "Conta criada com sucesso.");
  };

  return (
    <main className="min-h-screen bg-[#f3f7f6] text-slate-900 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0b3b3b] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rotate-12 rounded-[5rem] border border-teal-300/20 bg-teal-300/10" />
        <div className="absolute -bottom-28 -left-20 h-96 w-96 rounded-full border border-cyan-300/20" />
        <div className="relative z-10 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ff765c] text-[#0b3b3b] shadow-lg"><Boxes size={23} strokeWidth={2.5} /></div><span className="text-xl font-black tracking-tight">Controla<span className="text-teal-300">Venda</span></span></div>
        <div className="relative z-10 max-w-xl"><p className="mb-5 text-sm font-bold uppercase tracking-[0.24em] text-teal-200">Gestão comercial sem ruído</p><h1 className="text-5xl font-black leading-[1.04] tracking-[-0.04em]">Controle suas vendas. Organize seu negócio. Acompanhe seus resultados.</h1><p className="mt-7 max-w-md text-base leading-7 text-teal-50/75">Uma operação integrada para vender mais rápido, cuidar do estoque e entender o que realmente acontece no seu negócio.</p><div className="mt-10 grid gap-4 sm:grid-cols-3">{[["Venda rápida", BarChart3], ["Dados locais", ShieldCheck], ["Tudo conectado", CheckCircle2]].map(([label, Icon]) => { const Glyph = Icon as typeof BarChart3; return <div key={label as string} className="rounded-2xl border border-white/10 bg-white/5 p-4"><Glyph size={18} className="mb-4 text-[#ff9b83]" /><p className="text-sm font-bold text-white/90">{label as string}</p></div>; })}</div></div>
        <p className="relative z-10 text-xs text-teal-100/50">Funciona localmente, sem depender de uma plataforma de hospedagem.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10"><div className="w-full max-w-md"><div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f766e] text-white"><Boxes size={23} /></div><span className="text-xl font-black tracking-tight">Controla<span className="text-[#0f766e]">Venda</span></span></div><div className="mb-8"><p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[#0f766e]">Operação local</p><h2 className="text-3xl font-black tracking-[-0.03em] text-slate-900">{mode === "signin" ? "Bem-vindo de volta" : "Crie sua conta"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{mode === "signin" ? "Entre na sua operação para continuar de onde parou." : "Sua empresa será criada automaticamente no primeiro acesso."}</p></div><div className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-36px_rgba(15,118,110,0.45)] sm:p-8"><form onSubmit={submit} className="space-y-5">{mode === "signup" && <div className="space-y-2"><Label htmlFor="full-name">Nome</Label><Input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Seu nome" autoComplete="name" className="h-11 rounded-xl" /></div>}<div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" autoComplete="email" className="h-11 rounded-xl" /></div><div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" autoComplete={mode === "signin" ? "current-password" : "new-password"} className="h-11 rounded-xl" /></div><Button disabled={saving} type="submit" className="h-11 w-full rounded-xl bg-[#0f766e] font-bold hover:bg-[#0b5d57]">{saving ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}</Button></form><button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-5 w-full text-sm font-bold text-[#0f766e] hover:underline">{mode === "signin" ? "Ainda não tenho uma conta" : "Já tenho uma conta"}</button></div><p className="mt-6 text-center text-xs text-slate-400">Banco SQLite local no ambiente de desenvolvimento.</p></div></section>
    </main>
  );
}
