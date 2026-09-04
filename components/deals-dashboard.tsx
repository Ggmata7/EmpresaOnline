'use client';

import { useMemo, useState } from 'react';
import { Activity, BadgeCheck, CarFront, Dumbbell, HeartPulse, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfferCard } from '@/components/offer-card';
import { offers, type Category, type Region } from '@/lib/offers';

const categories: Array<{ label: 'Todas' | Category; icon: typeof CarFront }> = [
  { label: 'Todas', icon: Sparkles },
  { label: 'Automotivo', icon: CarFront },
  { label: 'Performance', icon: Dumbbell },
  { label: 'Longevidade', icon: HeartPulse },
];

export function DealsDashboard({ initialRegion = 'brasil' }: { initialRegion?: Region }) {
  const [region, setRegion] = useState<Region>(initialRegion);
  const [category, setCategory] = useState<'Todas' | Category>('Todas');
  const [query, setQuery] = useState('');
  const visibleOffers = useMemo(() => offers.filter((offer) =>
    offer.region === region && (category === 'Todas' || offer.category === category) &&
    offer.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [region, category, query]);
  const averageDiscount = Math.round(visibleOffers.reduce((total, offer) =>
    total + (1 - offer.price / offer.oldPrice) * 100, 0) / Math.max(visibleOffers.length, 1));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1480px] px-4 pb-16 pt-4 sm:px-7 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_30px_rgb(183_244_60/0.2)]">
              <Activity className="size-5" aria-hidden="true" />
            </span>
            <div><p className="font-display text-lg font-extrabold tracking-[-0.03em]">Radar de Ofertas</p><p className="text-xs text-muted-foreground">preços monitorados, descontos reais</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-3 py-2 text-xs font-semibold text-emerald-300">
            <span className="size-2 animate-pulse rounded-full bg-emerald-400" /> Monitoramento ativo · ciclo 6h
          </div>
        </header>

        <section className="grid gap-5 pb-7 pt-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><BadgeCheck className="size-4" /> Curadoria verificada</div>
            <h1 className="max-w-4xl font-display text-[clamp(2.5rem,6vw,5.7rem)] font-black leading-[0.92] tracking-[-0.065em]">O preço cai.<span className="block text-gradient">Você chega primeiro.</span></h1>
          </div>
          <aside className="stats-panel grid grid-cols-3 gap-4 rounded-2xl p-5 lg:grid-cols-1">
            <div><p className="metric-number">{visibleOffers.length}</p><p className="metric-label">ofertas agora</p></div>
            <div><p className="metric-number">{averageDiscount}%</p><p className="metric-label">economia média</p></div>
            <div><p className="metric-number">30d</p><p className="metric-label">histórico comparado</p></div>
          </aside>
        </section>

        <section aria-label="Filtros de ofertas" className="sticky top-2 z-20 mb-7 rounded-2xl border border-white/10 bg-[#111713]/90 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <Tabs value={region} onValueChange={(value) => setRegion(value as Region)}>
              <TabsList className="h-11 w-full rounded-xl bg-black/30 p-1 sm:w-auto">
                <TabsTrigger value="brasil" className="h-9 rounded-lg px-4 data-active:bg-primary data-active:text-black">🇧🇷 Brasil · BRL</TabsTrigger>
                <TabsTrigger value="global" className="h-9 rounded-lg px-4 data-active:bg-cyan-300 data-active:text-black">🌍 Global · USD/AOA</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1 md:pb-0">
                {categories.map(({ label, icon: Icon }) => (
                  <button key={label} type="button" onClick={() => setCategory(label)} className={`filter-pill ${category === label ? 'filter-pill-active' : ''}`}>
                    <Icon className="size-4" />{label}
                  </button>
                ))}
              </div>
              <label className="relative block min-w-[250px]">
                <span className="sr-only">Buscar produtos</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar uma oferta" className="h-10 w-full rounded-xl border border-white/10 bg-black/30 pl-9 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
              </label>
            </div>
          </div>
        </section>

        <section aria-labelledby="offers-heading">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Atualizado há poucos minutos</p><h2 id="offers-heading" className="mt-1 font-display text-2xl font-extrabold tracking-tight">Melhores oportunidades</h2></div>
            <SlidersHorizontal className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          {visibleOffers.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div> :
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center text-muted-foreground">Nenhuma oferta corresponde à busca. Tente outro termo.</div>}
        </section>

        <footer className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:justify-between">
          <p>Os preços podem mudar após a verificação. Confirme as condições na loja.</p><p>Links de afiliado ajudam a manter o monitoramento sem custo adicional.</p>
        </footer>
      </div>
    </main>
  );
}
