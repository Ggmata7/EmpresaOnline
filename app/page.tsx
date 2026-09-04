import { DealsDashboard } from '@/components/deals-dashboard';
import { loadOffers } from '@/lib/catalog';

export default async function Home() {
  return <DealsDashboard offers={await loadOffers()} />;
}
