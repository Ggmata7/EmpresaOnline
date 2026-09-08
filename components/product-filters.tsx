'use client';

import { memo, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Store, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CATEGORIES, type Category, type Offer, type Region } from '@/lib/offers';

export type CategoryFilter = 'Todas' | Category;
type Props = { region: Region; category: CategoryFilter; onlyDeals: boolean; onlyCoupons: boolean; resultCount: number; offers: Offer[]; onCategoryChange: (value: CategoryFilter) => void; onDealsChange: (value: boolean) => void; onCouponsChange: (value: boolean) => void; onReset: () => void };

function FilterFields({ region, category, onlyDeals, onlyCoupons, offers, onCategoryChange, onDealsChange, onCouponsChange }: Props) {
  return <div className="space-y-6">
    <fieldset><legend className="mb-2 flex items-center gap-2 text-xs font-bold text-[#2f4940]"><Store size={14} /> Categorias</legend>
      {[{ id: 'Todas' as const, name: 'Todas as categorias' }, ...CATEGORIES.map(name => ({ id: name, name }))].map(({ id, name }) => { const count = offers.filter(o => o.region === region && (id === 'Todas' || o.category === id)).length; return <label key={id} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs text-[#65746b]"><input type="radio" name={`category-${region}`} value={id} checked={category === id} onChange={() => onCategoryChange(id)} className="size-4 accent-[#2d624e]" /><span>{name}</span><span className="ml-auto text-[10px] text-[#89988e]">{count}</span></label>; })}
    </fieldset>
    <fieldset className="border-t border-[#e6ebe5] pt-5"><legend className="pt-4 text-xs font-bold text-[#2f4940]">Um filtro a mais</legend><label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs text-[#65746b]"><input type="checkbox" checked={onlyDeals} onChange={e => onDealsChange(e.target.checked)} className="size-4 rounded accent-[#2d624e]" />Mais de 40% OFF</label><label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs text-[#65746b]"><input type="checkbox" checked={onlyCoupons} onChange={e => onCouponsChange(e.target.checked)} className="size-4 rounded accent-[#2d624e]" />Com cupom</label></fieldset>
    <p className="rounded-xl bg-[#edf2eb] p-3 text-[11px] leading-5 text-[#647669]">Preços em {region === 'brasil' ? 'reais (BRL)' : 'dólares (USD)'}. Consulte o frete e as condições de entrega na loja.{region === 'global' && ' Compras internacionais podem ter impostos e restrições de envio.'}</p>
  </div>;
}

export const ProductFilters = memo(function ProductFilters(props: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <aside className="hidden self-start lg:sticky lg:top-28 lg:block" aria-label="Filtros de produtos"><details open className="group rounded-2xl border border-[#e1e7de] bg-[#f6f8f2] p-4"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold text-[#2f4940]"><span className="flex items-center gap-2"><SlidersHorizontal size={16} />Refinar busca</span><ChevronDown size={15} className="transition group-open:rotate-180" /></summary><div className="pt-3"><FilterFields {...props} /><button type="button" onClick={props.onReset} className="mt-3 min-h-11 text-xs font-semibold text-[#607467] underline underline-offset-4">Limpar filtros</button></div></details><div className="px-3 py-5 text-[11px] leading-5 text-[#839087]">Até 100 achados por categoria.<br />Uma seleção para explorar com calma.</div></aside>
    <div className="mb-4 flex items-center justify-between lg:hidden"><p className="text-xs text-[#6f7d73]">{props.resultCount} ofertas encontradas</p><Sheet open={open} onOpenChange={setOpen}><SheetTrigger className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dce5da] bg-white px-4 text-xs font-bold text-[#355344]"><SlidersHorizontal size={15} />Filtros</SheetTrigger><SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-[#e1e7de] bg-[#fafbf6] text-[#243e30]"><SheetHeader><SheetTitle>Encontre o seu CATch</SheetTitle><SheetDescription>Escolha as categorias e as condições da sua busca.</SheetDescription></SheetHeader><div className="px-5 pb-5"><FilterFields {...props} /><div className="mt-5 flex gap-3"><button type="button" onClick={props.onReset} className="flex min-h-12 items-center justify-center gap-1 rounded-xl border px-4 text-sm"><X size={15} />Limpar</button><button type="button" onClick={() => setOpen(false)} className="min-h-12 flex-1 rounded-xl bg-[#245b46] text-sm font-bold text-white">Ver {props.resultCount} ofertas</button></div></div></SheetContent></Sheet></div>
  </>;
});
