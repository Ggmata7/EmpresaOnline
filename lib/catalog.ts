import 'server-only';

import {
  categoryFromDatabase,
  limitOffersPerCategory,
  networkFromDatabase,
  retailerFromDatabase,
  type Offer,
  type Region,
} from '@/lib/offers';

type ProductRow = {
  id: string;
  slug: string;
  plataforma: string;
  titulo: string;
  categoria: string;
  subcategoria: string;
  regiao: 'BRASIL' | 'GLOBAL';
  moeda: Offer['currency'];
  url_original: string;
  url_afiliado: string;
  imagem_url: string | null;
  avaliacao: number | string | null;
  preco_atual: number | string;
  preco_medio_30d: number | string;
  desconto_real_percentual: number | string;
  oferta_valida_ate: string | null;
  atualizado_em: string;
  cupons?: Array<{ codigo: string; valido_ate: string | null; ativo: boolean }>;
};

const select =
  'id,slug,plataforma,titulo,categoria,subcategoria,regiao,moeda,url_original,url_afiliado,imagem_url,avaliacao,preco_atual,preco_medio_30d,desconto_real_percentual,oferta_valida_ate,atualizado_em,cupons(codigo,valido_ate,ativo)';

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

function toOffer(row: ProductRow): Offer {
  const coupon = row.cupons?.find(
    (item) => item.ativo && (!item.valido_ate || new Date(item.valido_ate) > new Date()),
  );
  return {
    id: row.id,
    slug: row.slug,
    region: row.regiao === 'BRASIL' ? 'brasil' : 'global',
    category: categoryFromDatabase(row.categoria, row.subcategoria),
    subcategory: row.subcategoria,
    title: row.titulo,
    retailer: retailerFromDatabase(row.plataforma),
    oldPrice: Number(row.preco_medio_30d),
    price: Number(row.preco_atual),
    currency: row.moeda,
    coupon: coupon?.codigo,
    expiresAt: row.oferta_valida_ate || undefined,
    imageUrl: row.imagem_url || undefined,
    rating: row.avaliacao == null ? undefined : Number(row.avaliacao),
    sourceUrl: row.url_original,
    affiliateUrl: row.url_afiliado,
    network: networkFromDatabase(row.plataforma),
    verified: true,
    verifiedAt: row.atualizado_em,
    discountPercent: Number(row.desconto_real_percentual),
  };
}

export async function loadOffers(region?: Region): Promise<Offer[]> {
  const config = env();
  if (!config) return [];
  const filters = [
    'ativo=eq.true',
    'url_afiliado=not.is.null',
    'preco_atual=gt.0',
    'preco_medio_30d=gt.0',
  ];
  if (region) filters.push(`regiao=eq.${region === 'brasil' ? 'BRASIL' : 'GLOBAL'}`);
  const response = await fetch(
    `${config.url}/rest/v1/produtos?select=${encodeURIComponent(select)}&${filters.join('&')}&order=desconto_real_percentual.desc&limit=120`,
    {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      next: { revalidate: 900 },
    },
  );
  if (!response.ok) {
    console.error('Catalog fetch failed', response.status, await response.text());
    return [];
  }
  return limitOffersPerCategory(((await response.json()) as ProductRow[]).map(toOffer));
}

export async function loadOfferBySlug(slug: string) {
  const config = env();
  if (!config) return null;
  const response = await fetch(
    `${config.url}/rest/v1/produtos?select=${encodeURIComponent(select)}&slug=eq.${encodeURIComponent(slug)}&ativo=eq.true&url_afiliado=not.is.null&limit=1`,
    {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      cache: 'no-store',
    },
  );
  if (!response.ok) return null;
  const [row] = (await response.json()) as ProductRow[];
  return row ? toOffer(row) : null;
}
