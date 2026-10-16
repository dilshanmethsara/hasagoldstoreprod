import { createFileRoute } from '@tanstack/react-router';
import { AdminSupport } from '@/components/admin-ui';
import { pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/admin/support')({ head: () => pageHead('Support & FAQs', 'Manage support tickets and FAQ content in the HASA GOLD STORE admin workspace.'), component: AdminSupport });
