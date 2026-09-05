import { DealsDashboard } from '@/components/deals-dashboard';
import { loadOffers } from '@/lib/catalog';

export const revalidate = 900;

export default async function GlobalCatalog() {
  return <DealsDashboard initialRegion="global" offers={await loadOffers('global')} />;
}
