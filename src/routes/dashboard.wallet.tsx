import { createFileRoute } from '@tanstack/react-router';
import { DashboardWallet } from '@/components/dashboard-wallet';
import { pageHead } from '@/lib/store-data';

export const Route = createFileRoute('/dashboard/wallet')({
  head: () =>
    pageHead(
      'HASA Gold Wallet',
      'Manage your in-game top-up wallet balance, fast 1-click checkout funds, and deposit ledger. HASA GOLD STORE.'
    ),
  component: DashboardWallet,
});
