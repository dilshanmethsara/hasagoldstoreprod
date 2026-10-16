import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout, DashboardSkeleton } from '@/components/dashboard-ui';
export const Route = createFileRoute('/dashboard')({ component: DashboardLayout, pendingComponent: DashboardSkeleton });
