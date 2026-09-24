import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { BarChart3, Boxes, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  return (
    <main className="min-h-screen bg-[#f3f7f6] text-slate-900 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0b3b3b] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-[5rem] border border-teal-300/20 bg-teal-300/10 rotate-12" />
        <div className="absolute -bottom-28 -left-20 h-96 w-96 rounded-full border border-cyan-300/20" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ff765c] text-[#0b3b3b] shadow-lg shadow-black/10"><Boxes size={23} strokeWidth={2.5} /></div>
          <span className="text-xl font-black tracking-tight">Controla<span className="text-teal-300">Venda</span></span>
        </div>
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.24em] text-teal-200">Gestão comercial sem ruído</p>
          <h1 className="text-5xl font-black leading-[1.04] tracking-[-0.04em]">Controle suas vendas. Organize seu negócio. Acompanhe seus resultados.</h1>
          <p className="mt-7 max-w-md text-base leading-7 text-teal-50/75">Uma operação integrada para vender mais rápido, cuidar do estoque e entender o que realmente acontece no seu negócio.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[['Venda rápida', BarChart3], ['Dados seguros', ShieldCheck], ['Tudo conectado', CheckCircle2]].map(([label, Icon]) => {
              const Glyph = Icon as typeof BarChart3;
              return <div key={label as string} className="rounded-2xl border border-white/10 bg-white/5 p-4"><Glyph size={18} className="mb-4 text-[#ff9b83]" /><p className="text-sm font-bold text-white/90">{label as string}</p></div>;
            })}
          </div>
        </div>
        <p className="relative z-10 text-xs text-teal-100/50">Feito para pequenas empresas que querem crescer com clareza.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f766e] text-white"><Boxes size={23} /></div><span className="text-xl font-black tracking-tight">Controla<span className="text-[#0f766e]">Venda</span></span></div>
          <div className="mb-8"><p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[#0f766e]">Acesso seguro</p><h2 className="text-3xl font-black tracking-[-0.03em] text-slate-900">Bem-vindo de volta</h2><p className="mt-2 text-sm leading-6 text-slate-500">Entre na sua operação para continuar de onde parou.</p></div>
          <div className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-36px_rgba(15,118,110,0.45)] sm:p-8">
            <Auth supabaseClient={supabase} providers={[]} appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand: '#0f766e', brandAccent: '#0b5d57', inputBorder: '#dce6e4', inputBorderFocus: '#0f766e', inputText: '#173b3a', inputPlaceholder: '#78908e', messageText: '#5b6d6c' }, radii: { borderRadiusButton: '12px', buttonBorderRadius: '12px', inputBorderRadius: '12px' } } } }} theme="light" localization={{ variables: { sign_in: { email_label: 'E-mail', password_label: 'Senha', button_label: 'Entrar', loading_button_label: 'Entrando...' }, sign_up: { email_label: 'E-mail', password_label: 'Senha', button_label: 'Criar conta', loading_button_label: 'Criando...' }, forgotten_password: { link_text: 'Esqueci minha senha', button_label: 'Enviar instruções', loading_button_label: 'Enviando...' } } }} />
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">Seus dados são protegidos por autenticação segura.</p>
        </div>
      </section>
    </main>
  );
}
