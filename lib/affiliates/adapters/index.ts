import { tagAffiliateUrl, type Platform } from '../tagger.ts';

export interface MarketplaceAdapter<TPayload, TOffer> {
  readonly platform: string;
  buildAffiliateUrl(rawUrl: string): string;
  parseOffer(payload: TPayload): TOffer[];
  validateCurrency(currency: string): boolean;
}

/** Parsers are injected: new retailers need no changes to the ingestion orchestrator. */
export function createMarketplaceAdapter<TPayload, TOffer extends { currency: string; sourceUrl: string }>(
  platform: Platform, parser: (payload: TPayload) => TOffer[],
): MarketplaceAdapter<TPayload, TOffer & { affiliateUrl: string }> {
  const currency = platform === 'amazon_us' ? 'USD' : 'BRL';
  return {
    platform,
    buildAffiliateUrl: rawUrl => tagAffiliateUrl(rawUrl, platform),
    validateCurrency: value => value === currency,
    parseOffer: payload => parser(payload).filter(row => row.currency === currency).map(row => ({
      ...row, affiliateUrl: tagAffiliateUrl(row.sourceUrl, platform),
    })),
  };
}

export class AdapterRegistry {
  private adapters = new Map<string, MarketplaceAdapter<unknown, unknown>>();
  register(adapter: MarketplaceAdapter<unknown, unknown>) {
    if (this.adapters.has(adapter.platform)) throw new Error('duplicate_adapter');
    this.adapters.set(adapter.platform, adapter);
  }
  get(platform: string) {
    const adapter = this.adapters.get(platform);
    if (!adapter) throw new Error('unsupported_marketplace');
    return adapter;
  }
}
// Shopee, AliExpress/Alibaba and Amazon DE/ES require their own validated attribution,
// currencies and schema migration before registration; never reuse Brazilian tags.
