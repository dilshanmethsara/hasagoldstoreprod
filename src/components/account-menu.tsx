import { Link, useNavigate } from "@tanstack/react-router";
import { Moon, Sun, Monitor, LogOut, Settings, LayoutGrid, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccount } from "./account-context";
export function AccountMenu() {
  const { user, ready, logout, photoUrl } = useAccount();
  const navigate = useNavigate();
  if (!ready) {
    return (
      <div className="header-account-slot">
        <span className="account-menu-placeholder" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="header-account-slot">
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Open account menu">
              {photoUrl ? (
                <img
                  className="user-avatar user-avatar-photo"
                  src={photoUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="account-menu-name">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
              <small className="account-menu-member-id">
                {user.memberId ?? "Assigning member ID…"}
              </small>
            </div>
            <DropdownMenuItem asChild>
              <Link to="/dashboard">
                <LayoutGrid />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/wallet">
                <Wallet />
                HASA Wallet
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/settings">
                <Settings />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await logout();
                await navigate({ to: "/" });
                toast.success("Signed out");
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="account-links">
          <Button asChild variant="ghost" className="login-link">
            <Link to="/login" search={{ redirect: "/dashboard" }}>
              <UserRound />
              <span>Login</span>
            </Link>
          </Button>
          <Button asChild className="signup-link">
            <Link to="/signup" search={{ redirect: "/dashboard" }}>
              Sign Up
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
export function ThemeMenu() {
  const { theme, resolvedTheme, setTheme, ready } = useAccount();
  if (!ready) return <span className="theme-menu-placeholder" aria-hidden="true" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Choose theme" title="Choose theme">
          {resolvedTheme === "dark" ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(
          [
            { value: "light", icon: Sun },
            { value: "dark", icon: Moon },
            { value: "system", icon: Monitor },
          ] as const
        ).map((item) => (
          <DropdownMenuItem
            key={item.value}
            onClick={() => {
              void setTheme(item.value).catch((error: unknown) =>
                toast.error(
                  error instanceof Error ? error.message : "Could not save theme preference.",
                ),
              );
            }}
            aria-label={`${item.value} theme${theme === item.value ? ", selected" : ""}`}
          >
            <item.icon />
            {item.value.charAt(0).toUpperCase() + item.value.slice(1)}
            {theme === item.value && <span className="theme-check">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
