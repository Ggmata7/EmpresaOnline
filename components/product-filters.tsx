'use client';

import { memo } from 'react';
import { CarFront, Dumbbell, HeartPulse, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { Category, Region } from '@/lib/offers';

export type CategoryFilter = 'Todas' | Category;
const categories: Array<{ label: CategoryFilter; icon: typeof Sparkles }> = [
  { label: 'Todas', icon: Sparkles }, { label: 'Automotivo', icon: CarFront },
  { label: 'Performance', icon: Dumbbell }, { label: 'Longevidade', icon: HeartPulse },
];

type Props = { region: Region; category: CategoryFilter; query: string; resultCount: number; onRegionChange: (value: Region) => void; onCategoryChange: (value: CategoryFilter) => void; onQueryChange: (value: string) => void };

function FilterFields({ region, category, query, onRegionChange, onCategoryChange, onQueryChange }: Omit<Props, 'resultCount'>) {
  return <div className="space-y-6">
    <fieldset><legend className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Região</legend><div className="grid grid-cols-2 gap-2">
      {([['brasil', 'Brasil · BRL'], ['global', 'Global']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => onRegionChange(value)} aria-pressed={region === value} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold transition ${region === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{label}</button>)}
    </div></fieldset>
    <fieldset><legend className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Categoria</legend><div className="space-y-1">
      {categories.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => onCategoryChange(label)} aria-pressed={category === label} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${category === label ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'}`}><Icon className="size-4" />{label}</button>)}
    </div></fieldset>
    <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Buscar</span><span className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Produto ou marca" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></span></label>
  </div>;
}

export const ProductFilters = memo(function ProductFilters(props: Props) {
  const fields = <FilterFields {...props} />;
  return <>
    <aside className="hidden self-start rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-5 lg:block" aria-label="Filtros de produtos"><div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4 text-base font-semibold text-slate-900"><SlidersHorizontal className="size-4" />Filtros</div>{fields}</aside>
    <div className="sticky top-2 z-30 mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur lg:hidden"><p className="px-2 text-sm font-medium text-slate-600">{props.resultCount} ofertas</p><Sheet><SheetTrigger className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"><SlidersHorizontal className="size-4" />Filtrar</SheetTrigger><SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-slate-200 bg-slate-50 text-slate-900"><SheetHeader><SheetTitle>Filtrar ofertas</SheetTitle><SheetDescription>Refine por região, categoria ou produto.</SheetDescription></SheetHeader><div className="px-4 pb-6">{fields}</div></SheetContent></Sheet></div>
  </>;
});
