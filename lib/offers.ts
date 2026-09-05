export type Region = 'brasil' | 'global';
export type Category = 'Automotivo' | 'Performance' | 'Longevidade';

export type Offer = {
  id: string;
  slug: string;
  region: Region;
  category: Category;
  subcategory: string;
  title: string;
  retailer: string;
  oldPrice: number;
  price: number;
  currency: 'BRL' | 'USD' | 'AOA';
  coupon?: string;
  expiresAt?: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
  shippingLabel?: string;
  sourceUrl: string;
  network: 'amazon-br' | 'amazon-us' | 'mercado-livre' | 'aliexpress' | 'iherb' | 'generic';
  affiliateUrl?: string;
  verified: boolean;
  verifiedAt?: string;
  discountPercent: number;
};

export const CATEGORY_LIMIT = 20;

export function categoryFromDatabase(category: string, subcategory: string): Category {
  if (category === 'AUTOMOTIVO') return 'Automotivo';
  if (subcategory === 'PERFORMANCE_HIPERTROFIA') return 'Performance';
  return 'Longevidade';
}

export function networkFromDatabase(platform: string): Offer['network'] {
  const networks: Record<string, Offer['network']> = {
    AMAZON_BR: 'amazon-br',
    AMAZON_US: 'amazon-us',
    MERCADO_LIVRE: 'mercado-livre',
    ALIEXPRESS: 'aliexpress',
    IHERB: 'iherb',
  };
  return networks[platform] ?? 'generic';
}

export function retailerFromDatabase(platform: string) {
  const retailers: Record<string, string> = {
    AMAZON_BR: 'Amazon Brasil',
    AMAZON_US: 'Amazon',
    MERCADO_LIVRE: 'Mercado Livre',
    ALIEXPRESS: 'AliExpress',
    IHERB: 'iHerb',
    FARMACIA: 'Farmácia parceira',
    AUTOPECAS: 'Autopeças parceira',
  };
  return retailers[platform] ?? platform.replaceAll('_', ' ');
}

export function limitOffersPerCategory(input: Offer[], limit = CATEGORY_LIMIT) {
  const counts = new Map<Category, number>();
  return [...input]
    .sort((a, b) => b.discountPercent - a.discountPercent || b.price - a.price)
    .filter((offer) => {
      const current = counts.get(offer.category) ?? 0;
      if (current >= limit) return false;
      counts.set(offer.category, current + 1);
      return true;
    });
}
