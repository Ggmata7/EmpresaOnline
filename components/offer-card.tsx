'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Clock3, Copy, ShieldCheck, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Offer } from '@/lib/offers';

const formatter = (currency: Offer['currency']) => new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency });
function remainingTime(expiresAt: string) {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export function OfferCard({ offer }: { offer: Offer }) {
  const [countdown, setCountdown] = useState('--h --m --s');
  const [copied, setCopied] = useState(false);
  const discount = offer.discountPercent || Math.round((1 - offer.price / offer.oldPrice) * 100);
  const money = useMemo(() => formatter(offer.currency), [offer.currency]);
  useEffect(() => {
    if (!offer.expiresAt) return;
    setCountdown(remainingTime(offer.expiresAt));
    const timer = window.setInterval(() => setCountdown(remainingTime(offer.expiresAt as string)), 1000);
    return () => window.clearInterval(timer);
  }, [offer.expiresAt]);
  async function copyCoupon() { if (!offer.coupon) return; await navigator.clipboard.writeText(offer.coupon); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }

  return (
    <article className="offer-card group overflow-hidden rounded-[1.35rem] border border-white/10 bg-card">
      <div className="product-strip" role="img" aria-label={`Imagem de ${offer.title}`}>
        {offer.imageUrl ? <img src={offer.imageUrl} alt="" className="absolute inset-0 size-full object-contain p-5" loading="lazy" referrerPolicy="no-referrer" /> : null}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <Badge className="h-7 border-0 bg-primary px-2.5 font-black text-black">-{discount}%</Badge>
          <Badge variant="outline" className="h-7 border-white/15 bg-black/45 text-white backdrop-blur-md"><ShieldCheck className="size-3.5 text-emerald-300" />verificada</Badge>
        </div>
      </div>
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{offer.category}</span><span className="flex items-center gap-2 text-xs text-muted-foreground">{offer.rating ? <span className="flex items-center gap-1 text-amber-300"><Star className="size-3 fill-current" />{offer.rating.toFixed(1)}</span> : null}{offer.retailer}</span></div>
        <h3 className="min-h-[3.5rem] font-display text-lg font-bold leading-snug tracking-[-0.02em]">{offer.title}</h3>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div><p className="text-sm text-muted-foreground line-through">{money.format(offer.oldPrice)}</p><p className="font-display text-3xl font-black tracking-[-0.045em] text-white">{money.format(offer.price)}</p></div>
          {offer.expiresAt ? <div className="rounded-lg bg-white/[0.045] px-2.5 py-2 text-right"><p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground"><Clock3 className="size-3" /> termina em</p><p className="mt-0.5 font-mono text-xs font-semibold text-amber-300">{countdown}</p></div> :
            <div className="rounded-lg bg-white/[0.045] px-2.5 py-2 text-right text-xs text-muted-foreground">Preço verificado</div>}
        </div>
        {offer.coupon && <button type="button" onClick={copyCoupon} className="mt-4 flex w-full items-center justify-between rounded-xl border border-dashed border-primary/35 bg-primary/[0.06] px-3 py-2.5 text-left transition hover:border-primary/70 hover:bg-primary/[0.1]">
          <span><span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Cupom</span><span className="font-mono text-sm font-bold text-primary">{offer.coupon}</span></span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copiado' : 'Copiar'}</span>
        </button>}
        <Button nativeButton={false} className="mt-4 h-11 w-full rounded-xl bg-white font-bold text-black hover:bg-primary" render={<a href={`/api/click/${offer.slug}`} target="_blank" rel="nofollow sponsored noopener" />}>
          Ver oferta com desconto <ArrowUpRight className="size-4" />
        </Button>
      </div>
    </article>
  );
}
