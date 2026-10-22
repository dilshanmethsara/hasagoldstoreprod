import { createFileRoute } from "@tanstack/react-router";
import { AccountPage, safeReturn } from "@/components/account-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeReturn(search["redirect"]),
    verified: search["verified"] === "1",
  }),
  head: () =>
    pageHead(
      "Login",
      "Log in to your HASA GOLD STORE account with secure Firebase authentication.",
    ),
  component: Page,
});
function Page() {
  const { redirect, verified } = Route.useSearch();
  return <AccountPage mode="login" redirect={redirect} verified={verified} />;
}
