export type Region = 'brasil' | 'global';
export type Category = 'Automotivo' | 'Performance' | 'Longevidade';
export type Marketplace = 'amazon-br' | 'amazon-us' | 'mercado-livre';

export type OfferAlternative = {
  id: string;
  retailer: string;
  network: Marketplace;
  price: number;
  currency: 'BRL' | 'USD';
  shippingCost?: number | null;
  shippingLabel?: string;
  lastChecked?: string;
};

export type Offer = {
  id: string;
  productId?: string;
  slug: string;
  region: Region;
  isInternational?: boolean;
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
  shippingCost?: number | null;
  network: Marketplace;
  priceBasis: 'list' | 'history30d';
  historyVerifiedAt?: string;
  lastChecked?: string;
  availability: 'in_stock' | 'unknown' | 'out_of_stock';
  alternatives?: OfferAlternative[];
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

export function networkFromDatabase(platform: string): Marketplace | null {
  const networks: Record<string, Marketplace> = {
    AMAZON_BR: 'amazon-br',
    AMAZON_US: 'amazon-us',
    MERCADO_LIVRE: 'mercado-livre',
    amazon_br: 'amazon-br',
    amazon_us: 'amazon-us',
    mercado_livre: 'mercado-livre',
  };
  return networks[platform] ?? null;
}

export function retailerFromDatabase(platform: string) {
  const retailers: Record<string, string> = {
    AMAZON_BR: 'Amazon Brasil',
    AMAZON_US: 'Amazon EUA',
    MERCADO_LIVRE: 'Mercado Livre',
    amazon_br: 'Amazon Brasil',
    amazon_us: 'Amazon EUA',
    mercado_livre: 'Mercado Livre',
  };
  return retailers[platform] ?? platform.replaceAll('_', ' ');
}

export function limitOffersPerCategory(input: Offer[], limit = CATEGORY_LIMIT) {
  const counts = new Map<string, number>();
  return [...input]
    .sort((a, b) => b.discountPercent - a.discountPercent || a.price - b.price)
    .filter((offer) => {
      const bucket = `${offer.region}:${offer.category}`;
      const current = counts.get(bucket) ?? 0;
      if (current >= limit) return false;
      counts.set(bucket, current + 1);
      return true;
    });
}
