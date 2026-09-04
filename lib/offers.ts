export type Region = 'brasil' | 'global';
export type Category = 'Automotivo' | 'Performance' | 'Longevidade';

export type Offer = {
  id: string;
  slug: string;
  region: Region;
  category: Category;
  title: string;
  retailer: string;
  oldPrice: number;
  price: number;
  currency: 'BRL' | 'USD';
  coupon?: string;
  expiresAt: string;
  imagePosition: 'left' | 'center' | 'right';
  sourceUrl: string;
  network: 'amazon-br' | 'amazon-us' | 'mercado-livre' | 'iherb';
  affiliateUrl?: string;
  verified: boolean;
};

const futureDate = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

export const offers: Offer[] = [
  {
    id: 'of-001', slug: 'kit-manutencao-motor-premium', region: 'brasil', category: 'Automotivo',
    title: 'Kit manutenção: óleo sintético + filtro premium', retailer: 'Mercado Livre',
    oldPrice: 389.9, price: 249.9, currency: 'BRL', coupon: 'AUTO20', expiresAt: futureDate(5),
    imagePosition: 'left', sourceUrl: 'https://www.mercadolivre.com.br/', network: 'mercado-livre', verified: true,
  },
  {
    id: 'of-002', slug: 'combo-whey-creatina', region: 'brasil', category: 'Performance',
    title: 'Combo performance: whey isolado + creatina', retailer: 'Amazon Brasil',
    oldPrice: 319.8, price: 219.9, currency: 'BRL', expiresAt: futureDate(11),
    imagePosition: 'center', sourceUrl: 'https://www.amazon.com.br/', network: 'amazon-br', verified: true,
  },
  {
    id: 'of-003', slug: 'serum-antioxidante-colageno', region: 'brasil', category: 'Longevidade',
    title: 'Sérum antioxidante + colágeno hidrolisado', retailer: 'Amazon Brasil',
    oldPrice: 239.9, price: 154.9, currency: 'BRL', coupon: 'CUIDADO15', expiresAt: futureDate(20),
    imagePosition: 'right', sourceUrl: 'https://www.amazon.com.br/', network: 'amazon-br', verified: true,
  },
  {
    id: 'of-004', slug: 'premium-brake-service-kit', region: 'global', category: 'Automotivo',
    title: 'Premium brake service kit for European models', retailer: 'Amazon Global',
    oldPrice: 189, price: 129, currency: 'USD', expiresAt: futureDate(8),
    imagePosition: 'left', sourceUrl: 'https://www.amazon.com/', network: 'amazon-us', verified: true,
  },
  {
    id: 'of-005', slug: 'creatine-performance-stack', region: 'global', category: 'Performance',
    title: 'Creatine performance stack — 90 servings', retailer: 'iHerb',
    oldPrice: 64.9, price: 42.5, currency: 'USD', coupon: 'GLOBAL10', expiresAt: futureDate(16),
    imagePosition: 'center', sourceUrl: 'https://www.iherb.com/', network: 'iherb', verified: true,
  },
  {
    id: 'of-006', slug: 'longevity-essentials', region: 'global', category: 'Longevidade',
    title: 'Longevity essentials: antioxidants + daily serum', retailer: 'iHerb',
    oldPrice: 89.5, price: 58.2, currency: 'USD', expiresAt: futureDate(26),
    imagePosition: 'right', sourceUrl: 'https://www.iherb.com/', network: 'iherb', verified: true,
  },
];
