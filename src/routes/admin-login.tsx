import { createFileRoute } from "@tanstack/react-router";
import { AdminPasswordLogin } from "@/components/admin-ui";
import { safeReturn } from "@/components/account-ui";
import { pageHead } from "@/lib/store-data";

export const Route = createFileRoute("/admin-login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeReturn(search["redirect"]),
  }),
  head: () => pageHead("Admin sign in", "Sign in to the HASA GOLD STORE admin panel."),
  component: Page,
});

function Page() {
  const { redirect } = Route.useSearch();
  return <AdminPasswordLogin redirect={redirect} />;
}
