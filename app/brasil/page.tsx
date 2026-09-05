import { DealsDashboard } from '@/components/deals-dashboard';
import { loadOffers } from '@/lib/catalog';
import { HeroSection } from '@/components/hero-section';

export const revalidate = 900;

export default async function BrazilCatalog() {
  return <DealsDashboard hero={<HeroSection />} initialRegion="brasil" offers={await loadOffers()} />;
}
