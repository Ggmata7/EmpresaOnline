'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, Cat, Heart, Search, ShieldCheck, X } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { BrandMark } from '@/components/brand-mark';
import { ProductFilters, type CategoryFilter } from '@/components/product-filters';
import type { Offer, Region } from '@/lib/offers';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const savings = (offer: Offer) => offer.oldPrice > offer.price ? (1 - offer.price / offer.oldPrice) * 100 : 0;

export function DealsDashboard({ initialRegion = 'brasil', offers, hero }: { initialRegion?: Region; offers: Offer[]; hero: ReactNode }) {
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [category, setCategory] = useState<CategoryFilter>('Todas');
  const [visibleCount, setVisibleCount] = useState(24);
  const [query, setQuery] = useState('');
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [onlyCoupons, setOnlyCoupons] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [sort, setSort] = useState('discount');
  const [saved, setSaved] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(normalize(query.trim()));

  useEffect(() => { try { const value: unknown = JSON.parse(localStorage.getItem('catch:favorites') || '[]'); if (Array.isArray(value)) setSaved(value.filter((id): id is string => typeof id === 'string').slice(0, 500)); } catch { /* Storage can be disabled. */ } }, []);
  const toggleSaved = useCallback((id: string) => setSaved(current => { const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id].slice(-500); try { localStorage.setItem('catch:favorites', JSON.stringify(next)); } catch { /* In-memory favorites still work. */ } return next; }), []);
  const reset = useCallback(() => { setQuery(''); setCategory('Todas'); setOnlyDeals(false); setOnlyCoupons(false); setOnlySaved(false); }, []);
  const savedSet = useMemo(() => new Set(saved), [saved]);
  const indexed = useMemo(() => offers.map(offer => ({ offer, search: normalize(`${offer.title} ${offer.retailer} ${offer.category}`) })), [offers]);
  const visibleOffers = useMemo(() => indexed.filter(({ offer, search }) => offer.region === region && (!now || !offer.expiresAt || Date.parse(offer.expiresAt) > now) && (category === 'Todas' || offer.category === category) && (!deferredQuery || search.includes(deferredQuery)) && (!onlyDeals || savings(offer) > 40) && (!onlyCoupons || !!offer.coupon) && (!onlySaved || savedSet.has(offer.id))).map(({ offer }) => offer).sort((a, b) => sort === 'price' ? a.price - b.price : sort === 'recent' ? (Date.parse(b.verifiedAt || '') || 0) - (Date.parse(a.verifiedAt || '') || 0) : savings(b) - savings(a)), [indexed, now, region, category, deferredQuery, onlyDeals, onlyCoupons, onlySaved, savedSet, sort]);
  useEffect(() => setVisibleCount(24), [region, category, deferredQuery, onlyDeals, onlyCoupons, onlySaved, sort]);
  const activeFilters = category !== 'Todas' || query || onlyDeals || onlyCoupons || onlySaved;

  return <div className="min-h-screen bg-[#fbfcf7] text-[#193b35]">
    <a href="#ofertas" className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Pular para as ofertas</a>
    <div className="bg-[#173b36] px-4 py-2 text-center text-[10px] font-medium tracking-wide text-[#e6eadf] sm:text-[11px]">Seu próximo achado começa aqui. <span className="ml-1 text-[#f5c777]">Compare. Escolha. CATch.</span></div>
    <header className="sticky top-0 z-40 border-b border-[#e6e9e1] bg-[#fbfcf7]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-4 py-4 sm:px-7 lg:gap-8 lg:px-10">
        <a href="/" aria-label="CATch, página inicial" className="shrink-0"><BrandMark /></a>
        <form className="order-3 flex w-full min-w-0 items-center rounded-xl border border-[#dce3d9] bg-white px-3 sm:order-none sm:ml-4 sm:flex-1" role="search" onSubmit={e => { e.preventDefault(); document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <Search size={18} className="shrink-0 text-[#7d8c80]" /><input aria-label="Buscar produtos ou marcas" value={query} onChange={e => setQuery(e.target.value)} placeholder="O que você quer encontrar hoje?" className="min-h-11 w-full bg-transparent px-3 text-sm text-[#344d43] outline-none placeholder:text-[#9aa69d]" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca" className="grid size-11 shrink-0 place-items-center text-[#7a8c7e]"><X size={16} /></button>}
        </form>
        <div className="ml-auto flex items-center gap-3 sm:ml-0"><label className="flex min-h-11 items-center rounded-lg px-1 text-xs font-semibold"><span className="sr-only">País do catálogo</span><select value={region} onChange={e => { setRegion(e.target.value as Region); }} className="min-h-11 max-w-28 cursor-pointer bg-transparent text-[#345444]"><option value="brasil">Brasil · R$</option><option value="global">EUA · US$</option></select></label><button type="button" onClick={() => { setOnlySaved(value => !value); document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' }); }} aria-pressed={onlySaved} className={`flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold ${onlySaved ? 'bg-[#f7ece0] text-[#a45324]' : 'text-[#4d6354]'}`}><Heart size={19} fill={onlySaved ? 'currentColor' : 'none'} /><span className="hidden md:inline">Salvos</span>{saved.length > 0 && <span className="rounded-full bg-[#e8eee2] px-1.5 py-0.5 text-[10px]">{saved.length}</span>}</button></div>
      </div>
    </header>
    <main>
      {hero}
      <div className="border-y border-[#e5e8de] bg-white/70"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs sm:px-7 lg:px-10"><span className="font-medium text-[#809080]">Lojas conhecidas. Novas descobertas.</span><div className="flex flex-wrap items-center gap-5 font-bold tracking-tight text-[#3f554b] sm:gap-8"><span>amazon<span className="ml-1 font-normal text-[#929b92]">BR</span></span><span>amazon<span className="ml-1 font-normal text-[#929b92]">US</span></span><span>mercado livre</span></div><span className="hidden items-center gap-1.5 text-[11px] text-[#738174] xl:flex"><ShieldCheck size={15} />Pagamento no site da loja</span></div></div>
      <section id="ofertas" aria-labelledby="offers-title" className="mx-auto max-w-[1440px] scroll-mt-44 px-4 pb-12 pt-9 sm:scroll-mt-28 sm:px-7 lg:px-10">
        <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#a67b38]">Seleção CATch</p><h2 id="offers-title" className="text-2xl font-extrabold tracking-[-.035em] sm:text-3xl">{onlySaved ? 'Seus achados favoritos' : region === 'global' ? 'Importados / Amazon EUA' : 'Compare preços no Brasil'}</h2><p className="mt-2 text-xs leading-5 text-[#859080]">{onlySaved ? 'Salvos neste navegador, prontos para comparar.' : 'Explore a seleção e encontre uma oferta que faça sentido para você.'}</p></div><span className="hidden rounded-full border border-[#e2e8db] bg-white px-3 py-1.5 text-[10px] text-[#6b806b] sm:block">{region === 'brasil' ? 'Catálogo Brasil' : 'Catálogo EUA'}</span></div>
        <div className="lg:grid lg:grid-cols-[205px_minmax(0,1fr)] lg:gap-6">
          <ProductFilters region={region} category={category} onlyDeals={onlyDeals} onlyCoupons={onlyCoupons} resultCount={visibleOffers.length} offers={offers} onCategoryChange={setCategory} onDealsChange={setOnlyDeals} onCouponsChange={setOnlyCoupons} onReset={reset} />
          <div className="min-w-0">
            <div className="mb-4 flex min-h-10 flex-wrap items-center justify-between gap-2"><p aria-live="polite" aria-atomic="true" className="text-xs text-[#81907d]"><strong className="font-semibold text-[#415b45]">{visibleOffers.length}</strong> ofertas{activeFilters ? ' na sua seleção' : ' para explorar'}{activeFilters && <button onClick={reset} type="button" className="ml-3 min-h-11 text-[11px] text-[#9d662d] underline underline-offset-2">Limpar filtros</button>}</p><label className="flex items-center gap-1 text-[11px] text-[#80907c]">Ordenar: <select aria-label="Ordenar ofertas" value={sort} onChange={e => setSort(e.target.value)} className="min-h-11 max-w-36 cursor-pointer bg-transparent text-xs font-semibold text-[#4d664f]"><option value="discount">Maior desconto</option><option value="price">Menor preço</option><option value="recent">Mais recentes</option></select></label></div>
            <div aria-busy={normalize(query.trim()) !== deferredQuery} className={normalize(query.trim()) !== deferredQuery ? 'opacity-60' : ''}>
              {visibleOffers.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">{visibleOffers.slice(0, visibleCount).map(offer => <ProductCard key={offer.id} offer={offer} saved={savedSet.has(offer.id)} onToggleSaved={toggleSaved} />)}</div> : <div className="rounded-2xl border border-dashed border-[#dce5d5] bg-white px-6 py-16 text-center"><Cat size={40} className="mx-auto mb-4 text-[#a6b69c]" /><h3 className="font-semibold text-[#435d41]">{onlySaved ? 'Seus próximos achados ficam aqui' : region === 'global' ? 'Esta seleção ainda está chegando' : 'Nenhum achado com esses filtros'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#89957f]">{onlySaved ? 'Toque no coração de uma oferta para salvá-la neste navegador.' : 'Assim que houver ofertas disponíveis para esta seleção, elas aparecerão aqui. Você também pode explorar as outras lojas e categorias.'}</p><button type="button" onClick={() => { reset(); setRegion('brasil'); }} className="mt-5 min-h-11 rounded-xl bg-[#edf3e8] px-5 text-sm font-semibold text-[#466642]">Explorar ofertas do Brasil</button></div>}
            </div>
            {visibleCount < visibleOffers.length && <button type="button" onClick={() => setVisibleCount(count => count + 24)} className="mt-6 min-h-11 w-full rounded-xl border bg-white px-4 text-sm">Mostrar mais ofertas</button>}
            <p className="mt-6 text-center text-[10px] leading-5 text-[#929c88]">Preços consultados na data indicada em cada oferta. Confirme preço final, disponibilidade e frete na loja.</p>
          </div>
        </div>
      </section>
      <section id="como-funciona" aria-labelledby="how-title" className="scroll-mt-40 border-t border-[#e5e9dd] bg-[#f1f5e9] px-4 py-10 sm:px-7"><div className="mx-auto max-w-[1360px]"><h2 id="how-title" className="text-xl font-bold tracking-tight text-[#3c573d]">Um bom achado, em três passos.</h2><div className="mt-6 grid gap-6 text-sm md:grid-cols-3">{[{ title: 'Encontre seu CATch', body: 'Filtre por categoria. Compare preços de referência e salve os seus favoritos.' }, { title: 'Confira os detalhes', body: 'Veja a data da consulta, o valor e a loja. O comparador destaca o menor preço entre as ofertas disponíveis.' }, { title: 'Compre com a loja', body: 'O link abre a loja escolhida. Entrega, pagamento, devoluções e atendimento da compra são feitos por ela.' }].map((item, i) => <div key={item.title} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#cbd8bc] text-xs font-bold text-[#6c8654]">0{i + 1}</span><div><h3 className="font-semibold text-[#4f6849]">{item.title}</h3><p className="mt-2 max-w-sm text-xs leading-6 text-[#7b8c70]">{item.body}</p></div></div>)}</div></div></section>
    </main>
    <footer className="bg-[#193b36] px-4 py-9 text-[#b5c5b6] sm:px-7"><div className="mx-auto max-w-[1360px]"><div className="flex flex-wrap items-start justify-between gap-6"><div><BrandMark light /><p className="mt-3 text-xs text-[#9eb3a1]">Faro para ofertas. Cuidado com a sua escolha.</p></div><div className="flex flex-wrap gap-5 text-xs"><a href="#ofertas" className="inline-flex min-h-11 items-center gap-1">Explorar ofertas <ArrowUpRight size={13} /></a><a href="/transparencia" className="inline-flex min-h-11 items-center">Transparência e privacidade</a></div></div><div className="mt-6 border-t border-[#345348] pt-5 text-[11px] leading-6"><p>O CATch pode receber uma comissão pelas compras feitas através dos links, sem custo adicional para você. Como participante do Programa de Associados da Amazon, sou remunerado pelas compras qualificadas efetuadas.</p><p className="mt-1 text-[#91a994]">CATch é um agregador independente. As marcas citadas pertencem aos seus respectivos titulares. A moeda do mascote é ilustrativa e não representa um desconto garantido.</p></div></div></footer>
  </div>;
}
