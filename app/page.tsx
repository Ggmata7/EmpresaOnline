import { DealsDashboard } from '@/components/deals-dashboard';
import { loadOffers } from '@/lib/catalog';

export const revalidate = 900;

export default async function Home() {
  return <DealsDashboard offers={await loadOffers()} />;
}
