import Image from 'next/image';
import { ArrowRight, BadgeCheck, Star, Truck } from 'lucide-react';
import type { Offer } from '@/lib/offers';

const blurDataUrl =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjVmNWY1Ii8+PC9zdmc+';

const currency = (code: Offer['currency']) =>
  new Intl.NumberFormat(code === 'BRL' ? 'pt-BR' : 'en-US', {
    style: 'currency', currency: code, maximumFractionDigits: 2,
  });

export function ProductCard({ offer, priority = false }: { offer: Offer; priority?: boolean }) {
  const discount = Math.max(0, Math.round(offer.discountPercent || (1 - offer.price / offer.oldPrice) * 100));
  const money = currency(offer.currency);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-blue-500">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-100 bg-white">
        {offer.imageUrl ? (
          <Image src={offer.imageUrl} alt={offer.title} fill priority={priority} loading={priority ? 'eager' : 'lazy'} placeholder="blur" blurDataURL={blurDataUrl} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : <div className="absolute inset-0 grid place-items-center bg-slate-50 text-xs text-slate-400">Imagem indisponível</div>}
        <span className="absolute left-3 top-3 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">{discount}% OFF</span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="truncate font-medium">{offer.retailer}</span>
          {offer.rating ? <span className="flex shrink-0 items-center gap-1" aria-label={`Nota ${offer.rating} de 5`}><Star className="size-3.5 fill-amber-400 text-amber-400" /><strong className="font-semibold text-slate-700">{offer.rating.toFixed(1)}</strong>{offer.ratingCount ? <span>({offer.ratingCount.toLocaleString('pt-BR')})</span> : null}</span> : null}
        </div>
        <h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-slate-800 sm:text-[15px]">{offer.title}</h3>
        <div className="mt-4">
          <p className="text-xs text-slate-400 line-through">{money.format(offer.oldPrice)}</p>
          <p className="text-2xl font-semibold tracking-tight text-slate-950">{money.format(offer.price)}</p>
          <p className="mt-1 text-xs font-medium text-emerald-700">{discount > 0 ? `${discount}% abaixo da média de 30 dias` : 'Preço verificado'}</p>
        </div>
        <div className="mt-3 min-h-10 space-y-1 text-xs">
          {offer.shippingLabel ? <p className="flex items-center gap-1.5 font-semibold text-emerald-700"><Truck className="size-3.5" /> {offer.shippingLabel}</p> : null}
          <p className="flex items-center gap-1.5 text-slate-500"><BadgeCheck className="size-3.5 text-blue-600" /> Loja parceira · preço verificado</p>
        </div>
        <a href={`/api/click/${offer.slug}`} target="_blank" rel="nofollow sponsored noopener" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" aria-label={`Ver oferta de ${offer.title} em ${offer.retailer}`}>
          Ver oferta <ArrowRight className="size-4" />
        </a>
      </div>
    </article>
  );
}

export const OfferCard = ProductCard;
