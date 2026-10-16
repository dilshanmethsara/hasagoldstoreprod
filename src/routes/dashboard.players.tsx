import { createFileRoute } from '@tanstack/react-router';
import { DashboardPlayers } from '@/components/dashboard-ui';
import { pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/dashboard/players')({ head: () => pageHead('Saved Player IDs', 'Manage device-only sample Player IDs. HASA GOLD STORE.'), component: DashboardPlayers });
