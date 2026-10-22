import { createFileRoute } from "@tanstack/react-router";
import { AccountPage, safeReturn } from "@/components/account-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeReturn(search["redirect"]),
  }),
  head: () =>
    pageHead("Sign up", "Create your HASA GOLD STORE account with secure Firebase authentication."),
  component: Page,
});
function Page() {
  const { redirect } = Route.useSearch();
  return <AccountPage mode="signup" redirect={redirect} />;
}
