import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAccount } from "./account-context";

export function PasswordField({
  label = "Password",
  name = "password",
  hint = false,
  error,
}: {
  label?: string;
  name?: string;
  hint?: boolean;
  error?: string | undefined;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const strength =
    Number(value.length >= 8) +
    Number(/[A-Z]/.test(value) && /[a-z]/.test(value)) +
    Number(/[0-9]/.test(value)) +
    Number(/[^a-zA-Z0-9]/.test(value));
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <div className="password-input">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          maxLength={128}
          autoComplete={name === "password" && !hint ? "current-password" : "new-password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={`${name}-hint`}
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      <div id={`${name}-hint`}>
        {hint && (
          <>
            <div className="password-strength" data-strength={strength}>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} data-filled={strength >= n} />
              ))}
            </div>
            <small>
              {value
                ? ["Very weak", "Weak", "Fair", "Good", "Strong"][strength]
                : "Use 8+ characters, with mixed case, a number, and a symbol."}
            </small>
          </>
        )}
        {error && <p className="field-error">{error}</p>}
      </div>
    </div>
  );
}
export function FormField({
  label,
  name,
  type = "text",
  value,
  error,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | undefined;
  error?: string | undefined;
  autoComplete?: string;
}) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={value}
        maxLength={type === "email" ? 254 : 80}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        required
      />
      {error && (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
export const safeReturn = (value: unknown) =>
  typeof value === "string" &&
  (/^\/dashboard(?:\/(?:orders|players|favorites|profile|settings|wallet))?$/.test(value) ||
    value === "/admin" ||
    /^\/admin(?:\/(?:accounts|deposits|games|orders|packages|settings|support|users))?\/?$/.test(
      value,
    ))
    ? value
    : "/dashboard";

/** Maps a Firebase Auth error to a short, user-friendly message. */
function friendlyAuthError(error: unknown): string {
  if (error instanceof Error && error.name === "FirebaseSetupError") return error.message;
  const code = (error as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with this email. Sign up first.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Log in instead.";
    case "auth/weak-password":
      return "Choose a stronger password (8+ characters with mixed characters).";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a bit or reset your password.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled for this project.";
    case "auth/email-not-verified":
      return error instanceof Error
        ? error.message
        : "Verify your email address before signing in.";
    default:
      return error instanceof Error && error.message
        ? error.message
        : "Something went wrong. Please try again.";
  }
}

export function AccountPage({
  mode,
  redirect = "/dashboard",
  verified = false,
}: {
  mode: "login" | "signup" | "forgot";
  redirect?: string;
  verified?: boolean;
}) {
  const account = useAccount();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const signup = mode === "signup";
  const forgot = mode === "forgot";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = {};
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (!z.string().email().max(254).safeParse(email).success)
      next["email"] = "Enter a valid email address.";
    if (!forgot && (password.length < (signup ? 8 : 1) || password.length > 128))
      next["password"] = signup ? "Use at least 8 characters." : "Enter your password.";
    if (signup) {
      if (!String(data.get("name") || "").trim()) next["name"] = "Enter your name.";
      if (password !== data.get("confirm")) next["confirm"] = "The passwords do not match.";
      if (!data.get("terms")) next["terms"] = "Please agree to the terms to continue.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (forgot) {
        await account.resetPassword(email);
        setSentTo(email);
        setDone(true);
      } else if (signup) {
        await account.signup(String(data.get("name") || ""), email, password);
        setSentTo(email);
        setDone(true);
        toast.success("Verification email sent", {
          description: `Check ${email} to verify your account.`,
        });
      } else {
        await account.login(email, password, Boolean(data.get("remember")));
        toast.success("Welcome back");
        await navigate({ to: safeReturn(redirect) });
      }
    } catch (error) {
      setErrors({ form: friendlyAuthError(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    setErrors({});
    const remember = signup
      ? true
      : Boolean(formRef.current?.querySelector<HTMLInputElement>('[name="remember"]')?.checked);
    try {
      await account.loginWithGoogle(remember);
      await navigate({ to: "/complete-profile", search: { redirect: safeReturn(redirect) } });
    } catch (error) {
      setErrors({ form: friendlyAuthError(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("google-link-password") ?? "");
    if (!password) {
      setErrors({ link: "Enter your existing account password to link Google." });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await account.linkGoogleWithPassword(password, true);
      toast.success("Google linked to your account");
      await navigate({ to: safeReturn(redirect) });
    } catch (error) {
      setErrors({
        link:
          (error as { code?: string } | null)?.code === "auth/invalid-credential" ||
          (error as { code?: string } | null)?.code === "auth/wrong-password"
            ? "That password is incorrect. Try again."
            : friendlyAuthError(error),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container account-page">
      <div className="account-heading">
        <span className="eyebrow">HASA GOLD STORE · ACCOUNT</span>
        <h1>{signup ? "Make it yours." : forgot ? "Forgot your password?" : "Welcome back."}</h1>
        <p>
          {signup
            ? "Your games. Your favorites. Your own little corner."
            : forgot
              ? "We will email you a secure link to reset it."
              : verified
                ? "Your email is verified. Log in to access your account."
                : "Pick up where you left off."}
        </p>
      </div>
      <div className="account-panel">
        <div className="account-disclosure">
          <ShieldCheck size={20} />
          <p>
            Real account secured by Firebase. Your password is never stored on this device. Use an
            email you can access.
          </p>
        </div>
        {done ? (
          <div className="empty-state">
            <h2>Check your email</h2>
            <p>
              {signup ? (
                <>
                  We sent a verification link to <strong>{sentTo}</strong>. Verify your email before
                  logging in. Check your inbox and spam folder.
                </>
              ) : (
                <>
                  If an account exists for <strong>{sentTo}</strong>, a password-reset link is on
                  its way. Check your inbox and spam folder.
                </>
              )}
            </p>
            <Button asChild>
              <Link to="/login" search={{ redirect, verified: false }}>
                Back to Login <ArrowRight />
              </Link>
            </Button>
          </div>
        ) : (
          <form ref={formRef} onSubmit={submit} noValidate className="account-form">
            {signup && (
              <FormField label="Name" name="name" error={errors["name"]} autoComplete="name" />
            )}
            <FormField
              label="Email"
              name="email"
              type="email"
              error={errors["email"]}
              autoComplete="email"
            />
            {!forgot && <PasswordField hint={signup} error={errors["password"]} />}
            {signup && (
              <PasswordField label="Confirm password" name="confirm" error={errors["confirm"]} />
            )}
            {signup ? (
              <div>
                <label className="check-label">
                  <input type="checkbox" name="terms" />I agree to the terms below.
                </label>
                <p className="form-hint">
                  A real account is created with Firebase Authentication. Keep your password safe.
                </p>
                {errors["terms"] && <p className="field-error">{errors["terms"]}</p>}
              </div>
            ) : (
              !forgot && (
                <div className="form-between">
                  <label className="check-label">
                    <input name="remember" type="checkbox" />
                    Remember me
                  </label>
                  <Link to="/forgot-password" search={{ redirect }}>
                    Forgot password?
                  </Link>
                </div>
              )
            )}
            {errors["form"] && (
              <p role="alert" className="field-error">
                {errors["form"]}
              </p>
            )}
            <Button type="submit" disabled={busy || !account.ready} aria-busy={busy}>
              {busy && <Loader2 className="loading-spin" />}
              {busy
                ? "Please wait…"
                : signup
                  ? "Create account"
                  : forgot
                    ? "Send reset link"
                    : "Log in"}
              {!busy && <ArrowRight />}
            </Button>
          </form>
        )}
        {!done && !forgot && (
          <>
            {account.googleLinkEmail && (
              <form className="account-form google-link-form" onSubmit={handleGoogleLink}>
                <p className="form-hint" role="status">
                  Sign in as <strong>{account.googleLinkEmail}</strong> with your existing password
                  to securely link this Google account.
                </p>
                <div className="form-field">
                  <label htmlFor="google-link-password">Existing account password</label>
                  <input
                    id="google-link-password"
                    name="google-link-password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                {errors["link"] && (
                  <p role="alert" className="field-error">
                    {errors["link"]}
                  </p>
                )}
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="loading-spin" />}
                  Link Google account
                </Button>
              </form>
            )}
            <div className="account-provider">
              <span>or continue with</span>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !account.ready}
                onClick={() => void handleGoogleSignIn()}
              >
                {busy ? (
                  <Loader2 className="loading-spin" />
                ) : (
                  <span className="google-g-mark">G</span>
                )}
                Continue with Google
              </Button>
            </div>
          </>
        )}
        <div className="account-bottom">
          {signup ? (
            <>
              Already have an account?{" "}
              <Link to="/login" search={{ redirect, verified: false }}>
                Log in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link to="/signup" search={{ redirect }}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
