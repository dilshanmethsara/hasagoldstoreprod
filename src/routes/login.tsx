import { createFileRoute } from '@tanstack/react-router';
import { AccountPage, safeReturn } from '@/components/account-ui';
import { pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/login')({ validateSearch: (search: Record<string, unknown>) => ({ redirect: safeReturn(search['redirect']) }), head: () => pageHead('Login', 'Login for your device-only HASA GOLD STORE demo profile. No real authentication or emails.'), component: Page });
function Page() { const { redirect } = Route.useSearch(); return <AccountPage mode="login" redirect={redirect}/>; }
