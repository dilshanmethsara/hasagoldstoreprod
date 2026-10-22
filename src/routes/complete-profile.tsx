import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/components/account-context";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/store-data";
import { safeReturn } from "@/components/account-ui";

export const Route = createFileRoute("/complete-profile")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeReturn(search["redirect"]),
  }),
  head: () =>
    pageHead("Complete your profile", "Add the required customer details to access your account."),
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const { redirect } = Route.useSearch();
  const { ready, user, completeProfile } = useAccount();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && !user) {
      void navigate({ to: "/login", search: { redirect, verified: false }, replace: true });
    } else if (ready && user?.profileComplete) {
      void navigate({ to: redirect, replace: true });
    }
  }, [ready, user, redirect, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("fullName") ?? "").trim();
    const phoneNumber = String(values.get("phoneNumber") ?? "").trim();
    if (!values.get("terms")) {
      setError("Please agree to the terms to continue.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await completeProfile(name, phoneNumber);
      toast.success("Profile complete", {
        description: "Your account is ready to use.",
      });
      await navigate({ to: redirect, replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your profile could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !user || user.profileComplete) {
    return (
      <div className="container account-page">
        <div className="empty-state" aria-busy="true">
          <Loader2 className="loading-spin" size={28} />
          <p>Preparing your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container account-page">
      <div className="account-heading">
        <span className="eyebrow">HASA GOLD STORE · ACCOUNT</span>
        <h1>One last step.</h1>
        <p>Complete your customer profile before using your dashboard and store services.</p>
      </div>
      <div className="account-panel">
        <div className="account-disclosure">
          <ShieldCheck size={20} />
          <p>Your details help us identify and support your customer account.</p>
        </div>
        <form className="account-form" onSubmit={(event) => void submit(event)}>
          <div className="form-field">
            <label htmlFor="profile-full-name">Full name</label>
            <input
              id="profile-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              defaultValue={user.name}
              minLength={2}
              maxLength={80}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="profile-email">Email</label>
            <input id="profile-email" type="email" value={user.email} readOnly />
          </div>
          <div className="form-field">
            <label htmlFor="profile-phone">Phone number</label>
            <input
              id="profile-phone"
              name="phoneNumber"
              type="tel"
              autoComplete="tel"
              placeholder="+94771234567"
              maxLength={24}
              required
            />
            <small>Include your country code, for example +94.</small>
          </div>
          <div>
            <label className="check-label">
              <input type="checkbox" name="terms" required />I agree to the terms and conditions.
            </label>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? <Loader2 className="loading-spin" /> : <ArrowRight />}
            {busy ? "Saving profile…" : "Complete profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
