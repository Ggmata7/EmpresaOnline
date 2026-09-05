import Image from 'next/image';
import { memo } from 'react';
import { ArrowUpRight, Cat, Heart, Star, Store, Truck } from 'lucide-react';
import type { Offer } from '@/lib/offers';

const blurDataUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjVmNWY1Ii8+PC9zdmc+';
const formatters = { BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }), AOA: new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }) };

export const ProductCard = memo(function ProductCard({ offer, priority = false, saved = false, onToggleSaved }: { offer: Offer; priority?: boolean; saved?: boolean; onToggleSaved?: (id: string) => void }) {
  const discount = offer.oldPrice > offer.price ? Math.min(99, Math.max(0, Math.round((1 - offer.price / offer.oldPrice) * 100))) : 0;
  const money = formatters[offer.currency];
  const history = offer.priceBasis === 'history30d';
  const checkedDate = offer.verifiedAt ? new Date(offer.verifiedAt) : null;
  const lastChecked = checkedDate && Number.isFinite(checkedDate.getTime()) ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(checkedDate) : null;
  const retailerLabel = offer.network === 'amazon-us' ? 'Amazon EUA' : offer.retailer;

  return <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e6e9e7] bg-white transition duration-200 hover:-translate-y-1 hover:border-[#bacdc7] hover:shadow-[0_12px_32px_-14px_#12382d40] focus-within:ring-2 focus-within:ring-[#427967]">
    <div className="relative aspect-square overflow-hidden bg-white">
      {offer.imageUrl ? <Image src={offer.imageUrl} alt={offer.title} fill priority={priority} loading={priority ? 'eager' : 'lazy'} placeholder="blur" blurDataURL={blurDataUrl} sizes="(max-width: 639px) 48vw, (max-width: 1023px) 31vw, (max-width: 1279px) 25vw, 21vw" className="object-contain p-5 pt-10 transition-transform duration-300 group-hover:scale-[1.04] sm:p-7 sm:pt-10" /> : <div className="absolute inset-0 grid place-items-center bg-[#f5f7f5] text-[#99aca3]"><Store size={40} aria-label="Imagem indisponível" /></div>}
      {discount > 40 && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#fff0ce] px-2 py-1 text-[10px] font-extrabold text-[#895515] sm:left-3 sm:top-3"><Cat size={12} /> CATch Deal!</span>}
      {onToggleSaved && <button type="button" onClick={() => onToggleSaved(offer.id)} aria-label={`${saved ? 'Remover' : 'Salvar'} ${offer.title} ${saved ? 'dos' : 'nos'} favoritos`} aria-pressed={saved} className={`absolute right-1 top-1 grid size-11 place-items-center rounded-full transition sm:right-2 sm:top-2 ${saved ? 'text-[#bd542d]' : 'text-[#7a8a85] hover:text-[#bd542d]'}`}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>}
    </div>
    <div className="flex flex-1 flex-col border-t border-[#f0f2ee] p-3 sm:p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#68776f]"><span className={`size-1.5 shrink-0 rounded-full ${offer.network === 'mercado-livre' ? 'bg-[#d4a522]' : 'bg-[#cf7627]'}`} />{retailerLabel}</p>
      <h3 className="line-clamp-2 min-h-10 text-[13px] font-medium leading-5 text-[#2e403e] sm:text-sm">{offer.title}</h3>
      <div className="mt-2 flex min-h-5 items-center gap-1 text-[11px] text-[#68776f]">{offer.rating ? <><Star size={12} className="fill-[#d89b2e] text-[#d89b2e]" /><span className="font-semibold text-[#45574e]">{offer.rating.toFixed(1)}</span>{offer.ratingCount ? <span>({offer.ratingCount.toLocaleString('pt-BR')})</span> : <span>na loja</span>}</> : <span>{offer.category}</span>}</div>
      <div className="mt-3">
        <p className="min-h-4 text-[11px] text-[#8a9490]">{discount > 0 && <><span className="sr-only">{history ? 'Média de 30 dias' : 'Preço de referência'}: </span><s>{money.format(offer.oldPrice)}</s></>}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-[clamp(1.05rem,2.5vw,1.55rem)] font-extrabold leading-tight tracking-[-.045em] text-[#193b35]">{money.format(offer.price)}</p>{discount > 0 && <span className="whitespace-nowrap rounded bg-[#e9f5ed] px-1.5 py-1 text-[10px] font-bold text-[#287247]">{discount}% OFF</span>}</div>
        <p className="mt-1.5 text-[10px] leading-4 text-[#7c8781]">{history ? 'Comparado à média registrada em 30 dias' : 'Desconto sobre o preço de referência'}</p>
      </div>
      <div className="mb-3 mt-3 space-y-1 text-[10px] leading-4 text-[#718078]">
        <p className="flex items-center gap-1"><Truck size={12} className="shrink-0" />{offer.shippingLabel || 'Frete e prazo na loja'}</p>
        {lastChecked && <p>Preço consultado em {lastChecked}</p>}
        {offer.coupon && <p className="truncate font-semibold text-[#8a602b]" title={offer.coupon}>Cupom: {offer.coupon}</p>}
      </div>
      <a href={`/api/c/${encodeURIComponent(offer.slug)}?offer=${encodeURIComponent(offer.id)}`} target="_blank" rel="nofollow sponsored noopener noreferrer" className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#edf4f0] px-2 py-2.5 text-xs font-bold text-[#275b48] transition hover:bg-[#245b46] hover:text-white active:scale-[.97] sm:text-sm" aria-label={`Acessar oferta de ${offer.title} em ${retailerLabel}`}>Acessar oferta <ArrowUpRight size={15} /></a>
      {!!offer.alternatives?.filter(item => item.id !== offer.id).length && <details className="mt-2 text-[11px] text-[#607568]"><summary className="flex min-h-11 items-center font-semibold">Comparar outras lojas</summary>{offer.alternatives.filter(item => item.id !== offer.id).map(item => <a key={item.id} href={`/api/c/${encodeURIComponent(offer.slug)}?offer=${encodeURIComponent(item.id)}`} target="_blank" rel="nofollow sponsored noopener noreferrer" className="flex min-h-11 items-center justify-between gap-2 border-t border-[#e6ece1] py-2"><span>{item.retailer}</span><strong>{formatters[item.currency].format(item.price)}</strong></a>)}</details>}
    </div>
  </article>;
});

export const OfferCard = ProductCard;
