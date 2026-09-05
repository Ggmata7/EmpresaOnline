import { DealsDashboard } from '@/components/deals-dashboard';
import { loadOffers } from '@/lib/catalog';

export const revalidate = 900;

export default async function BrazilCatalog() {
  return <DealsDashboard initialRegion="brasil" offers={await loadOffers('brasil')} />;
}
