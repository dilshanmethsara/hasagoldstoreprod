import { createFileRoute } from '@tanstack/react-router';
import { AdminOverview } from '@/components/admin-ui';
import { pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/admin/')({ head: () => pageHead('Admin overview', 'Admin overview in the HASA GOLD STORE public frontend admin demo. No live services.'), component: AdminOverview });
