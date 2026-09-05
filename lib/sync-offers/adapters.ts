import 'server-only';
import { parseAmazonItemResponse, parseMercadoLivreItem } from './core.mjs';

export type Platform = 'amazon_br' | 'amazon_us' | 'mercado_livre';
export type SyncCandidate = { id: string; platform: Platform; externalId: string | null; sourceUrl: string; currency: 'BRL' | 'USD'; };
export type Observation = {
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string;
  inStock: boolean;
  referencePriceKind: string;
  referenceProvenance: string;
  isDealOfTheDay: boolean;
  expiresAt: string | null;
  shippingPrice: number | null;
  shippingLabel: string | null;
};
export type Adapter = { platform: Platform; configured: boolean; diagnostic: string; fetch: (offer: SyncCandidate) => Promise<Observation> };

async function fetchJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, { ...options, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(7000) });
  // Never return response bodies: marketplace errors can include tokens or account details.
  if (!response.ok) throw new Error(`partner_http_${response.status}`);
  return response.json();
}

const amazonTokens = new Map<string, { value: string; expiresAt: number }>();
const pendingTokens = new Map<string, Promise<string>>();

async function amazonToken(platform: string, clientId: string, clientSecret: string) {
  const cached = amazonTokens.get(platform);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.value;
  if (pendingTokens.has(platform)) return pendingTokens.get(platform)!;
  const request = (async () => {
    const data = await fetchJson('https://api.amazon.com/auth/o2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'creatorsapi::default' }),
    });
    if (typeof data.access_token !== 'string' || !Number.isFinite(Number(data.expires_in))) throw new Error('invalid_oauth_response');
    amazonTokens.set(platform, { value: data.access_token, expiresAt: Date.now() + Math.min(Number(data.expires_in), 3600) * 1000 });
    return data.access_token as string;
  })();
  pendingTokens.set(platform, request);
  try { return await request; } finally { pendingTokens.delete(platform); }
}

export function createMarketplaceAdapters(env: NodeJS.ProcessEnv = process.env): Adapter[] {
  const amazon = (platform: 'amazon_br' | 'amazon_us'): Adapter => {
    const prefix = platform === 'amazon_br' ? 'AMAZON_BR' : 'AMAZON_US';
    const clientId = env[`${prefix}_CREATORS_CLIENT_ID`];
    const clientSecret = env[`${prefix}_CREATORS_CLIENT_SECRET`];
    const tag = env[`${prefix}_TAG`];
    const version = env[`${prefix}_CREATORS_VERSION`] ?? '3.1';
    const configured = Boolean(clientId && clientSecret && tag && version === '3.1');
    const marketplace = platform === 'amazon_br' ? 'www.amazon.com.br' : 'www.amazon.com';
    return {
      platform, configured,
      diagnostic: configured ? 'configured_creators_api' : 'requires_creators_client_id_secret_tag_version_3_1',
      async fetch(offer) {
        if (!configured) throw new Error('adapter_not_configured');
        const asin = offer.externalId || new URL(offer.sourceUrl).pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
        if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) throw new Error('missing_asin');
        const accessToken = await amazonToken(platform, clientId!, clientSecret!);
        const payload = await fetchJson('https://creatorsapi.amazon/catalog/v1/getItems', {
          method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'x-marketplace': marketplace },
          body: JSON.stringify({ itemIds: [asin], itemIdType: 'ASIN', condition: 'New', partnerTag: tag, marketplace,
            resources: ['offersV2.listings.price', 'offersV2.listings.availability', 'offersV2.listings.condition', 'offersV2.listings.dealDetails', 'offersV2.listings.isBuyBoxWinner', 'offersV2.listings.type'] }),
        });
        return parseAmazonItemResponse(payload, asin, offer.currency);
      },
    };
  };
  const token = env.MERCADO_LIVRE_ACCESS_TOKEN;
  return [amazon('amazon_br'), amazon('amazon_us'), {
    platform: 'mercado_livre', configured: Boolean(token),
    diagnostic: token ? 'configured_items_api' : 'requires_mercado_livre_oauth_access_token',
    async fetch(offer) {
      if (!token) throw new Error('adapter_not_configured');
      const id = (offer.externalId || offer.sourceUrl.match(/MLB-?\d+/i)?.[0] || '').replace('-', '').toUpperCase();
      if (!/^MLB\d+$/.test(id)) throw new Error('missing_mercado_livre_item_id');
      return parseMercadoLivreItem(await fetchJson(`https://api.mercadolibre.com/items/${id}`, { headers: { Authorization: `Bearer ${token}` } }), id);
    },
  }];
}
