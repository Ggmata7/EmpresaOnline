'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { BadgeCheck, ChevronDown, Tag } from 'lucide-react';
import { ProductCard } from '@/components/offer-card';
import { ProductFilters, type CategoryFilter } from '@/components/product-filters';
import { CATEGORY_LIMIT, type Offer, type Region } from '@/lib/offers';

export function DealsDashboard({ initialRegion = 'brasil', offers }: { initialRegion?: Region; offers: Offer[] }) {
  const [region, setRegion] = useState<Region>(initialRegion);
  const [category, setCategory] = useState<CategoryFilter>('Todas');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  const onRegionChange = useCallback((value: Region) => setRegion(value), []);
  const onCategoryChange = useCallback((value: CategoryFilter) => setCategory(value), []);
  const onQueryChange = useCallback((value: string) => setQuery(value), []);

  const visibleOffers = useMemo(() => offers.filter((offer) =>
    offer.region === region && (category === 'Todas' || offer.category === category) &&
    (!deferredQuery || `${offer.title} ${offer.retailer}`.toLocaleLowerCase().includes(deferredQuery))),
  [offers, region, category, deferredQuery]);

  const averageDiscount = useMemo(() => Math.round(visibleOffers.reduce((sum, offer) => sum + offer.discountPercent, 0) / Math.max(visibleOffers.length, 1)), [visibleOffers]);

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <header className="border-b border-amber-300 bg-[#ffe600]">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-full bg-slate-900 text-[#ffe600]"><Tag className="size-4" /></span>Radar de Ofertas</a>
        <span className="hidden items-center gap-1.5 text-xs font-medium text-slate-700 sm:flex"><BadgeCheck className="size-4 text-blue-700" />Ofertas verificadas a cada 6 horas</span>
      </div>
    </header>

    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
        <p className="mb-2 text-sm font-semibold text-blue-700">Compra inteligente, sem ruído</p>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">As melhores ofertas, comparadas com o histórico real</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Curadoria de até {CATEGORY_LIMIT} produtos por categoria. Preços e disponibilidade podem mudar na loja.</p></div>
          <dl className="grid grid-cols-2 gap-6 rounded-xl bg-slate-50 px-5 py-4"><div><dt className="text-xs text-slate-500">Ofertas encontradas</dt><dd className="mt-1 text-2xl font-semibold">{visibleOffers.length}</dd></div><div><dt className="text-xs text-slate-500">Desconto médio</dt><dd className="mt-1 text-2xl font-semibold text-emerald-700">{averageDiscount}%</dd></div></dl>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <ProductFilters region={region} category={category} query={query} resultCount={visibleOffers.length} onRegionChange={onRegionChange} onCategoryChange={onCategoryChange} onQueryChange={onQueryChange} />
        <section aria-labelledby="offers-title" className="min-w-0">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ordenadas por maior desconto</p><h2 id="offers-title" className="mt-1 text-xl font-semibold text-slate-950">Ofertas em destaque</h2></div><ChevronDown className="size-5 text-slate-400" /></div>
          {visibleOffers.length ? <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{visibleOffers.map((offer, index) => <ProductCard key={offer.id} offer={offer} priority={index < 4} />)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="font-semibold text-slate-900">Nenhuma oferta encontrada</p><p className="mt-2 text-sm text-slate-500">Altere os filtros ou tente outra busca.</p></div>}
        </section>
      </div>
    </div>
    <footer className="mt-8 border-t border-slate-200 bg-white"><div className="mx-auto max-w-[1440px] px-4 py-6 text-xs leading-5 text-slate-500 sm:px-6 lg:px-8">Ao comprar pelos links, o Radar de Ofertas pode receber comissão sem custo adicional para você. Confirme preço, frete e disponibilidade na loja parceira.</div></footer>
  </main>;
}
