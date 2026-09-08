'use client';
import Image from 'next/image';
import { memo, useState } from 'react';
import { ArrowUpRight, Heart, Store } from 'lucide-react';
import type { Offer } from '@/lib/offers';
import { competitorFor, trackingHref } from '@/lib/product-comparison';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const blur = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjVmNWY1Ii8+PC9zdmc+';

export const ProductCard = memo(function ProductCard({ offer, priority = false, saved = false, onToggleSaved }: {
  offer: Offer; priority?: boolean; saved?: boolean; onToggleSaved?: (id: string) => void;
}) {
  const [failedImage, setFailedImage] = useState<string>();
  const international = offer.isInternational || offer.region === 'global' || offer.network === 'amazon-us';
  const money = (price: number) => international ? `${usd.format(price)} USD` : brl.format(price);
  const competitor = competitorFor(offer);
  const bestPrice = !!competitor && offer.price <= competitor.price;
  const discount = offer.oldPrice > offer.price ? Math.floor((1 - offer.price / offer.oldPrice) * 100) : 0;
  const store = international ? 'Amazon US' : offer.network === 'amazon-br' ? 'Amazon Brasil' : 'Mercado Livre';
  const checked = offer.lastChecked || offer.verifiedAt;
  if (offer.currency !== (international ? 'USD' : 'BRL')) return null;
  return <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e6e9e7] bg-white transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-[#427967]">
    <div className="relative aspect-square bg-[#fafbf9]">
      {offer.imageUrl && failedImage !== offer.imageUrl ? <Image src={offer.imageUrl} alt={offer.title} fill priority={priority} loading={priority ? 'eager' : 'lazy'} placeholder="blur" blurDataURL={blur} sizes="(max-width: 639px) 48vw, (max-width: 1023px) 31vw, (max-width: 1279px) 25vw, 21vw" onError={() => setFailedImage(offer.imageUrl)} className="object-contain p-5 pt-12 sm:p-7 sm:pt-12" /> : <div role="img" aria-label="Imagem indisponível" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#7d8e85]"><Store size={32} /><span className="text-[11px]">Imagem indisponível</span></div>}
      {(international || bestPrice) && <span className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold ${international ? 'bg-blue-50 text-blue-800' : 'bg-green-50 text-green-800'}`}>{international ? 'Importado (EUA)' : 'Melhor Preço'}</span>}
      {onToggleSaved && <button type="button" onClick={() => onToggleSaved(offer.id)} aria-label={`${saved ? 'Remover' : 'Salvar'} ${offer.title} nos favoritos`} aria-pressed={saved} className="absolute right-1 top-1 grid size-11 place-items-center rounded-full text-[#8d5737]"><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>}
    </div>
    <div className="flex flex-1 flex-col border-t border-[#f0f2ee] p-3 sm:p-4">
      <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-md bg-[#f2f5ef] px-2 py-1 text-[11px] font-semibold text-[#456050]"><Store size={12} />{store}</span>
      <h3 className="line-clamp-2 min-h-10 text-[13px] font-medium leading-5 text-[#2e403e] sm:text-sm">{offer.title}</h3>
      {offer.rating != null && <p className="mt-2 text-xs text-[#68776f]">★ {offer.rating.toFixed(1)}{offer.ratingCount ? ` · ${offer.ratingCount.toLocaleString('pt-BR')} avaliações` : ' na loja'}</p>}
      <div className="mb-3 mt-4">
        {discount > 0 && <p className="mb-1 text-xs text-[#7c8781]"><span className="sr-only">Preço de referência: </span><s>{money(offer.oldPrice)}</s></p>}
        <div className="flex flex-wrap items-center gap-2"><p className="text-[clamp(1.1rem,2.5vw,1.65rem)] font-extrabold tracking-tight text-[#193b35]">{money(offer.price)}</p>{discount > 0 && <span className="rounded bg-green-50 px-1.5 py-1 text-[10px] font-bold text-green-800">{discount}% OFF</span>}</div>
        <p className="mt-1 text-[10px] leading-4 text-[#68776f]">{bestPrice ? 'Menor preço entre as lojas listadas, sem frete.' : discount > 0 ? 'Desconto sobre o preço de referência.' : 'Preço vigente na loja.'}</p>
      </div>
      <div className="mb-3 space-y-1 text-[10px] leading-4 text-[#68776f]"><p>{offer.shippingLabel || 'Frete e prazo a confirmar na loja'}</p>{international && <p>Compra internacional · impostos e entrega a confirmar.</p>}{checked && Number.isFinite(Date.parse(checked)) && <p>Consultado em {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(checked))}</p>}{offer.coupon && <p>Cupom: {offer.coupon}</p>}</div>
      <a href={trackingHref(offer.slug, offer.id)} target="_blank" rel="nofollow sponsored noopener noreferrer" aria-label={`Ir para ${store}: ${offer.title}, ${money(offer.price)}`} className="mt-auto inline-flex min-h-11 items-center justify-center gap-1 rounded-lg bg-[#245b46] px-2 py-3 text-xs font-bold text-white transition hover:bg-[#193b35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[.97] sm:text-sm">{international ? 'Comprar na Amazon US' : 'Ir para a Loja'}<ArrowUpRight size={15} /></a>
      {competitor && <a href={trackingHref(offer.slug, competitor.id)} target="_blank" rel="nofollow sponsored noopener noreferrer" className="mt-2 flex min-h-11 items-center rounded px-1 py-2 text-[11px] leading-5 text-[#526b60] underline decoration-[#b7c8bf] underline-offset-4 hover:text-[#193b35] focus-visible:outline focus-visible:outline-2">Também {competitor.network === 'amazon-br' ? 'na Amazon' : 'no Mercado Livre'} por {brl.format(competitor.price)}</a>}
    </div>
  </article>;
});
