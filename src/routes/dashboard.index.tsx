import { createFileRoute } from '@tanstack/react-router';
import { DashboardOverview } from '@/components/dashboard-ui';
import { pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/dashboard/')({ head: () => pageHead('Your dashboard', 'Your games, favorites, and recently viewed games. HASA GOLD STORE.'), component: DashboardOverview });
