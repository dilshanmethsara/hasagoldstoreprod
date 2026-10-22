import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";
import { StoreProvider } from "@/components/store-context";
import { StoreHeader, StoreFooter, BottomNavigation } from "@/components/store-ui";
import { Button } from "@/components/ui/button";
import { AccountProvider, useAccount } from "@/components/account-context";
import { WalletProvider } from "@/components/wallet-context";
import { Toaster } from "@/components/ui/sonner";
import hasaLogo from "@/assets/newhasalogo.png";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HASA GOLD STORE" },
      { name: "description", content: "Explore gaming top-ups at HASA GOLD STORE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: hasaLogo, type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { pathname } = useLocation();
  const admin = pathname.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        <StoreProvider>
          <WalletBridge admin={admin} />
        </StoreProvider>
      </AccountProvider>
    </QueryClientProvider>
  );
}

/** Pass the authenticated Firebase UID to the wallet subscription. */
function WalletBridge({ admin }: { admin: boolean }) {
  const { uid, user, ready, profileCompletionInProgress } = useAccount();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mustCompleteProfile =
    ready && !profileCompletionInProgress && user?.profileComplete === false;

  useEffect(() => {
    if (mustCompleteProfile && pathname !== "/complete-profile") {
      void navigate({
        to: "/complete-profile",
        search: { redirect: "/dashboard" },
        replace: true,
      });
    }
  }, [mustCompleteProfile, pathname, navigate]);

  return (
    <WalletProvider uid={uid}>
      {mustCompleteProfile && pathname !== "/complete-profile" ? (
        <main id="main-content" className="container account-page">
          <div className="empty-state" aria-busy="true">
            <p>Redirecting you to finish setting up your account…</p>
          </div>
        </main>
      ) : (
        <>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          {admin ? (
            <Outlet />
          ) : (
            <>
              <StoreHeader />
              <main id="main-content">
                <Outlet />
              </main>
              <StoreFooter />
              <BottomNavigation />
            </>
          )}
          <Toaster />
        </>
      )}
    </WalletProvider>
  );
}
