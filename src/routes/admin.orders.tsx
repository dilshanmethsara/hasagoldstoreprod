import { createFileRoute } from '@tanstack/react-router';
import { AdminOrders } from '@/components/admin-ui';
import { pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/admin/orders')({ head: () => pageHead('Orders', 'Sample order management for the HASA GOLD STORE admin workspace.'), component: AdminOrders });
