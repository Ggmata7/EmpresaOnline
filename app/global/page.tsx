import { DealsDashboard } from '@/components/deals-dashboard';
import { loadOffers } from '@/lib/catalog';
import { HeroSection } from '@/components/hero-section';

export const revalidate = 900;

export default async function GlobalCatalog() {
  return <DealsDashboard hero={<HeroSection />} initialRegion="global" offers={await loadOffers()} />;
}
