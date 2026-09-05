import { ArrowDown, ArrowUpRight, Check, Sparkles } from 'lucide-react';
import { MascotMotion } from '@/components/mascot-motion';

export function HeroSection() {
  return <section aria-labelledby="hero-title" className="mx-auto grid max-w-[1440px] gap-7 px-4 pb-9 pt-7 sm:px-7 md:grid-cols-[1fr_1fr] md:items-center md:gap-10 md:py-10 lg:px-10">
    <div className="max-w-xl">
      <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e7d9bd] bg-[#fff8e9] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[#89521f]"><Sparkles size={13} /> Olho no preço. Faro para ofertas.</p>
      <h1 id="hero-title" className="text-[clamp(2.5rem,4.7vw,4.4rem)] font-extrabold leading-[1.06] tracking-[-.055em] text-[#142f39]">Boas ofertas.<br />Um ótimo <span className="relative whitespace-nowrap text-[#bc591e]">CATch<span className="text-[#142f39]">.</span><svg aria-hidden="true" viewBox="0 0 250 13" className="absolute -bottom-2 left-0 w-full fill-none stroke-[#eab65e] stroke-[5]"><path d="M3 10 Q110 0 247 8" /></svg></span></h1>
      <p className="mt-7 max-w-md text-[15px] leading-7 text-[#607077]">Você encontra o que vale a pena. O CATch reúne ofertas selecionadas de lojas conhecidas para você comprar com mais informação.</p>
      <div className="mt-7 flex flex-wrap items-center gap-4"><a href="#ofertas" className="inline-flex min-h-12 items-center gap-4 rounded-xl bg-[#163740] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#24515c] active:scale-[.98]">Explorar ofertas <ArrowDown size={17} /></a><a href="#como-funciona" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#344d55] hover:text-[#b45a20]">Como funciona <ArrowUpRight size={16} /></a></div>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#607077]"><span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[#27805f]" /> Compra direto na loja</span><span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[#27805f]" /> Sem custo extra pelo link</span></div>
    </div>
    <MascotMotion />
  </section>;
}
