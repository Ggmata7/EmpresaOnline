export type Region = 'brasil' | 'global';
export const CATEGORIES = ['Eletrônicos, Celulares e Informática', 'Casa, Móveis e Decoração', 'Beleza e Cuidado Pessoal', 'Acessórios para Veículos', 'Moda (Roupas, Calçados e Bolsas)', 'Esporte e Fitness', 'Livros e Mídia'] as const;
export type Category = typeof CATEGORIES[number];

export function classifyCategory(title: string): Category | null {
  const text = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/automotiv|pneu|car tire|inflator|compressor|dash.?cam|veicular|oil filter|filtro.*oleo/.test(text)) return CATEGORIES[3];
  if (/creatina|whey|proteina|fitness|yoga|dumbbell|resistance band|halter|treino|suplemento|vitamina|omega/.test(text)) return CATEGORIES[5];
  if (/mouse|teclado|keyboard|headphone|fone|earbud|tablet|notebook|laptop|smart|usb|charger|carregador|monitor|ssd|camera|gadget|speaker|bluetooth|echo|fire tv|celular/.test(text)) return CATEGORIES[0];
  if (/livro|book|novel|manga|vinil|blu.ray|dvd/.test(text)) return CATEGORIES[6];
  if (/camiseta|shirt|tenis|sneaker|roupa|calca|bolsa|bag|sapato|shoe|vestido/.test(text)) return CATEGORIES[4];
  if (/creme|cream|lotion|locao|shampoo|perfume|beleza|skin|protetor solar|maquiagem|hidratante|gold bond|colageno/.test(text)) return CATEGORIES[2];
  if (/casa|mesa|cadeira|panela|sofa|lampada|decor|cozinha|airfryer|liquidificador|ventilador|organizador|kitchen|pillow|travesseiro|toalha/.test(text)) return CATEGORIES[1];
  return null;
}
export type Marketplace = 'amazon-br' | 'amazon-us' | 'mercado-livre';

export type OfferAlternative = {
  coupon?: string;
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

export const CATEGORY_LIMIT = 100;

export function categoryFromDatabase(category: string, subcategory: string, title = ''): Category {
  if (CATEGORIES.includes(category as Category)) return category as Category;
  return classifyCategory(title) ?? (/AUTOMOTIVO|Automotivo/.test(category) ? CATEGORIES[3] : /TECNOLOGIA|Tecnologia/.test(category) ? CATEGORIES[0] : /PERFORMANCE|Performance/.test(category + subcategory) ? CATEGORIES[5] : CATEGORIES[2]);
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
