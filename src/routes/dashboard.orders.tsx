import { createFileRoute } from '@tanstack/react-router';
import { DashboardOrders } from '@/components/dashboard-ui';
import { pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/dashboard/orders')({ head: () => pageHead('Your orders', 'Order history for the frontend demo. No orders are placed. HASA GOLD STORE.'), component: DashboardOrders });
