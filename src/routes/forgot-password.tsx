import { createFileRoute } from "@tanstack/react-router";
import { AccountPage, safeReturn } from "@/components/account-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/forgot-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeReturn(search["redirect"]),
  }),
  head: () =>
    pageHead(
      "Forgot password",
      "Reset your HASA GOLD STORE password. We will email you a secure reset link.",
    ),
  component: Page,
});
function Page() {
  const { redirect } = Route.useSearch();
  return <AccountPage mode="forgot" redirect={redirect} />;
}
