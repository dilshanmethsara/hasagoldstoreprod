import { createFileRoute } from '@tanstack/react-router';
import { AdminAccounts } from '@/components/admin-ui';
import { pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/admin/accounts')({ head: () => pageHead('Marketplace Accounts', 'Manage game account marketplace listings in the HASA GOLD STORE admin workspace.'), component: AdminAccounts });
