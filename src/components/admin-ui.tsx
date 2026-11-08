import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signInWithCustomToken, type User as FirebaseUser } from "firebase/auth";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  CreditCard,
  Database,
  Gamepad2,
  LayoutDashboard,
  Mail,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAccount } from "@/components/account-context";
import { useGames } from "@/lib/firestore";
import {
  fetchAdminOverview,
  fetchAdminCollection,
  saveAdminCatalogRecord,
  archiveAdminCatalogRecord,
  saveAdminSettings,
  saveAdminPaymentMethods as saveAdminPaymentMethodsApi,
  saveAdminFaqs,
  fetchAdminUsers,
  searchAdminUserApi,
  setAdminUserDisabledApi,
  adjustAdminWalletApi,
  searchAdminOrderApi,
  updateAdminOrderStatusApi,
  fetchAdminOrderProofUrl,
  uploadAdminImageApi,
  adminDecidePayment,
  fetchAdminTopupFailures,
  fetchApiCatalog,
  fetchApiFaqs,
} from "@/lib/api-client";
import { signInWithAdminPassword } from "@/api/admin";
import type { AdminDocument } from "@/api/admin";
import { Button } from "@/components/ui/button";
import hasaLogo from "@/assets/newhasalogo.png";
import type { OrderStatus, PaymentStatus } from "@/lib/firestore-schema";
import type { PaymentMethodConfig } from "@/lib/firestore-schema";
import { PRODUCT_CATEGORIES, getCategoriesForGame } from "@/lib/firestore-schema";
import {
  DEFAULT_PAYMENT_METHODS,
  PAYMENT_METHOD_ID_PATTERN,
  parsePaymentMethods,
} from "@/lib/payment-methods";

type AdminRecord = Partial<AdminDocument>;
type AdminSection = "games" | "products" | "gameAccounts" | "orders" | "wallet_deposits";
type AdminFormState = Record<string, string | boolean>;

function requireAdminSessionUser(accountUid: string | null): FirebaseUser {
  if (!accountUid) {
    throw new Error("This tab has no signed-in Firebase account. Sign in here, then reload Admin.");
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error(
      "Firebase sign-in is missing in this tab. Sign out, sign back in at this address, then reload Admin.",
    );
  }
  if (user.uid !== accountUid) {
    throw new Error(
      "The signed-in Firebase account changed. Sign out, sign back in, then reload Admin.",
    );
  }
  return user;
}

function createFormState(record: AdminRecord): AdminFormState {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value
            .map((item) =>
              item && typeof item === "object" && "label" in item && "value" in item
                ? `${String(item["label"])}: ${String(item["value"])}`
                : String(item),
            )
            .join("\n")
        : typeof value === "boolean"
          ? value
          : value === null || value === undefined
            ? ""
            : String(value),
    ]),
  );
}

function formText(form: AdminFormState, key: string): string {
  const value = form[key];
  return typeof value === "string" ? value : "";
}

function formBoolean(form: AdminFormState, key: string): boolean {
  return form[key] === true;
}

function formNumber(form: AdminFormState, key: string): number {
  const value = formText(form, key).trim();
  return value === "" ? Number.NaN : Number(value);
}

function formatAmount(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  const hasValue = typeof value === "number" || (typeof value === "string" && value.trim() !== "");
  return hasValue && Number.isFinite(numeric) ? numeric.toLocaleString() : "—";
}

const NEXAURA_FAILURE_STATUSES = ["failed", "submission_failed", "submission_unknown"] as const;
type NexauraFailureKind = (typeof NEXAURA_FAILURE_STATUSES)[number];

function nexauraFailureKind(value: unknown): NexauraFailureKind | null {
  return typeof value === "string" &&
    (NEXAURA_FAILURE_STATUSES as readonly string[]).includes(value)
    ? (value as NexauraFailureKind)
    : null;
}

function nexauraFailureLabel(kind: NexauraFailureKind): string {
  switch (kind) {
    case "failed":
      return "Top-up failed";
    case "submission_failed":
      return "Submission failed";
    case "submission_unknown":
      return "Needs review";
  }
}

function nexauraFailureReason(order: AdminRecord): string {
  const lastError =
    typeof order["nexauraLastError"] === "string" ? order["nexauraLastError"].trim() : "";
  if (lastError) return lastError;
  const note = typeof order["nexauraNote"] === "string" ? order["nexauraNote"].trim() : "";
  if (note) return note;
  switch (nexauraFailureKind(order["nexauraStatus"])) {
    case "failed":
      return "Nexaura reported that this top-up could not be delivered, without a detailed reason.";
    case "submission_failed":
      return "Nexaura rejected the top-up request, without a detailed reason.";
    case "submission_unknown":
      return "Nexaura did not confirm the submission, so delivery needs a manual check.";
    default:
      return "No failure reason was recorded for this order.";
  }
}

function formatDateTime(value: unknown): string {
  const millis = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(millis) || millis <= 0) return "—";
  return new Date(millis).toLocaleString();
}

function productCategoryLabel(value: unknown): string {
  return PRODUCT_CATEGORIES.find((category) => category.id === value)?.label ?? "Diamonds";
}

function splitFormLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="admin-form-field">
      <span className="admin-field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

const navigation = [
  ["/admin", "Overview", LayoutDashboard],
  ["/admin/games", "Games", Gamepad2],
  ["/admin/packages", "Packages", Package],
  ["/admin/accounts", "Marketplace accounts", BadgeCheck],
  ["/admin/orders", "Orders", ReceiptText],
  ["/admin/topup-failures", "Top-up failures", AlertTriangle],
  ["/admin/deposits", "Wallet deposits", WalletCards],
  ["/admin/users", "Customers", Users],
  ["/admin/payment-methods", "Payment methods", CreditCard],
  ["/admin/settings", "Settings", Settings2],
  ["/admin/support", "FAQs", CircleHelp],
] as const;

function AdminShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const { ready, uid, user } = useAccount();
  const firebaseUser = getFirebaseAuth().currentUser;
  const sessionActive = Boolean(ready && uid && firebaseUser?.uid === uid);
  const adminEmail = sessionActive
    ? (firebaseUser?.email ?? user?.email ?? "Signed-in account")
    : "Not signed in";
  const sessionLabel = !ready
    ? "Checking sign-in"
    : sessionActive
      ? "Session active"
      : "Sign-in required";
  return (
    <div className="admin-app-shell">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand" aria-label="HASA GOLD STORE home">
          <span className="admin-brand-mark">
            <img src={hasaLogo} alt="" />
          </span>
          <span className="admin-brand-copy">
            <strong>
              HASA <em>GOLD</em>
            </strong>
            <small>STORE CONTROL</small>
          </span>
        </Link>
        <div className="admin-side-label">WORKSPACE</div>
        <nav className="admin-side-nav" aria-label="Admin navigation">
          {navigation.map(([to, label, Icon]) => {
            const active =
              to === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`admin-side-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
                {active && <ChevronRight className="admin-side-chevron" size={15} />}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-security-note">
            <span className="admin-security-icon">
              <ShieldCheck size={17} />
            </span>
            <span>
              <strong>Protected workspace</strong>
              <small>Server-authorized access</small>
            </span>
          </div>
          <Link className="admin-back-link" to="/">
            <ArrowLeft size={15} /> Back to storefront
          </Link>
        </div>
      </aside>
      <div className="admin-main-column">
        <header className="admin-topbar">
          <div className="admin-topbar-context">
            <span className="admin-topbar-kicker">HASA GOLD STORE</span>
            <span className="admin-topbar-divider">/</span>
            <span>Administration</span>
          </div>
          <div className="admin-topbar-user">
            <span className="admin-online-indicator" aria-label={sessionLabel} />
            <span className="admin-topbar-user-copy">
              <strong>{adminEmail}</strong>
              <small>{sessionLabel}</small>
            </span>
            <span className="admin-avatar">{adminEmail.charAt(0).toUpperCase()}</span>
            <Link className="admin-topbar-storefront" to="/">
              Storefront <ArrowUpRight size={14} />
            </Link>
          </div>
        </header>
        {!sessionActive && ready && (
          <div className="admin-session-notice" role="status">
            <span>Sign in to manage the store.</span>{" "}
            <a href={`/admin-login?redirect=${encodeURIComponent(pathname)}`}>Open admin sign-in</a>
          </div>
        )}
        <main id="main-content" className="admin-content">
          <header className="admin-page-heading">
            <div>
              <span className="admin-page-eyebrow">
                <Database size={13} /> STORE OPERATIONS
              </span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="admin-heading-badge">
              <ShieldCheck size={15} /> Secure admin
            </div>
          </header>
          {children}
          <footer className="admin-page-footer">
            <span>
              HASA GOLD STORE <b>·</b> CONTROL CENTER
            </span>
            <span>Store data is managed through trusted server operations.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function AdminProductGroups({
  groups,
  renderRecord,
  onAddPackage,
}: {
  groups: Array<[string, AdminRecord[]]>;
  renderRecord: (record: AdminRecord) => ReactNode;
  onAddPackage: (gameSlug: string, category: (typeof PRODUCT_CATEGORIES)[number]["id"]) => void;
}) {
  const { data: games = [], isLoading, error } = useGames();
  const gameName = (slug: string) =>
    games.find((game) => game.id === slug)?.name ||
    (slug
      ? slug
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "Other packages");

  return (
    <div className="admin-product-groups">
      {error && (
        <p className="admin-error-banner" role="alert">
          Game names could not be loaded. Existing package groups are still available.
        </p>
      )}
      {isLoading && <p className="admin-helper-copy">Loading game names…</p>}
      {groups.map(([slug, products]) => (
        <section className="admin-product-group" key={slug || "unassigned"}>
          <header className="admin-product-group-heading">
            <div>
              <h3>{gameName(slug)}</h3>
              <span>
                {products.length} {products.length === 1 ? "package" : "packages"}
              </span>
            </div>
            {slug && (
              <Button
                className="admin-quiet-button"
                variant="outline"
                size="sm"
                onClick={() => onAddPackage(slug, "diamonds")}
                aria-label={`Add a package for ${gameName(slug)}`}
              >
                <Plus size={14} /> Add package
              </Button>
            )}
          </header>
          {getCategoriesForGame(slug).map((category) => {
            const categoryProducts = products.filter(
              (product) =>
                (product["category"] === undefined
                  ? slug === "blood-strike"
                    ? "gold"
                    : slug === "pubg-mobile"
                      ? "uc"
                      : "diamonds"
                  : product["category"]) === category.id,
            );
            if (categoryProducts.length === 0) return null;
            return (
              <section className="admin-product-category" key={category.id}>
                <header className="admin-product-category-heading">
                  <h4>{category.label}</h4>
                  <span>{categoryProducts.length}</span>
                </header>
                <div className="admin-record-list">{categoryProducts.map(renderRecord)}</div>
              </section>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function AdminDataPage({
  title,
  description,
  collection,
  template,
  readOnly = false,
}: {
  title: string;
  description: string;
  collection: AdminSection;
  template?: AdminRecord;
  readOnly?: boolean;
}) {
  const { ready, uid } = useAccount();
  const queryClient = useQueryClient();
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [selected, setSelected] = useState<AdminRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<AdminFormState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [packageGameLocked, setPackageGameLocked] = useState(false);
  const [packageQuery, setPackageQuery] = useState("");
  const [packageStatus, setPackageStatus] = useState<"all" | "active" | "archived">("all");
  const [formError, setFormError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const { data: catalogGames = [] } = useGames();

  const load = useCallback(
    async (pageToken?: string, append = false) => {
      if (!ready) return;
      setLoading(true);
      if (!append) {
        setError(null);
        setNextPageToken(null);
      }
      try {
        const result = await fetchAdminCollection(collection, pageToken);
        setRecords(
          (current) =>
            (append ? [...current, ...result.items] : result.items) as unknown as AdminRecord[],
        );
        setNextPageToken(result.nextPageToken);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Admin data could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    [collection, ready, uid],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function edit(record: AdminRecord | null, defaults?: AdminRecord) {
    setSelected(record);
    setFormError(null);
    const nextForm = {
      ...createFormState(record ?? template ?? {}),
      ...createFormState(defaults ?? {}),
    };
    if (collection === "products") {
      if (!formText(nextForm, "category")) nextForm["category"] = "diamonds";
      if (!record) {
        if (!formText(nextForm, "gameSlug") && catalogGames[0]) {
          nextForm["gameSlug"] = catalogGames[0].id;
        }
        // Package IDs are internal link keys; generate one so admins never edit it by hand.
        nextForm["id"] =
          `${formText(nextForm, "gameSlug") || "package"}-${Date.now().toString(36)}`;
      }
    }
    setForm(nextForm);
    setPackageGameLocked(collection === "products" && !record && Boolean(defaults?.["gameSlug"]));
    setEditorOpen(true);
  }

  function updateField(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  async function handleImageFileSelected(file: File) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setFormError("Please select an image file (PNG, JPG, WEBP, or GIF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image file size must be less than 5MB.");
      return;
    }
    setImageUploading(true);
    setFormError(null);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const commaIdx = res.indexOf(",");
          resolve(commaIdx !== -1 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = () => reject(new Error("Could not read image file."));
      });
      reader.readAsDataURL(file);
      const dataBase64 = await base64Promise;

      const folder = collection === "games" ? "games" : "packages";
      const { url } = await uploadAdminImageApi({
        folder,
        fileName: file.name,
        contentType: file.type,
        dataBase64,
      });

      updateField("imageUrl", url);
      toast.success("Image uploaded successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload image.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setImageUploading(false);
    }
  }

  async function save() {
    if (collection === "orders" || collection === "wallet_deposits") {
      setError("Order and deposit records are read-only.");
      return;
    }
    if (collection === "products") {
      if (!formText(form, "name").trim()) {
        setFormError("Give this package a name customers will recognize, e.g. Weekly Membership.");
        return;
      }
      if (!formText(form, "gameSlug").trim()) {
        setFormError("Choose the game this package belongs to.");
        return;
      }
      if (!formText(form, "unitLabel").trim()) {
        setFormError('Add a unit label, e.g. "Diamonds" or "Membership".');
        return;
      }
      const pricePkr = formNumber(form, "pricePkr");
      if (!Number.isFinite(pricePkr) || pricePkr <= 0) {
        setFormError("Enter the LKR price customers should pay. It must be greater than 0.");
        return;
      }
    }
    const displayOrder = formNumber(form, "displayOrder");
    const common = {
      active: formBoolean(form, "active"),
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
    };
    const record =
      collection === "games"
        ? {
            slug: formText(form, "slug"),
            name: formText(form, "name"),
            currency: formText(form, "currency"),
            tone: formText(form, "tone"),
            icon: formText(form, "icon"),
            artworkKey: formText(form, "artworkKey"),
            imageUrl: formText(form, "imageUrl") || null,
            description: formText(form, "description"),
            serverOptions: splitFormLines(formText(form, "serverOptions")),
            ...common,
          }
        : collection === "products"
          ? {
              id: formText(form, "id"),
              gameSlug: formText(form, "gameSlug"),
              nexauraProductId: formText(form, "nexauraProductId").trim(),
              category: formText(form, "category"),
              // Hidden catalog fields keep their stored values so order creation and
              // provider submissions stay valid. They are no longer edited in the UI.
              amount: formNumber(form, "amount") > 0 ? formNumber(form, "amount") : 1,
              unitLabel: formText(form, "unitLabel"),
              name: formText(form, "name"),
              imageUrl: formText(form, "imageUrl") || null,
              priceUsd: Number.isFinite(formNumber(form, "priceUsd"))
                ? formNumber(form, "priceUsd")
                : 0,
              pricePkr: formNumber(form, "pricePkr"),
              bonus: Number.isFinite(formNumber(form, "bonus")) ? formNumber(form, "bonus") : 0,
              isPopular: formBoolean(form, "isPopular"),
              isBestValue: formBoolean(form, "isBestValue"),
              isVip: formBoolean(form, "isVip"),
              ...common,
            }
          : {
              id: formText(form, "id"),
              gameId: formText(form, "gameId"),
              gameName: formText(form, "gameName"),
              title: formText(form, "title"),
              tagline: formText(form, "tagline"),
              priceUsd: formNumber(form, "priceUsd"),
              pricePkr: formNumber(form, "pricePkr"),
              priceSample: formText(form, "priceSample"),
              level: formNumber(form, "level"),
              rank: formText(form, "rank"),
              server: formText(form, "server"),
              loginType: formText(form, "loginType"),
              artworkKey: formText(form, "artworkKey"),
              tone: formText(form, "tone"),
              verified: false,
              status: formText(form, "status"),
              badges: splitFormLines(formText(form, "badges")),
              inventoryHighlights: splitFormLines(formText(form, "inventoryHighlights")),
              description: formText(form, "description"),
              features: splitFormLines(formText(form, "features")).map((line) => {
                const separator = line.indexOf(":");
                return {
                  label: separator < 0 ? line : line.slice(0, separator).trim(),
                  value: separator < 0 ? "" : line.slice(separator + 1).trim(),
                };
              }),
              ...common,
            };
    setSaving(true);
    setError(null);
    try {
      await saveAdminCatalogRecord(
        collection as "games" | "products" | "gameAccounts",
        record as Record<string, unknown>,
      );
      if (collection === "products") {
        await queryClient.invalidateQueries({ queryKey: ["products"] });
      }
      toast.success("Store record saved.");
      setSelected(null);
      setEditorOpen(false);
      await load();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "The record could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function archive(record: AdminRecord) {
    if (collection === "orders" || collection === "wallet_deposits") return;
    if (
      typeof record.id !== "string" ||
      !window.confirm(`Archive "${record["name"] ?? record["title"] ?? record.id}"?`)
    ) {
      return;
    }
    try {
      await archiveAdminCatalogRecord(
        collection as "games" | "products" | "gameAccounts",
        record.id,
      );
      if (collection === "products") {
        await queryClient.invalidateQueries({ queryKey: ["products"] });
      }
      toast.success("Record archived; it is no longer active in the storefront.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The record could not be archived.");
    }
  }

  const textField = (key: string, label: string, placeholder: string, hint?: string) => (
    <FormField label={label} hint={hint}>
      <input
        className="admin-form-input"
        value={formText(form, key)}
        onChange={(event) => updateField(key, event.target.value)}
        placeholder={placeholder}
      />
    </FormField>
  );
  const numberField = (
    key: string,
    label: string,
    placeholder: string,
    hint?: string,
    step = "1",
  ) => (
    <FormField label={label} hint={hint}>
      <input
        className="admin-form-input"
        type="number"
        min="0"
        step={step}
        value={formText(form, key)}
        onChange={(event) => updateField(key, event.target.value)}
        placeholder={placeholder}
      />
    </FormField>
  );
  const selectField = (
    key: string,
    label: string,
    options: Array<[string, string]>,
    hint?: string,
  ) => (
    <FormField label={label} hint={hint}>
      <select
        className="admin-form-input admin-form-select"
        value={formText(form, key)}
        onChange={(event) => updateField(key, event.target.value)}
      >
        {options.map(([value, optionLabel]) => (
          <option value={value} key={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </FormField>
  );
  const textareaField = (
    key: string,
    label: string,
    placeholder: string,
    hint?: string,
    rows = 3,
  ) => (
    <FormField label={label} hint={hint}>
      <textarea
        className="admin-form-input admin-form-textarea"
        rows={rows}
        value={formText(form, key)}
        onChange={(event) => updateField(key, event.target.value)}
        placeholder={placeholder}
      />
    </FormField>
  );
  const toggleField = (key: string, label: string, hint: string) => (
    <label className="admin-toggle-row">
      <input
        type="checkbox"
        checked={formBoolean(form, key)}
        onChange={(event) => updateField(key, event.target.checked)}
      />
      <span className="admin-toggle-copy">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </label>
  );
  const packageQueryValue = packageQuery.trim().toLowerCase();
  const visibleRecords =
    collection === "products"
      ? records.filter((record) => {
          const archived = record["active"] === false;
          if (packageStatus === "active" && archived) return false;
          if (packageStatus === "archived" && !archived) return false;
          if (!packageQueryValue) return true;
          return [
            record["name"],
            record["unitLabel"],
            record["category"],
            record["gameSlug"],
            record.id,
          ]
            .map((value) => String(value ?? "").toLowerCase())
            .join(" ")
            .includes(packageQueryValue);
        })
      : records;
  const gameOptions: Array<[string, string]> = [
    ["", "Choose a game"],
    ...catalogGames.map((game): [string, string] => [game.id, game.name]),
  ];
  const currentGameSlug = formText(form, "gameSlug");
  if (currentGameSlug && !gameOptions.some(([value]) => value === currentGameSlug)) {
    gameOptions.push([currentGameSlug, `${currentGameSlug} (inactive)`]);
  }
  const productGroups =
    collection === "products"
      ? Array.from(
          visibleRecords.reduce<Map<string, AdminRecord[]>>((groups, record) => {
            const gameSlug =
              typeof record["gameSlug"] === "string" && record["gameSlug"].trim()
                ? record["gameSlug"].trim()
                : "";
            const group = groups.get(gameSlug) ?? [];
            group.push(record);
            groups.set(gameSlug, group);
            return groups;
          }, new Map()),
        ).sort(([slugA], [slugB]) => slugA.localeCompare(slugB))
      : null;
  const renderRowActions = (record: AdminRecord) =>
    readOnly ? null : (
      <div className="admin-row-actions">
        <Button
          className="admin-icon-button"
          variant="outline"
          size="icon"
          aria-label={`Edit ${String(record["name"] ?? record["title"] ?? record.id)}`}
          title="Edit"
          onClick={() => edit(record)}
        >
          <Pencil size={14} />
        </Button>
        {record["active"] !== false && (
          <Button
            className="admin-icon-button admin-archive-button"
            variant="outline"
            size="icon"
            aria-label={`Archive ${String(record["name"] ?? record["title"] ?? record.id)}`}
            title="Archive"
            onClick={() => void archive(record)}
          >
            <Archive size={14} />
          </Button>
        )}
      </div>
    );

  const renderProductRow = (record: AdminRecord) => {
    const badges: Array<{ label: string; className: string }> = [];
    if (!String(record["name"] ?? "").trim()) {
      badges.push({ label: "Missing name", className: "is-warning" });
    }
    if (record["isPopular"] === true) badges.push({ label: "Popular", className: "is-popular" });
    if (record["isBestValue"] === true) badges.push({ label: "Best value", className: "is-value" });
    if (record["isVip"] === true) badges.push({ label: "VIP", className: "is-vip" });
    const archived = record["active"] === false;
    const title =
      String(record["name"] ?? "").trim() || String(record["unitLabel"] ?? "").trim() || record.id;
    return (
      <article
        key={record.id}
        className={`admin-record-row admin-package-row${archived ? " is-archived" : ""}`}
      >
        <span className="admin-package-price-tile">
          <small>LKR</small>
          <strong>{formatAmount(record["pricePkr"])}</strong>
        </span>
        <div className="admin-record-main">
          <p className="admin-record-title" title={title}>
            {title}
          </p>
          <p className="admin-record-meta">
            <span>{productCategoryLabel(record["category"])}</span>
            <span>·</span>
            <span>{String(record["unitLabel"] ?? "Unit")}</span>
            <span>·</span>
            <code>{record.id}</code>
          </p>
          {badges.length > 0 && (
            <div className="admin-package-badges">
              {badges.map((badge) => (
                <span className={`admin-package-badge ${badge.className}`} key={badge.label}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className={`admin-status-pill ${archived ? "is-muted" : "is-success"}`}>
          <i />
          {archived ? "Archived" : "Live"}
        </span>
        {renderRowActions(record)}
      </article>
    );
  };

  const renderRecord = (record: AdminRecord) => {
    if (collection === "products") return renderProductRow(record);
    return (
      <article key={record.id} className="admin-record-row">
        <span className={`admin-record-symbol ${record["active"] === false ? "is-muted" : ""}`}>
          {collection === "games" ? (
            <Gamepad2 size={17} />
          ) : collection === "orders" ? (
            <ReceiptText size={17} />
          ) : collection === "wallet_deposits" ? (
            <WalletCards size={17} />
          ) : (
            <BadgeCheck size={17} />
          )}
        </span>
        <div className="admin-record-main">
          <p className="admin-record-title">
            {String(
              record["name"] ??
                record["title"] ??
                record["packageName"] ??
                (collection === "wallet_deposits" ? "eZ Cash deposit" : record.id),
            )}
          </p>
          <p className="admin-record-meta">
            {collection === "wallet_deposits" ? (
              <>
                <span>Reference number</span>
                <code>{String(record["referenceNumber"] ?? "Not available")}</code>
                <span>·</span>
                <span>Member ID: {String(record["customerMemberId"] ?? "Not assigned")}</span>
              </>
            ) : (
              <>
                <code>{record.id}</code>
                <span>·</span>
                {String(
                  record["gameName"] ??
                    record["gameSlug"] ??
                    record["customerEmail"] ??
                    record["method"] ??
                    "",
                )}
              </>
            )}
          </p>
        </div>
        <span
          className={`admin-status-pill ${
            record["active"] === false || record["status"] === "failed"
              ? "is-muted"
              : record["status"] === "credited" || record["status"] === "delivered"
                ? "is-success"
                : "is-pending"
          }`}
        >
          <i />
          {record["active"] === false ? "Archived" : String(record["status"] ?? "Active")}
        </span>
        {renderRowActions(record)}
      </article>
    );
  };

  return (
    <AdminShell title={title} description={description}>
      <div className={`admin-content-grid${editorOpen ? " has-editor" : ""}`}>
        <section className="admin-panel admin-records-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-panel-eyebrow">
                {collection === "products" ? "PACKAGE CATALOG" : "LIVE COLLECTION"}
              </span>
              <h2>
                {collection === "products" ? "Packages" : "Firestore records"}{" "}
                <span className="admin-count-pill">
                  {collection === "products" && visibleRecords.length !== records.length
                    ? `${visibleRecords.length}/${records.length}`
                    : records.length}
                </span>
              </h2>
            </div>
            <div className="admin-panel-actions">
              <Button
                className="admin-quiet-button"
                variant="outline"
                size="sm"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw size={14} /> Refresh
              </Button>
              {!readOnly && (
                <Button className="admin-primary-button" size="sm" onClick={() => edit(null)}>
                  <Plus size={15} /> {collection === "products" ? "New package" : "New record"}
                </Button>
              )}
            </div>
          </div>
          {collection === "products" && (
            <div className="admin-package-toolbar">
              <label className="admin-package-search">
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  value={packageQuery}
                  onChange={(event) => setPackageQuery(event.target.value)}
                  placeholder="Search packages by name, ID, or game"
                  aria-label="Search packages"
                />
              </label>
              <div className="admin-package-filter" role="group" aria-label="Filter packages">
                {(
                  [
                    ["all", "All"],
                    ["active", "Live"],
                    ["archived", "Archived"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={packageStatus === value ? "is-active" : undefined}
                    aria-pressed={packageStatus === value}
                    onClick={() => setPackageStatus(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {loading ? (
            <div className="admin-loading-state" role="status">
              <span className="admin-loading-orb" /> Loading live records…
            </div>
          ) : collection === "products" && records.length === 0 ? (
            <div className="admin-empty-state">
              <Package size={24} />
              <strong>No packages yet</strong>
              <span>
                Create your first package and it will appear on the storefront as soon as it is
                active.
              </span>
              {!readOnly && (
                <Button className="admin-primary-button" size="sm" onClick={() => edit(null)}>
                  <Plus size={15} /> New package
                </Button>
              )}
            </div>
          ) : collection === "products" && productGroups ? (
            visibleRecords.length === 0 ? (
              <div className="admin-empty-state">
                <Search size={24} />
                <strong>No packages match</strong>
                <span>Try another search term, or reset the status filter.</span>
                <Button
                  className="admin-quiet-button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPackageQuery("");
                    setPackageStatus("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <AdminProductGroups
                groups={productGroups}
                renderRecord={renderRecord}
                onAddPackage={(gameSlug, category) => edit(null, { gameSlug, category })}
              />
            )
          ) : records.length === 0 ? (
            <div className="admin-empty-state">
              <Database size={24} />
              <strong>No records yet</strong>
              <span>Create your first Firestore record to populate this collection.</span>
            </div>
          ) : (
            <div className="admin-record-list">{records.map(renderRecord)}</div>
          )}
          {nextPageToken && (
            <Button
              className="admin-load-more"
              variant="outline"
              onClick={() => void load(nextPageToken, true)}
              disabled={loading}
            >
              {loading ? "Loading…" : "Load more records"}
            </Button>
          )}
        </section>

        {error && (
          <p className="admin-error-banner" role="alert">
            {error}
          </p>
        )}

        {editorOpen && (
          <section className="admin-panel admin-editor-panel">
            <div className="admin-panel-header">
              <div>
                <span className="admin-panel-eyebrow">
                  {collection === "products" ? "PACKAGE DETAILS" : "CATALOG DETAILS"}
                </span>
                <h2>
                  {collection === "products"
                    ? selected
                      ? "Edit package"
                      : "New package"
                    : selected
                      ? "Edit listing"
                      : "Add a new listing"}
                </h2>
              </div>
            </div>
            <p className="admin-helper-copy">
              {collection === "products"
                ? "Customers see the package name and LKR price. The other fields control delivery and where the package appears."
                : "Enter the details below. Required fields are checked securely before the changes are saved."}
            </p>
            {collection === "products" && (
              <div className="admin-package-preview">
                <div className="admin-package-preview-head">
                  <span className="admin-package-preview-game">
                    {catalogGames.find((game) => game.id === currentGameSlug)?.name ||
                      currentGameSlug ||
                      "No game selected"}
                  </span>
                  <span className="admin-package-preview-id">
                    {selected ? `ID · ${formText(form, "id")}` : "Not saved yet"}
                  </span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px", margin: "8px 0" }}
                >
                  {formText(form, "imageUrl") && (
                    <img
                      src={formText(form, "imageUrl")}
                      alt=""
                      style={{
                        width: "36px",
                        height: "36px",
                        objectFit: "contain",
                        borderRadius: "6px",
                      }}
                    />
                  )}
                  <strong className={formText(form, "name").trim() ? undefined : "is-placeholder"}>
                    {formText(form, "name").trim() || "Package name"}
                  </strong>
                </div>
                <div className="admin-package-preview-foot">
                  <span className="admin-package-preview-price">
                    <small>LKR</small> {formatAmount(formText(form, "pricePkr"))}
                  </span>
                  <div className="admin-package-badges">
                    <span className="admin-package-preview-unit">
                      {formText(form, "unitLabel").trim() || "Unit label"}
                    </span>
                    {formBoolean(form, "isPopular") && (
                      <span className="admin-package-badge is-popular">Popular</span>
                    )}
                    {formBoolean(form, "isBestValue") && (
                      <span className="admin-package-badge is-value">Best value</span>
                    )}
                    {formBoolean(form, "isVip") && (
                      <span className="admin-package-badge is-vip">VIP</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="admin-form-section">
              <h3>{collection === "products" ? "Package details" : "Basic information"}</h3>
              <div className="admin-form-grid">
                {collection === "games" ? (
                  <>
                    {textField("name", "Game name", "e.g. Free Fire")}
                    {textField(
                      "slug",
                      "Game ID / URL key",
                      "e.g. free-fire",
                      "Use lowercase letters, numbers, and hyphens.",
                    )}
                    {textField("currency", "Top-up currency", "e.g. Diamonds")}
                    <FormField
                      label="Game Icon / Logo Image"
                      hint="Upload a custom game icon or artwork. Automatically hosted on CDN."
                    >
                      <div className="admin-image-upload-box">
                        {formText(form, "imageUrl") && (
                          <div className="admin-image-preview">
                            <img
                              src={formText(form, "imageUrl")}
                              alt="Game Icon Preview"
                              className="admin-preview-thumb"
                            />
                            <button
                              type="button"
                              className="admin-remove-image-btn"
                              onClick={() => updateField("imageUrl", "")}
                              title="Remove custom image"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={imageUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleImageFileSelected(f);
                          }}
                          className="admin-file-input"
                        />
                        {imageUploading && (
                          <span className="admin-uploading-indicator">
                            <RefreshCw size={14} className="animate-spin" /> Uploading image…
                          </span>
                        )}
                      </div>
                    </FormField>
                    {textField(
                      "artworkKey",
                      "Artwork key (Fallback)",
                      "e.g. free-fire",
                      "Fallback key matches a built-in artwork asset if no custom upload is provided.",
                    )}
                  </>
                ) : collection === "products" ? (
                  <>
                    {textField(
                      "name",
                      "Package name",
                      "e.g. Weekly Membership",
                      "Shown to customers on the game page and at checkout.",
                    )}
                    <FormField
                      label="Package Custom Icon / Artwork"
                      hint="Upload a custom package icon. Shown directly on the game top-up card."
                    >
                      <div className="admin-image-upload-box">
                        {formText(form, "imageUrl") && (
                          <div className="admin-image-preview">
                            <img
                              src={formText(form, "imageUrl")}
                              alt="Package Icon Preview"
                              className="admin-preview-thumb"
                            />
                            <button
                              type="button"
                              className="admin-remove-image-btn"
                              onClick={() => updateField("imageUrl", "")}
                              title="Remove custom image"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={imageUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleImageFileSelected(f);
                          }}
                          className="admin-file-input"
                        />
                        {imageUploading && (
                          <span className="admin-uploading-indicator">
                            <RefreshCw size={14} className="animate-spin" /> Uploading image…
                          </span>
                        )}
                      </div>
                    </FormField>
                    {packageGameLocked ? (
                      <FormField label="Game" hint="This package belongs to the selected game.">
                        <input
                          className="admin-form-input"
                          value={
                            catalogGames.find((game) => game.id === formText(form, "gameSlug"))
                              ?.name ?? formText(form, "gameSlug")
                          }
                          readOnly
                        />
                      </FormField>
                    ) : (
                      selectField(
                        "gameSlug",
                        "Game",
                        gameOptions,
                        "Packages only appear under their game.",
                      )
                    )}
                    {selectField(
                      "category",
                      "Package category",
                      getCategoriesForGame(formText(form, "gameSlug")).map(({ id, label }) => [
                        id,
                        label,
                      ]),
                    )}
                    {textField(
                      "unitLabel",
                      "Unit label",
                      "e.g. Diamonds",
                      "Short unit customers understand, e.g. Diamonds or Membership.",
                    )}
                    {formText(form, "gameSlug") === "free-fire" &&
                      textField(
                        "nexauraProductId",
                        "Nexaura product ID",
                        "e.g. weekly",
                        "Exact product_id from Nexaura. Each store package submits quantity 1.",
                      )}
                  </>
                ) : (
                  <>
                    {textField("title", "Listing title", "e.g. Free Fire account - level 65")}
                    {textField("id", "Listing ID", "e.g. ff-account-001")}
                    {textField("gameId", "Game ID", "e.g. free-fire")}
                    {textField("gameName", "Game name", "e.g. Free Fire")}
                    {textField("tagline", "Short summary", "A short description of the account")}
                  </>
                )}
              </div>
            </div>
            {collection === "games" && (
              <div className="admin-form-section">
                <h3>Game details</h3>
                <div className="admin-form-grid">
                  {selectField("tone", "Card theme", [
                    ["ice", "Ice blue"],
                    ["ember", "Ember"],
                    ["olive", "Olive"],
                    ["violet", "Violet"],
                  ])}
                  {selectField("icon", "Currency icon", [
                    ["diamond", "Diamond"],
                    ["coins", "Coins"],
                  ])}
                  {numberField(
                    "displayOrder",
                    "Display position",
                    "0",
                    "Lower numbers appear first.",
                  )}
                  {textareaField(
                    "serverOptions",
                    "Server options",
                    "Asia\nSingapore",
                    "Enter one server option per line.",
                  )}
                  <div className="admin-form-span">
                    {textareaField(
                      "description",
                      "Description",
                      "Describe the available top-up service.",
                      undefined,
                      3,
                    )}
                  </div>
                </div>
              </div>
            )}
            {collection === "products" && (
              <div className="admin-form-section">
                <h3>Price and display</h3>
                <div className="admin-form-grid">
                  {numberField(
                    "pricePkr",
                    "Price (LKR)",
                    "e.g. 1900",
                    "The only price customers see. It is charged from the wallet or by eZ Cash.",
                    "0.01",
                  )}
                  {numberField(
                    "displayOrder",
                    "Display position",
                    "0",
                    "Lower numbers appear first on the game page.",
                  )}
                </div>
                <div className="admin-toggle-grid">
                  {toggleField(
                    "isPopular",
                    "Popular package",
                    "Highlight this package as popular.",
                  )}
                  {toggleField("isBestValue", "Best value", "Mark this package as best value.")}
                  {toggleField("isVip", "VIP package", "Show the VIP package treatment.")}
                  {toggleField(
                    "active",
                    "Active in storefront",
                    "Archived packages stay hidden from customers.",
                  )}
                </div>
              </div>
            )}
            {collection === "gameAccounts" && (
              <>
                <div className="admin-form-section">
                  <h3>Account details</h3>
                  <div className="admin-form-grid">
                    {numberField(
                      "pricePkr",
                      "Price (LKR)",
                      "e.g. 12500",
                      "Listing price in Sri Lankan rupees.",
                      "0.01",
                    )}
                    {numberField(
                      "priceUsd",
                      "Price (USD)",
                      "e.g. 40",
                      "Display/reference price in US dollars.",
                      "0.01",
                    )}
                    {numberField("level", "Account level", "e.g. 65")}
                    {textField("priceSample", "Price label", "e.g. LKR 12,500")}
                    {textField("rank", "Rank", "e.g. Heroic")}
                    {textField("server", "Server / region", "e.g. Asia")}
                    {textField("loginType", "Login method", "e.g. Facebook")}
                    {textField("artworkKey", "Artwork key", "e.g. free-fire")}
                    {selectField("tone", "Card theme", [
                      ["ice", "Ice blue"],
                      ["ember", "Ember"],
                      ["olive", "Olive"],
                      ["violet", "Violet"],
                    ])}
                    {selectField("status", "Availability", [
                      ["Available", "Available"],
                      ["Reserved", "Reserved"],
                      ["Sold", "Sold"],
                    ])}
                    {numberField(
                      "displayOrder",
                      "Display position",
                      "0",
                      "Lower numbers appear first.",
                    )}
                    {textareaField(
                      "badges",
                      "Badges",
                      "Rare skins\nHigh rank",
                      "Enter one badge per line.",
                    )}
                    {textareaField(
                      "inventoryHighlights",
                      "Inventory highlights",
                      "Legendary outfit\nRare weapon skin",
                      "Enter one highlight per line.",
                    )}
                    <div className="admin-form-span">
                      {textareaField(
                        "description",
                        "Description",
                        "Describe the account and included items.",
                        undefined,
                        4,
                      )}
                    </div>
                    <div className="admin-form-span">
                      {textareaField(
                        "features",
                        "Features",
                        "Level: 65\nRank: Heroic",
                        "Enter one feature per line as Label: Value.",
                      )}
                    </div>
                  </div>
                </div>
                <div className="admin-toggle-grid">
                  {toggleField(
                    "active",
                    "Show listing",
                    "Only active listings are visible in the storefront.",
                  )}
                </div>
                <p className="admin-inline-note">
                  <ShieldCheck size={15} /> Listings are informational only. Verification is
                  controlled by the trusted service.
                </p>
              </>
            )}
            {collection !== "gameAccounts" && collection !== "products" && (
              <div className="admin-toggle-grid">
                {toggleField(
                  "active",
                  "Active in storefront",
                  "Inactive records are hidden from customers.",
                )}
              </div>
            )}
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-editor-actions">
              <Button
                className="admin-primary-button"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save to Firestore"}
              </Button>
              <Button
                className="admin-quiet-button"
                variant="outline"
                onClick={() => {
                  setSelected(null);
                  setEditorOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </section>
        )}
      </div>
      {readOnly && (
        <p className="mt-4 text-sm text-muted-foreground">
          Order and deposit payment/fulfillment states are read-only here. Only provider-verified
          operations may change financial or delivery state.
        </p>
      )}
    </AdminShell>
  );
}

function OverviewContent() {
  const { ready, uid } = useAccount();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      setStats((await fetchAdminOverview()) as unknown as Record<string, number>);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Overview could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [ready]);
  useEffect(() => {
    void load();
  }, [load]);

  const statMeta: Record<string, { label: string; icon: typeof Database; tone: string }> = {
    games: { label: "Live games", icon: Gamepad2, tone: "blue" },
    products: { label: "Top-up packages", icon: Package, tone: "gold" },
    accounts: { label: "Account listings", icon: BadgeCheck, tone: "violet" },
    orders: { label: "Total orders", icon: ReceiptText, tone: "blue" },
    awaitingPaymentOrReview: {
      label: "Awaiting payment / review",
      icon: ReceiptText,
      tone: "amber",
    },
    deposits: { label: "Wallet deposits", icon: WalletCards, tone: "green" },
    pendingDeposits: { label: "Pending deposits", icon: WalletCards, tone: "amber" },
    users: { label: "Customer accounts", icon: Users, tone: "violet" },
  };

  return (
    <AdminShell
      title="Store overview"
      description="Live counts read from Firestore and Firebase Authentication."
    >
      <section className="admin-welcome-banner">
        <div className="admin-welcome-glow" />
        <div className="admin-welcome-content">
          <span className="admin-welcome-kicker">
            <span /> LIVE STORE DATA
          </span>
          <h2>Your store, at a glance.</h2>
          <p>Manage your catalog and keep an eye on customer activity from one secure workspace.</p>
        </div>
        <div className="admin-welcome-emblem">
          <Database size={30} strokeWidth={1.4} />
          <span>H</span>
        </div>
      </section>
      {loading ? (
        <div className="admin-stat-grid" role="status" aria-label="Loading store statistics">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="admin-stat-skeleton" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="admin-error-banner">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      ) : (
        <div className="admin-stat-grid">
          {Object.entries(stats ?? {}).map(([key, value]) => (
            <div className={`admin-stat-card tone-${statMeta[key]?.tone ?? "blue"}`} key={key}>
              <div className="admin-stat-card-top">
                <span>{statMeta[key]?.label ?? key}</span>
                {(() => {
                  const Icon = statMeta[key]?.icon ?? Database;
                  return <Icon size={18} />;
                })()}
              </div>
              <p className="admin-stat-value">{value.toLocaleString()}</p>
              <span className="admin-stat-foot">
                <span className="admin-stat-live-dot" /> Live from connected services
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="admin-overview-bottom">
        <section className="admin-panel admin-quick-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-panel-eyebrow">SHORTCUTS</span>
              <h2>Manage your store</h2>
            </div>
          </div>
          <div className="admin-quick-links">
            {navigation.slice(1, 5).map(([to, label, Icon]) => (
              <Link to={to} className="admin-quick-link" key={to}>
                <span>
                  <Icon size={17} />
                </span>
                <strong>{label}</strong>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        </section>
        <section className="admin-trust-panel">
          <span className="admin-trust-icon">
            <ShieldCheck size={19} />
          </span>
          <div>
            <strong>Financial controls are protected</strong>
            <p>
              Payment confirmation, wallet adjustments, refunds, and fulfillment can only be changed
              by verified trusted operations.
            </p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function AdminUsersPage() {
  const { ready, uid } = useAccount();
  const [users, setUsers] = useState<
    Array<{
      uid: string;
      memberId: string | null;
      email: string;
      displayName: string;
      walletBalanceLkr: number;
      disabled: boolean;
      isAdmin: boolean;
      providers: string[];
      photoUrl: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [adjustingUid, setAdjustingUid] = useState<string | null>(null);
  const [adjustmentDirection, setAdjustmentDirection] = useState<"credit" | "deduct">("credit");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userSearchActive, setUserSearchActive] = useState(false);
  const [providerFilter, setProviderFilter] = useState<"all" | "google" | "email">("all");

  const load = useCallback(
    async (pageToken?: string, append = false) => {
      if (!ready) return;
      setLoading(true);
      if (!append) {
        setError(null);
        setNextPageToken(null);
        setUserSearchActive(false);
      }
      try {
        const result = await fetchAdminUsers(pageToken);
        setUsers((current) => (append ? [...current, ...result.users] : result.users));
        setNextPageToken(result.nextPageToken);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Users could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    [ready],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function searchUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = userSearch.trim();
    if (!value) {
      setError("Enter a Firebase UID or HASA member ID to search.");
      return;
    }
    setLoading(true);
    setError(null);
    setNextPageToken(null);
    setUserSearchActive(true);
    try {
      const result = await searchAdminUserApi(value);
      setUsers(result.user ? [result.user] : []);
    } catch (cause) {
      setUsers([]);
      setError(cause instanceof Error ? cause.message : "Customer could not be found.");
    } finally {
      setLoading(false);
    }
  }

  function clearUserSearch() {
    setUserSearch("");
    setUserSearchActive(false);
    void load();
  }

  async function toggleDisabled(target: (typeof users)[number]) {
    if (!target.disabled && !window.confirm(`Disable sign-in for ${target.email || target.uid}?`)) {
      return;
    }
    try {
      await setAdminUserDisabledApi(target.uid, !target.disabled);
      toast.success(target.disabled ? "Customer account enabled." : "Customer account disabled.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account status could not be changed.");
    }
  }

  async function submitWalletAdjustment(
    event: FormEvent<HTMLFormElement>,
    target: (typeof users)[number],
  ) {
    event.preventDefault();
    setError(null);
    setAdjustmentSaving(true);
    try {
      await adjustAdminWalletApi(target.uid, {
        direction: adjustmentDirection,
        amountLkr: Number(adjustmentAmount),
        reason: adjustmentReason,
      });
      toast.success(
        adjustmentDirection === "credit" ? "Wallet balance credited." : "Wallet balance deducted.",
      );
      setAdjustingUid(null);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The wallet adjustment could not be saved.",
      );
    } finally {
      setAdjustmentSaving(false);
    }
  }

  const googleLinkedCount = users.filter((user) => user.providers.includes("google.com")).length;
  const visibleUsers =
    providerFilter === "all"
      ? users
      : users.filter((user) =>
          providerFilter === "google"
            ? user.providers.includes("google.com")
            : !user.providers.includes("google.com"),
        );

  return (
    <AdminShell
      title="Customer accounts"
      description="Manage sign-in and customer wallet balances. Every credit or deduction requires a reason that appears in the customer's wallet history."
    >
      {!userSearchActive && (
        <section className="admin-provider-summary" aria-label="Sign-in methods overview">
          <article className="admin-stat-card">
            <div className="admin-stat-card-top">
              <span>Accounts loaded</span>
              <Users size={15} />
            </div>
            <p className="admin-stat-value">{users.length}</p>
            <span className="admin-stat-foot">Firebase Auth accounts on the loaded pages</span>
          </article>
          <article className="admin-stat-card is-google">
            <div className="admin-stat-card-top">
              <span>Google linked</span>
              <span className="google-g-mark" aria-hidden="true">
                G
              </span>
            </div>
            <p className="admin-stat-value">{googleLinkedCount}</p>
            <span className="admin-stat-foot">Can sign in with one tap</span>
          </article>
          <article className="admin-stat-card is-email">
            <div className="admin-stat-card-top">
              <span>Password only</span>
              <Mail size={15} />
            </div>
            <p className="admin-stat-value">{users.length - googleLinkedCount}</p>
            <span className="admin-stat-foot">No Google account linked yet</span>
          </article>
        </section>
      )}
      <form className="admin-lookup-form" onSubmit={(event) => void searchUser(event)}>
        <input
          id="admin-user-id-search"
          aria-label="Search customer by Firebase UID or HASA member ID"
          className="admin-form-input admin-lookup-input"
          value={userSearch}
          onChange={(event) => setUserSearch(event.target.value)}
          placeholder="Firebase UID or HASA member ID"
          maxLength={128}
        />
        <Button type="submit" className="admin-quiet-button" variant="outline" disabled={loading}>
          <Search size={14} /> Find customer
        </Button>
        {userSearchActive && (
          <Button
            type="button"
            className="admin-quiet-button"
            variant="ghost"
            onClick={clearUserSearch}
            disabled={loading}
          >
            Clear search
          </Button>
        )}
      </form>
      <div className="admin-list-toolbar">
        <p>
          {userSearchActive
            ? "Customer ID search result."
            : "Showing Firebase Authentication users in pages of 100."}
        </p>
        <div className="admin-list-toolbar-actions">
          {!userSearchActive && (
            <div
              className="admin-provider-filter"
              role="group"
              aria-label="Filter customers by sign-in method"
            >
              {(
                [
                  { id: "all", label: "All" },
                  { id: "google", label: "Google" },
                  { id: "email", label: "Password only" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={providerFilter === option.id ? "is-active" : undefined}
                  aria-pressed={providerFilter === option.id}
                  onClick={() => setProviderFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <Button
            className="admin-quiet-button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>
      {error && (
        <p className="admin-error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading customers…</p>
      ) : (
        <div className="admin-customer-list">
          {visibleUsers.map((user) => (
            <div className="admin-customer-entry" key={user.uid}>
              <article className="admin-customer-row">
                <span className="admin-customer-avatar">
                  {user.photoUrl ? (
                    <img
                      src={user.photoUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    (user.displayName || user.email || "C").charAt(0).toUpperCase()
                  )}
                </span>
                <div className="admin-customer-main">
                  <p>{user.displayName || "Customer"}</p>
                  <span>{user.email || "No email address"}</span>
                  <code className="admin-customer-member-id">
                    {user.memberId ?? "Member ID pending next sign-in"}
                  </code>
                  <span className="admin-customer-balance">
                    Wallet balance: Rs. {user.walletBalanceLkr.toLocaleString()}
                  </span>
                  <div className="admin-customer-providers">
                    {user.providers.includes("google.com") && (
                      <span className="admin-provider-badge is-google">
                        <span className="google-g-mark" aria-hidden="true">
                          G
                        </span>
                        Google
                      </span>
                    )}
                    {user.providers.includes("password") && (
                      <span className="admin-provider-badge is-email">
                        <Mail size={9} aria-hidden="true" />
                        Email
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`admin-status-pill ${user.disabled ? "is-muted" : user.isAdmin ? "is-success" : "is-pending"}`}
                >
                  <i />
                  {user.isAdmin ? "Administrator" : user.disabled ? "Disabled" : "Active"}
                </span>
                <Button
                  className="admin-quiet-button"
                  variant="outline"
                  size="sm"
                  aria-label={`Adjust wallet for ${user.displayName || user.email || user.uid}`}
                  onClick={() => {
                    setAdjustingUid((current) => (current === user.uid ? null : user.uid));
                    setAdjustmentDirection("credit");
                    setAdjustmentAmount("");
                    setAdjustmentReason("");
                    setError(null);
                  }}
                >
                  Wallet adjustment
                </Button>
                {!user.isAdmin && (
                  <Button
                    className="admin-quiet-button"
                    variant={user.disabled ? "outline" : "destructive"}
                    size="sm"
                    onClick={() => void toggleDisabled(user)}
                  >
                    {user.disabled ? "Re-enable sign-in" : "Disable sign-in"}
                  </Button>
                )}
              </article>
              {adjustingUid === user.uid && (
                <form
                  className="admin-wallet-adjustment"
                  onSubmit={(event) => void submitWalletAdjustment(event, user)}
                >
                  <label className="admin-form-field">
                    <span className="admin-field-label">Adjustment</span>
                    <select
                      className="admin-form-input admin-form-select"
                      value={adjustmentDirection}
                      onChange={(event) => {
                        if (event.target.value === "credit" || event.target.value === "deduct") {
                          setAdjustmentDirection(event.target.value);
                        }
                      }}
                    >
                      <option value="credit">Credit</option>
                      <option value="deduct">Deduct</option>
                    </select>
                  </label>
                  <label className="admin-form-field">
                    <span className="admin-field-label">Amount (LKR)</span>
                    <input
                      className="admin-form-input"
                      type="number"
                      min="1"
                      max="10000000"
                      step="1"
                      required
                      value={adjustmentAmount}
                      onChange={(event) => setAdjustmentAmount(event.target.value)}
                    />
                  </label>
                  <label className="admin-form-field admin-wallet-adjustment-reason">
                    <span className="admin-field-label">Reason (shown to customer)</span>
                    <input
                      className="admin-form-input"
                      type="text"
                      minLength={3}
                      maxLength={500}
                      required
                      value={adjustmentReason}
                      onChange={(event) => setAdjustmentReason(event.target.value)}
                    />
                  </label>
                  <div className="admin-wallet-adjustment-actions">
                    <Button type="submit" disabled={adjustmentSaving}>
                      {adjustmentSaving ? "Saving…" : "Apply adjustment"}
                    </Button>
                    <Button
                      type="button"
                      className="admin-quiet-button"
                      variant="outline"
                      onClick={() => setAdjustingUid(null)}
                      disabled={adjustmentSaving}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <div className="admin-empty-state">
              <Users size={24} />
              <strong>{userSearchActive ? "No matching customer" : "No customers found"}</strong>
              <span>
                {userSearchActive
                  ? "Check the Firebase UID or HASA member ID and try again."
                  : "Customer accounts will appear here after registration."}
              </span>
            </div>
          )}
          {users.length > 0 && visibleUsers.length === 0 && (
            <div className="admin-empty-state">
              <Users size={24} />
              <strong>No accounts match this sign-in filter</strong>
              <span>Switch back to "All" to see every loaded customer.</span>
            </div>
          )}
        </div>
      )}
      {nextPageToken && !userSearchActive && (
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void load(nextPageToken, true)}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load more customers"}
        </Button>
      )}
    </AdminShell>
  );
}

const templates: Record<"games" | "products" | "gameAccounts", AdminRecord> = {
  games: {
    slug: "new-game",
    name: "",
    currency: "",
    tone: "ice",
    icon: "diamond",
    artworkKey: "",
    description: "",
    serverOptions: [],
    active: true,
    displayOrder: 0,
  },
  products: {
    id: "new-product",
    gameSlug: "",
    category: "diamonds",
    amount: 1,
    unitLabel: "",
    name: "",
    priceUsd: 0,
    pricePkr: 0,
    bonus: 0,
    isPopular: false,
    isBestValue: false,
    isVip: false,
    active: true,
    displayOrder: 0,
  },
  gameAccounts: {
    id: "new-account",
    gameId: "",
    gameName: "",
    title: "",
    tagline: "",
    priceUsd: 0,
    pricePkr: 0,
    priceSample: "",
    level: 0,
    rank: "",
    server: "",
    loginType: "",
    artworkKey: "",
    tone: "ice",
    verified: false,
    status: "Available",
    badges: [],
    inventoryHighlights: [],
    description: "",
    features: [],
    active: false,
    displayOrder: 0,
  },
};

export function AdminLayout() {
  return <Outlet />;
}

export function AdminPasswordLogin({ redirect }: { redirect: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signInWithAdminPassword({ data: { password } });
      await signInWithCustomToken(getFirebaseAuth(), result.token);
      window.location.assign(redirect);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container admin-password-login">
      <section className="admin-panel">
        <span className="admin-page-eyebrow">
          <ShieldCheck size={13} /> SECURE STORE ACCESS
        </span>
        <h1>Admin sign in</h1>
        <p>Enter the temporary admin password configured by the store owner.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label className="admin-form-field">
            <span className="admin-field-label">Admin password</span>
            <input
              className="admin-form-input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>
          {error && (
            <p className="admin-error-banner" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting || !password}>
            {submitting ? "Signing in…" : "Sign in to Admin"}
          </Button>
        </form>
        <p className="admin-helper-copy">
          This temporary sign-in creates a Firebase session for an account already on the server
          admin allowlist. It does not change the Firestore profile role.
        </p>
      </section>
    </main>
  );
}

export function AdminOverview() {
  return <OverviewContent />;
}
export function AdminGames() {
  return (
    <AdminDataPage
      title="Games"
      description="Create, edit, and archive Firestore game catalog entries."
      collection="games"
      template={templates.games}
    />
  );
}
export function AdminPackages() {
  return (
    <AdminDataPage
      title="Top-up packages"
      description="Manage package names, delivery details, and LKR prices. Archived packages stay hidden from customers."
      collection="products"
      template={templates.products}
    />
  );
}
export function AdminAccounts() {
  return (
    <AdminDataPage
      title="Marketplace accounts"
      description="Manage informational listings. Listings default inactive and this site does not process account sales."
      collection="gameAccounts"
      template={templates.gameAccounts}
    />
  );
}
export function AdminOrders() {
  return <AdminOrdersPage />;
}

const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "payment_review",
  "paid",
  "processing",
  "completed",
  "delivered",
  "failed",
  "cancelled",
  "refunded",
];
const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "unpaid",
  "proof_submitted",
  "paid",
  "failed",
  "proof_rejected",
  "refunded",
];

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}
function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

function AdminOrdersPage() {
  const { ready, uid } = useAccount();
  const [orders, setOrders] = useState<AdminDocument[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, { status: OrderStatus; paymentStatus: PaymentStatus }>
  >({});
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [proofLoadingId, setProofLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSearchActive, setOrderSearchActive] = useState(false);

  const load = useCallback(
    async (pageToken?: string, append = false) => {
      if (!ready) return;
      setLoading(true);
      if (!append) {
        setError(null);
        setOrderSearchActive(false);
      }
      try {
        const result = await fetchAdminCollection("orders", pageToken);
        setOrders(
          (current) =>
            (append ? [...current, ...result.items] : result.items) as unknown as AdminDocument[],
        );
        setDrafts((current) => ({
          ...(append ? current : {}),
          ...Object.fromEntries(
            result.items.map((order) => [
              order["id"],
              {
                status: isOrderStatus(order["status"]) ? order["status"] : "pending",
                paymentStatus: isPaymentStatus(order["paymentStatus"])
                  ? order["paymentStatus"]
                  : "unpaid",
              },
            ]),
          ),
        }));
        setNextPageToken(result.nextPageToken);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Orders could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    [ready, uid],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function searchOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = orderSearch.trim();
    if (!value) {
      setError("Enter an order number to search.");
      return;
    }
    setLoading(true);
    setError(null);
    setNextPageToken(null);
    setOrderSearchActive(true);
    try {
      const result = await searchAdminOrderApi(value);
      const found = result.order ? [result.order as unknown as AdminDocument] : [];
      setOrders(found);
      setDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          found.map((order) => [
            order["id"],
            {
              status: isOrderStatus(order["status"]) ? order["status"] : "pending",
              paymentStatus: isPaymentStatus(order["paymentStatus"])
                ? order["paymentStatus"]
                : "unpaid",
            },
          ]),
        ),
      }));
    } catch (cause) {
      setOrders([]);
      setError(cause instanceof Error ? cause.message : "Order could not be found.");
    } finally {
      setLoading(false);
    }
  }

  function clearOrderSearch() {
    setOrderSearch("");
    setOrderSearchActive(false);
    void load();
  }

  async function saveStatus(orderId: string) {
    const draft = drafts[orderId];
    if (!draft) {
      setError("Choose valid order statuses before saving.");
      return;
    }
    setSavingId(orderId);
    setError(null);
    try {
      const result = (await updateAdminOrderStatusApi(orderId, draft)) as {
        orderId: string;
        status: string;
        paymentStatus: string;
        emailNotificationSent: boolean;
        emailNotificationAttempted?: boolean;
      };
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: draft.status,
                paymentStatus: draft.paymentStatus,
              }
            : order,
        ),
      );
      setDrafts((current) => ({
        ...current,
        [orderId]: {
          status: draft.status,
          paymentStatus: draft.paymentStatus,
        },
      }));
      toast.success("Order status updated successfully.");
      if (result.emailNotificationSent) {
        toast.info("Customer notification email sent.");
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Order status could not be updated.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  }

  async function loadProof(orderId: string) {
    setProofLoadingId(orderId);
    setError(null);
    try {
      const result = await fetchAdminOrderProofUrl(orderId);
      setProofUrls((current) => ({ ...current, [orderId]: result.url }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment proof could not be opened.");
    } finally {
      setProofLoadingId(null);
    }
  }

  const failedOrderCount = orders.filter(
    (order) =>
      order["gameSlug"] === "free-fire" && nexauraFailureKind(order["nexauraStatus"]) !== null,
  ).length;

  return (
    <AdminShell
      title="Orders"
      description="Review payment proofs and manage order fulfillment statuses."
    >
      <section className="admin-panel admin-records-panel">
        <form className="admin-lookup-form" onSubmit={(event) => void searchOrder(event)}>
          <input
            id="admin-order-id-search"
            aria-label="Search by order number"
            className="admin-form-input admin-lookup-input"
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder="Enter order number"
            maxLength={128}
          />
          <Button type="submit" className="admin-quiet-button" variant="outline" disabled={loading}>
            <Search size={14} /> Find order
          </Button>
          {orderSearchActive && (
            <Button
              type="button"
              className="admin-quiet-button"
              variant="ghost"
              onClick={clearOrderSearch}
              disabled={loading}
            >
              Clear search
            </Button>
          )}
        </form>
        <div className="admin-panel-header">
          <div>
            <span className="admin-panel-eyebrow">LIVE COLLECTION</span>
            <h2>
              Firestore orders <span className="admin-count-pill">{orders.length}</span>
            </h2>
          </div>
          <Button
            className="admin-quiet-button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
        {failedOrderCount > 0 && (
          <div className="admin-failure-callout" role="status">
            <AlertTriangle size={15} />
            <span>
              {failedOrderCount}{" "}
              {failedOrderCount === 1 ? "order on this page needs" : "orders on this page need"}{" "}
              automatic top-up attention.
            </span>
            <Link to="/admin/topup-failures">Review top-up failures</Link>
          </div>
        )}
        {error && (
          <p className="admin-error-banner" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="admin-loading-state" role="status">
            <span className="admin-loading-orb" /> Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="admin-empty-state">
            <ReceiptText size={24} />
            <strong>{orderSearchActive ? "No matching order" : "No orders yet"}</strong>
            <span>
              {orderSearchActive
                ? "Check the order number and try again."
                : "Customer orders will appear here."}
            </span>
          </div>
        ) : (
          <div className="admin-record-list">
            {orders.map((order) => {
              const draft = drafts[order.id] ?? { status: "pending", paymentStatus: "unpaid" };
              const hasProof = typeof order["paymentProofStoragePath"] === "string";
              const failureKind =
                order["gameSlug"] === "free-fire"
                  ? nexauraFailureKind(order["nexauraStatus"])
                  : null;
              const failureTone = failureKind === "submission_unknown" ? "is-warning" : "is-danger";
              const failureRowTone =
                failureKind === "submission_unknown" ? "is-nexaura-warning" : "is-nexaura-failed";
              return (
                <article
                  key={order.id}
                  className={`admin-record-row admin-order-row${failureKind ? ` ${failureRowTone}` : ""}`}
                >
                  <span className={`admin-record-symbol${failureKind ? ` ${failureTone}` : ""}`}>
                    {failureKind ? <AlertTriangle size={17} /> : <ReceiptText size={17} />}
                  </span>
                  <div className="admin-record-main">
                    <div className="admin-record-headline">
                      <p className="admin-record-title">
                        {String(order["packageName"] ?? "Top-up order")}
                      </p>
                      {failureKind && (
                        <span className={`admin-status-pill ${failureTone}`}>
                          <i /> {nexauraFailureLabel(failureKind)}
                        </span>
                      )}
                    </div>
                    <p className="admin-record-meta">
                      <code>{order.id}</code>
                      <span>·</span>
                      {String(order["customerEmail"] ?? order["customerUid"] ?? "Customer")}
                      <span>·</span>
                      {String(order["gameName"] ?? order["gameSlug"] ?? "")}
                      <span>·</span>
                      Player {String(order["playerId"] ?? "—")}
                      <span>·</span>
                      LKR {Number(order["pricePkr"] ?? 0).toLocaleString()}
                      <span>·</span>
                      {String(order["paymentMethod"] ?? "Unknown method")}
                    </p>
                    {order["gameSlug"] === "free-fire" && (
                      <p className="admin-record-meta">
                        Nexaura: {String(order["nexauraStatus"] ?? "awaiting payment")}
                        {typeof order["nexauraOrderId"] === "string" && (
                          <>
                            <span>·</span>
                            Provider order {order["nexauraOrderId"]}
                          </>
                        )}
                        <span>·</span>
                        {formatDateTime(order["createdAt"])}
                      </p>
                    )}
                    {failureKind && (
                      <p className={`admin-nexaura-reason ${failureTone}`}>
                        <AlertTriangle size={13} />
                        <span>
                          <strong>{nexauraFailureLabel(failureKind)}:</strong>{" "}
                          {nexauraFailureReason(order)}
                        </span>
                      </p>
                    )}
                    <div className="admin-order-controls">
                      <label>
                        Order status
                        <select
                          className="admin-form-input admin-form-select"
                          value={draft.status}
                          onChange={(event) => {
                            const status = event.target.value;
                            if (!isOrderStatus(status)) return;
                            setDrafts((current) => ({
                              ...current,
                              [order.id]: {
                                ...draft,
                                status,
                              },
                            }));
                          }}
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option value={status} key={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Payment status
                        <select
                          className="admin-form-input admin-form-select"
                          value={draft.paymentStatus}
                          onChange={(event) => {
                            const paymentStatus = event.target.value;
                            if (!isPaymentStatus(paymentStatus)) return;
                            setDrafts((current) => ({
                              ...current,
                              [order.id]: {
                                ...draft,
                                paymentStatus,
                              },
                            }));
                          }}
                        >
                          {PAYMENT_STATUSES.map((status) => (
                            <option value={status} key={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        className="admin-primary-button"
                        size="sm"
                        disabled={savingId === order.id}
                        onClick={() => void saveStatus(order.id)}
                      >
                        {savingId === order.id ? "Saving…" : "Save statuses"}
                      </Button>
                      {hasProof &&
                        (proofUrls[order.id] ? (
                          <a href={proofUrls[order.id]} target="_blank" rel="noreferrer">
                            View payment proof
                          </a>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={proofLoadingId === order.id}
                            onClick={() => void loadProof(order.id)}
                          >
                            {proofLoadingId === order.id ? "Preparing…" : "View payment proof"}
                          </Button>
                        ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {nextPageToken && !orderSearchActive && (
          <Button
            className="admin-load-more"
            variant="outline"
            onClick={() => void load(nextPageToken, true)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more orders"}
          </Button>
        )}
      </section>
    </AdminShell>
  );
}
type NexauraFailureFilter = "all" | NexauraFailureKind;

const NEXAURA_FAILURE_FILTERS: ReadonlyArray<{ id: NexauraFailureFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "failed", label: "Delivery failed" },
  { id: "submission_failed", label: "Submission failed" },
  { id: "submission_unknown", label: "Needs review" },
];

export function AdminTopupFailures() {
  const { ready, uid } = useAccount();
  const [items, setItems] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NexauraFailureFilter>("all");
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminTopupFailures();
      setItems(result.items as unknown as AdminDocument[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Top-up failures could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [ready, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = {
    total: items.length,
    failed: items.filter((order) => nexauraFailureKind(order["nexauraStatus"]) === "failed").length,
    submissionFailed: items.filter(
      (order) => nexauraFailureKind(order["nexauraStatus"]) === "submission_failed",
    ).length,
    submissionUnknown: items.filter(
      (order) => nexauraFailureKind(order["nexauraStatus"]) === "submission_unknown",
    ).length,
  };

  const needle = query.trim().toLowerCase();
  const visible = items.filter((order) => {
    const kind = nexauraFailureKind(order["nexauraStatus"]);
    if (filter !== "all" && kind !== filter) return false;
    if (!needle) return true;
    return [
      order.id,
      order["orderId"],
      order["customerEmail"],
      order["playerId"],
      order["nexauraOrderId"],
    ]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLowerCase().includes(needle));
  });

  async function copyOrderId(orderId: string) {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopiedId(orderId);
      setTimeout(() => setCopiedId((current) => (current === orderId ? null : current)), 1800);
      toast.success("Order number copied");
    } catch {
      toast.error("Could not copy the order number.");
    }
  }

  return (
    <AdminShell
      title="Top-up failures"
      description="Free Fire orders where Nexaura reported a failed delivery, a rejected submission, or an unconfirmed top-up — with the recorded provider reason."
    >
      <div className="admin-stat-grid admin-topup-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-card-top">
            <span>Open issues</span>
            <AlertTriangle size={18} />
          </div>
          <p className="admin-stat-value">{counts.total.toLocaleString()}</p>
          <span className="admin-stat-foot">Failed or unconfirmed top-ups</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-top">
            <span>Delivery failed</span>
            <AlertTriangle size={18} />
          </div>
          <p className="admin-stat-value">{counts.failed.toLocaleString()}</p>
          <span className="admin-stat-foot">Nexaura reported a failed delivery</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-top">
            <span>Submission failed</span>
            <AlertTriangle size={18} />
          </div>
          <p className="admin-stat-value">{counts.submissionFailed.toLocaleString()}</p>
          <span className="admin-stat-foot">Provider rejected the request</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-top">
            <span>Needs review</span>
            <AlertTriangle size={18} />
          </div>
          <p className="admin-stat-value">{counts.submissionUnknown.toLocaleString()}</p>
          <span className="admin-stat-foot">Provider reply was not confirmed</span>
        </div>
      </div>

      <section className="admin-panel admin-records-panel">
        <div className="admin-panel-header">
          <div>
            <span className="admin-panel-eyebrow">PROVIDER FAILURES</span>
            <h2>
              Automatic top-up issues <span className="admin-count-pill">{visible.length}</span>
            </h2>
          </div>
          <Button
            className="admin-quiet-button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
        <div className="admin-failure-toolbar">
          <input
            aria-label="Search top-up failures"
            className="admin-form-input admin-lookup-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order, customer, player or provider ID"
            maxLength={128}
          />
          <div className="admin-provider-filter" role="group" aria-label="Filter top-up failures">
            {NEXAURA_FAILURE_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={filter === option.id ? "is-active" : ""}
                onClick={() => setFilter(option.id)}
                aria-pressed={filter === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="admin-error-banner" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="admin-loading-state" role="status">
            <span className="admin-loading-orb" /> Loading top-up failures…
          </div>
        ) : visible.length === 0 ? (
          <div className="admin-empty-state">
            <ShieldCheck size={24} />
            <strong>{items.length === 0 ? "No top-up failures" : "No matching failures"}</strong>
            <span>
              {items.length === 0
                ? "When Nexaura reports a failed or unconfirmed top-up, it appears here with the provider reason."
                : "Adjust the search text or filter to see other failures."}
            </span>
          </div>
        ) : (
          <div className="admin-record-list">
            {visible.map((order) => {
              const kind = nexauraFailureKind(order["nexauraStatus"]) ?? "failed";
              const tone = kind === "submission_unknown" ? "is-warning" : "is-danger";
              const rowTone =
                kind === "submission_unknown" ? "is-nexaura-warning" : "is-nexaura-failed";
              return (
                <article key={order.id} className={`admin-record-row admin-order-row ${rowTone}`}>
                  <span className={`admin-record-symbol ${tone}`}>
                    <AlertTriangle size={17} />
                  </span>
                  <div className="admin-record-main">
                    <div className="admin-record-headline">
                      <p className="admin-record-title">
                        {String(order["packageName"] ?? "Top-up order")}
                      </p>
                      <span className={`admin-status-pill ${tone}`}>
                        <i /> {nexauraFailureLabel(kind)}
                      </span>
                    </div>
                    <p className="admin-record-meta">
                      <code>{order.id}</code>
                      <span>·</span>
                      {String(order["customerEmail"] ?? order["customerUid"] ?? "Customer")}
                      <span>·</span>
                      Player {String(order["playerId"] ?? "—")}
                      <span>·</span>
                      LKR {Number(order["pricePkr"] ?? 0).toLocaleString()}
                      <span>·</span>
                      {formatDateTime(order["createdAt"])}
                    </p>
                    <p className={`admin-nexaura-reason ${tone}`}>
                      <AlertTriangle size={13} />
                      <span>
                        <strong>Reason:</strong> {nexauraFailureReason(order)}
                      </span>
                    </p>
                    <div className="admin-order-controls">
                      {typeof order["nexauraOrderId"] === "string" && (
                        <span className="admin-failure-provider">
                          Provider order {order["nexauraOrderId"]}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copyOrderId(order.id)}
                      >
                        {copiedId === order.id ? <Check size={13} /> : <Copy size={13} />}{" "}
                        {copiedId === order.id ? "Copied" : "Copy order number"}
                      </Button>
                      <Link to="/admin/orders">Open orders</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}

export function AdminDepositRecords() {
  return (
    <AdminDataPage
      title="Wallet deposits"
      description="Review provider-verified eZ Cash deposit records; wallet credit remains controlled by the trusted verification service."
      collection="wallet_deposits"
      readOnly
    />
  );
}
export function AdminSupport() {
  return <AdminSettingsPage mode="faqs" />;
}
export function AdminSettings() {
  return <AdminSettingsPage mode="settings" />;
}
type EditablePaymentMethod = PaymentMethodConfig & { editKey: string };

let paymentMethodKeySeed = 0;
function nextPaymentMethodKey(): string {
  paymentMethodKeySeed += 1;
  return `payment-method-${paymentMethodKeySeed}`;
}

function toEditablePaymentMethods(methods: PaymentMethodConfig[]): EditablePaymentMethod[] {
  return methods.map((method) => ({ ...method, editKey: nextPaymentMethodKey() }));
}

export function AdminPaymentMethods() {
  const { ready, uid } = useAccount();
  const { data: catalogGames = [] } = useGames();
  const [methods, setMethods] = useState<EditablePaymentMethod[]>(() =>
    toEditablePaymentMethods(DEFAULT_PAYMENT_METHODS.map((method) => ({ ...method }))),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const { settings } = await fetchApiCatalog();
      const legacyEzcashName =
        typeof settings?.["paymentEzcashName"] === "string" ? settings["paymentEzcashName"] : "";
      const legacyEzcashNumber =
        typeof settings?.["paymentEzcashNumber"] === "string"
          ? settings["paymentEzcashNumber"]
          : "";
      const parsed = parsePaymentMethods(settings?.["paymentMethods"]).map((method) =>
        method.id === "ezcash"
          ? {
              ...method,
              accountName: method.accountName?.trim() || legacyEzcashName,
              accountNumber: method.accountNumber?.trim() || legacyEzcashNumber,
            }
          : method,
      );
      setMethods(toEditablePaymentMethods(parsed));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment methods could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [ready, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateMethod(editKey: string, changes: Partial<PaymentMethodConfig>) {
    setMethods((current) =>
      current.map((method) => (method.editKey === editKey ? { ...method, ...changes } : method)),
    );
  }

  function addMethod() {
    setMethods((current) => {
      const taken = new Set(current.map((method) => method.id));
      let id = "new-method";
      let suffix = 2;
      while (taken.has(id)) id = `new-method-${suffix++}`;
      return [
        ...current,
        {
          id,
          name: "New payment method",
          sub: "Manual payment · proof required",
          short: "NEW",
          active: false,
          kind: "manual",
          requiresProof: true,
          accountName: "",
          accountNumber: "",
          games: [],
          editKey: nextPaymentMethodKey(),
        },
      ];
    });
  }

  function removeMethod(editKey: string) {
    setMethods((current) => current.filter((method) => method.editKey !== editKey));
  }

  function setAllGames(editKey: string, allGames: boolean) {
    updateMethod(editKey, { games: allGames ? [] : catalogGames.map((game) => game.id) });
  }

  function toggleGameScope(editKey: string, gameId: string) {
    setMethods((current) =>
      current.map((method) => {
        if (method.editKey !== editKey) return method;
        const scoped = method.games ?? [];
        return {
          ...method,
          games: scoped.includes(gameId)
            ? scoped.filter((id) => id !== gameId)
            : [...scoped, gameId],
        };
      }),
    );
  }

  async function save() {
    setError(null);
    const prepared = methods.map((method) => {
      const id = method.id.trim();
      return {
        id,
        name: method.name.trim(),
        sub: method.sub.trim(),
        short: method.short.trim(),
        active: method.active,
        kind: id === "wallet" ? ("wallet" as const) : ("manual" as const),
        // Wallet never takes a receipt; manual methods default to required so
        // rows saved before this flag existed keep their current behaviour.
        requiresProof: id === "wallet" ? false : method.requiresProof !== false,
        logoUrl: method.logoUrl?.trim() ? method.logoUrl.trim() : null,
        accountName: method.accountName?.trim() ?? "",
        accountNumber: method.accountNumber?.trim() ?? "",
        games: Array.from(new Set((method.games ?? []).map((game) => game.trim()).filter(Boolean))),
        // Checkout warning banner. Wallet can never show one, so it is forced off.
        warningEnabled: id === "wallet" ? false : method.warningEnabled === true,
        warningTitle:
          id === "wallet" || !method.warningEnabled ? null : method.warningTitle?.trim() || null,
        warningMessage:
          id === "wallet" || !method.warningEnabled
            ? null
            : method.warningMessage?.trim() || null,
      };
    });

    if (prepared.length === 0) {
      setError("Add at least one payment method.");
      return;
    }
    if (new Set(prepared.map((method) => method.id)).size !== prepared.length) {
      setError("Each payment method needs a unique ID.");
      return;
    }
    const invalidId = prepared.find((method) => !PAYMENT_METHOD_ID_PATTERN.test(method.id));
    if (invalidId) {
      setError(
        `"${invalidId.id || "unnamed"}" is not a valid method ID. Use lowercase letters, numbers, dashes or underscores.`,
      );
      return;
    }
    const missingName = prepared.find((method) => !method.name);
    if (missingName) {
      setError("Every payment method needs a display name.");
      return;
    }
    const incompleteManual = prepared.find(
      (method) =>
        method.kind === "manual" && method.active && (!method.accountName || !method.accountNumber),
    );
    if (incompleteManual) {
      setError(
        `"${incompleteManual.name}" needs an account name and number before it can be active.`,
      );
      return;
    }

    setSaving(true);
    try {
      await saveAdminPaymentMethodsApi(prepared as PaymentMethodConfig[]);
      toast.success("Payment methods saved.");
      // Keep the editor on exactly what was just saved instead of refetching:
      // a refetch could momentarily return stale data and silently drop methods.
      setMethods(toEditablePaymentMethods(prepared));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment methods could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Payment methods"
      description="Create payment options and choose which games each one applies to."
    >
      {error && (
        <p className="admin-error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading payment methods…</p>
      ) : (
        <section className="admin-panel admin-settings-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-panel-eyebrow">CHECKOUT CONFIGURATION</span>
              <h2>Available payment methods</h2>
            </div>
            <span className="admin-settings-doc">
              <Database size={14} /> settings/store
            </span>
          </div>
          <p className="admin-helper-copy">
            Wallet is built in. Manual methods (bank transfer, eZ Cash, and others) stay unpaid
            until an administrator reviews the payment proof — switch off{" "}
            <strong>Receipt required</strong> for a method that should not ask customers for a slip.
            Leave “All games” checked to show a method on every game, or pick specific games. New
            methods start <strong>paused</strong> — switch on “Active” before saving, otherwise the
            games page will not show them.
          </p>
          <div className="admin-form-grid">
            {methods.map((method) => {
              const isWallet = method.id === "wallet";
              const isBuiltIn = isWallet || method.id === "ezcash";
              const allGames = !method.games || method.games.length === 0;
              return (
                <div className="admin-form-section" key={method.editKey}>
                  <div className="admin-payment-method-head">
                    <div className="admin-payment-method-title">
                      <h3>{method.name || method.id || "Untitled method"}</h3>
                      <span
                        className={`admin-method-status ${method.active ? "is-active" : "is-paused"}`}
                      >
                        {method.active ? "Active" : "Paused"}
                      </span>
                    </div>
                    {!isWallet && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeMethod(method.editKey)}
                      >
                        <Trash2 size={14} /> Remove
                      </Button>
                    )}
                  </div>
                  <label className="admin-toggle-row">
                    <input
                      type="checkbox"
                      checked={method.active}
                      onChange={(event) =>
                        updateMethod(method.editKey, { active: event.target.checked })
                      }
                    />
                    <span className="admin-toggle-copy">
                      <strong>{method.active ? "Active" : "Paused"}</strong>
                      <small>
                        {method.active
                          ? "Customers can choose this method."
                          : "Hidden from checkout; new orders are blocked."}
                      </small>
                    </span>
                  </label>
                  {!method.active && (
                    <p className="admin-inline-note is-warning" role="status">
                      This method is paused, so it will not appear on any games page or checkout
                      until you switch it on and save.
                    </p>
                  )}
                  {!isWallet && (
                    <label className="admin-toggle-row">
                      <input
                        type="checkbox"
                        checked={method.requiresProof !== false}
                        onChange={(event) =>
                          updateMethod(method.editKey, { requiresProof: event.target.checked })
                        }
                      />
                      <span className="admin-toggle-copy">
                        <strong>
                          {method.requiresProof !== false
                            ? "Receipt required"
                            : "No receipt required"}
                        </strong>
                        <small>
                          {method.requiresProof !== false
                            ? "Customers upload a payment receipt; the order stays unpaid until you review it."
                            : "No receipt upload. The order is created unpaid and you confirm it manually."}
                        </small>
                      </span>
                    </label>
                  )}
                  <FormField label="Display name">
                    <input
                      className="admin-form-input"
                      value={method.name}
                      maxLength={100}
                      onChange={(event) =>
                        updateMethod(method.editKey, { name: event.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Checkout description">
                    <input
                      className="admin-form-input"
                      value={method.sub}
                      maxLength={200}
                      onChange={(event) =>
                        updateMethod(method.editKey, { sub: event.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Short label">
                    <input
                      className="admin-form-input"
                      value={method.short}
                      maxLength={10}
                      onChange={(event) =>
                        updateMethod(method.editKey, { short: event.target.value })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Method ID"
                    hint={
                      isBuiltIn
                        ? "Built-in IDs cannot be changed."
                        : "Lowercase letters, numbers, dashes or underscores."
                    }
                  >
                    <input
                      className="admin-form-input"
                      value={method.id}
                      maxLength={50}
                      disabled={isBuiltIn}
                      onChange={(event) => updateMethod(method.editKey, { id: event.target.value })}
                    />
                  </FormField>
                  {!isWallet && (
                    <>
                      <FormField label="Account name" hint="Shown to customers at checkout.">
                        <input
                          className="admin-form-input"
                          value={method.accountName ?? ""}
                          maxLength={100}
                          onChange={(event) =>
                            updateMethod(method.editKey, { accountName: event.target.value })
                          }
                        />
                      </FormField>
                      <FormField
                        label="Account / wallet number"
                        hint="Where customers send the money."
                      >
                        <input
                          className="admin-form-input"
                          value={method.accountNumber ?? ""}
                          maxLength={100}
                          onChange={(event) =>
                            updateMethod(method.editKey, { accountNumber: event.target.value })
                          }
                        />
                      </FormField>
                      <FormField label="Logo URL" hint="Optional. Blank shows the short label.">
                        <input
                          className="admin-form-input"
                          value={method.logoUrl ?? ""}
                          maxLength={1000}
                          onChange={(event) =>
                            updateMethod(method.editKey, { logoUrl: event.target.value })
                          }
                        />
                      </FormField>
                    </>
                  )}
                  {!isWallet && (
                    <fieldset className="admin-warning-scope">
                      <legend>Checkout warning banner</legend>
                      <label className="admin-toggle-row">
                        <input
                          type="checkbox"
                          checked={method.warningEnabled === true}
                          onChange={(event) =>
                            updateMethod(method.editKey, { warningEnabled: event.target.checked })
                          }
                        />
                        <span className="admin-toggle-copy">
                          <strong>
                            {method.warningEnabled === true ? "Banner on" : "Banner off"}
                          </strong>
                          <small>
                            {method.warningEnabled === true
                              ? "Customers see this warning before paying with this method."
                              : "No warning banner at checkout."}
                          </small>
                        </span>
                      </label>
                      {method.warningEnabled === true && (
                        <>
                          <FormField
                            label="Warning title"
                            hint="Short heading, e.g. “Extra LKR 20 fee”."
                          >
                            <input
                              className="admin-form-input"
                              value={method.warningTitle ?? ""}
                              maxLength={120}
                              placeholder="Remember: +LKR 20 fee"
                              onChange={(event) =>
                                updateMethod(method.editKey, { warningTitle: event.target.value })
                              }
                            />
                          </FormField>
                          <FormField
                            label="Warning details"
                            hint="Explain the fee or condition clearly."
                          >
                            <textarea
                              className="admin-form-input admin-form-textarea"
                              value={method.warningMessage ?? ""}
                              maxLength={600}
                              rows={3}
                              placeholder="When paying with eZ Cash, please add LKR 20 to cover the service fee."
                              onChange={(event) =>
                                updateMethod(method.editKey, { warningMessage: event.target.value })
                              }
                            />
                          </FormField>
                          {(method.warningTitle?.trim() || method.warningMessage?.trim()) && (
                            <div className="admin-warning-preview" role="status">
                              <span className="admin-warning-preview-label">Preview</span>
                              <div className="checkout-warning-banner">
                                <AlertTriangle size={18} className="checkout-warning-icon" />
                                <div className="checkout-warning-copy">
                                  {method.warningTitle?.trim() && (
                                    <strong>{method.warningTitle.trim()}</strong>
                                  )}
                                  {method.warningMessage?.trim() && (
                                    <p>{method.warningMessage.trim()}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </fieldset>
                  )}
                  <fieldset className="admin-games-scope">
                    <legend>Available for games</legend>
                    <label className="admin-toggle-row">
                      <input
                        type="checkbox"
                        checked={allGames}
                        onChange={(event) => setAllGames(method.editKey, event.target.checked)}
                      />
                      <span className="admin-toggle-copy">
                        <strong>All games</strong>
                        <small>Show this method on every game.</small>
                      </span>
                    </label>
                    {!allGames && (
                      <div className="admin-games-scope-grid">
                        {catalogGames.map((game) => (
                          <label key={game.id} className="admin-game-scope-option">
                            <input
                              type="checkbox"
                              checked={method.games?.includes(game.id) ?? false}
                              onChange={() => toggleGameScope(method.editKey, game.id)}
                            />
                            <span>{game.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                </div>
              );
            })}
          </div>
          <div className="admin-form-actions">
            <Button type="button" variant="outline" onClick={addMethod}>
              <Plus size={15} /> Add payment method
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save payment methods"}
            </Button>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
export function AdminUsers() {
  return <AdminUsersPage />;
}

const DEFAULT_FAQS = { items: [] as { question: string; answer: string }[] };
const DEFAULT_SETTINGS = {
  storeName: "HASA GOLD STORE",
  tagline: "",
  supportEmail: "",
  supportWhatsapp: "",
  paymentEzcashNumber: "0741635465",
  paymentEzcashName: "Nexaura Topup",
  currency: "LKR",
  bannerEnabled: false,
  maintenanceMode: false,
  maintenanceTitle: "Under Scheduled Maintenance",
  maintenanceMessage:
    "We are performing routine server upgrades and catalog optimization to bring you faster delivery and improved services. We will be back online shortly!",
};

function AdminSettingsPage({ mode }: { mode: "settings" | "faqs" }) {
  const { ready, uid } = useAccount();
  const collection = mode === "faqs" ? "faqs" : "settings";
  const [form, setForm] = useState<AdminFormState>(createFormState(DEFAULT_SETTINGS));
  const [faqItems, setFaqItems] = useState(DEFAULT_FAQS.items);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "faqs") {
        const { items } = await fetchApiFaqs();
        setFaqItems(
          Array.isArray(items)
            ? items.filter(
                (item): item is { question: string; answer: string } =>
                  !!item &&
                  typeof item === "object" &&
                  "question" in item &&
                  typeof item["question"] === "string" &&
                  "answer" in item &&
                  typeof item["answer"] === "string",
              )
            : [],
        );
        return;
      }

      const { settings } = await fetchApiCatalog();
      setForm(createFormState({ ...DEFAULT_SETTINGS, ...(settings ?? {}) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [mode, ready, uid]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const record =
      mode === "faqs"
        ? { items: faqItems }
        : {
            storeName: formText(form, "storeName"),
            tagline: formText(form, "tagline"),
            supportEmail: formText(form, "supportEmail"),
            supportWhatsapp: formText(form, "supportWhatsapp"),
            paymentEzcashNumber: formText(form, "paymentEzcashNumber"),
            paymentEzcashName: formText(form, "paymentEzcashName"),
            currency: "LKR",
            bannerEnabled: formBoolean(form, "bannerEnabled"),
            maintenanceMode: formBoolean(form, "maintenanceMode"),
            maintenanceTitle: formText(form, "maintenanceTitle"),
            maintenanceMessage: formText(form, "maintenanceMessage"),
          };
    setError(null);
    setSaving(true);
    try {
      if (mode === "faqs") {
        await saveAdminFaqs(faqItems);
      } else {
        await saveAdminSettings(record as Record<string, unknown>);
      }
      toast.success(mode === "faqs" ? "FAQs saved." : "Store settings saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function updateSetting(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateFaq(index: number, key: "question" | "answer", value: string) {
    setFaqItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  }

  return (
    <AdminShell
      title={mode === "faqs" ? "Support FAQs" : "Store settings"}
      description={
        mode === "faqs"
          ? "Manage public FAQ content stored in Firestore."
          : "Manage the public store configuration document."
      }
    >
      {error && (
        <p className="admin-error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading…</p>
      ) : (
        <section className="admin-panel admin-settings-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-panel-eyebrow">
                {mode === "faqs" ? "PUBLIC SUPPORT CONTENT" : "STOREFRONT CONFIGURATION"}
              </span>
              <h2>{mode === "faqs" ? "FAQ document" : "Store profile"}</h2>
            </div>
            <span className="admin-settings-doc">
              <Database size={14} /> settings/{mode === "faqs" ? "faqs" : "store"}
            </span>
          </div>
          <p className="admin-helper-copy">
            Changes are validated and written through the protected admin service.
          </p>
          {mode === "settings" ? (
            <>
              <div className="admin-form-section">
                <h3>Manual payment details</h3>
                <p className="admin-helper-copy">
                  Default eZ Cash account shown at checkout. Customers upload a receipt for
                  administrator review when the method requires one.
                </p>
                <div className="admin-form-grid">
                  <FormField label="eZ Cash mobile number">
                    <input
                      className="admin-form-input"
                      value={formText(form, "paymentEzcashNumber")}
                      onChange={(event) => updateSetting("paymentEzcashNumber", event.target.value)}
                      placeholder="0741635465"
                    />
                  </FormField>
                  <FormField label="eZ Cash account name">
                    <input
                      className="admin-form-input"
                      value={formText(form, "paymentEzcashName")}
                      onChange={(event) => updateSetting("paymentEzcashName", event.target.value)}
                      placeholder="Nexaura Topup"
                    />
                  </FormField>
                </div>
              </div>
              <div className="admin-form-section">
                <h3>Store identity</h3>
                <div className="admin-form-grid">
                  <FormField label="Store name" hint="Shown in the storefront header.">
                    <input
                      className="admin-form-input"
                      value={formText(form, "storeName")}
                      onChange={(event) => updateSetting("storeName", event.target.value)}
                      placeholder="e.g. HASA GOLD STORE"
                    />
                  </FormField>
                  <FormField label="Tagline">
                    <input
                      className="admin-form-input"
                      value={formText(form, "tagline")}
                      onChange={(event) => updateSetting("tagline", event.target.value)}
                      placeholder="e.g. Fast and trusted game top-ups"
                    />
                  </FormField>
                  <FormField label="Support email">
                    <input
                      className="admin-form-input"
                      type="email"
                      value={formText(form, "supportEmail")}
                      onChange={(event) => updateSetting("supportEmail", event.target.value)}
                      placeholder="e.g. help@example.com"
                    />
                  </FormField>
                  <FormField label="WhatsApp contact">
                    <input
                      className="admin-form-input"
                      value={formText(form, "supportWhatsapp")}
                      onChange={(event) => updateSetting("supportWhatsapp", event.target.value)}
                      placeholder="e.g. +94 77 123 4567"
                    />
                  </FormField>
                </div>
              </div>
              <div className="admin-toggle-grid admin-settings-toggles">
                <label className="admin-toggle-row">
                  <input
                    type="checkbox"
                    checked={formBoolean(form, "bannerEnabled")}
                    onChange={(event) => updateSetting("bannerEnabled", event.target.checked)}
                  />
                  <span className="admin-toggle-copy">
                    <strong>Show store banner</strong>
                    <small>Display the announcement/banner area on the storefront.</small>
                  </span>
                </label>
                <label className="admin-toggle-row is-warning">
                  <input
                    type="checkbox"
                    checked={formBoolean(form, "maintenanceMode")}
                    onChange={(event) => updateSetting("maintenanceMode", event.target.checked)}
                  />
                  <span className="admin-toggle-copy">
                    <strong>Maintenance mode</strong>
                    <small>
                      Replaces the public storefront with the high-tech maintenance screen.
                    </small>
                  </span>
                </label>
              </div>

              {formBoolean(form, "maintenanceMode") && (
                <div className="admin-form-section" style={{ borderLeft: "3px solid #f59e0b" }}>
                  <h3>Maintenance screen details</h3>
                  <p className="admin-helper-copy">
                    Customize the message visitors see when maintenance mode is active.
                  </p>
                  <div className="admin-form-grid">
                    <FormField label="Headline / Title">
                      <input
                        className="admin-form-input"
                        value={formText(form, "maintenanceTitle")}
                        onChange={(event) => updateSetting("maintenanceTitle", event.target.value)}
                        placeholder="e.g. Under Scheduled Maintenance"
                      />
                    </FormField>
                    <div className="admin-form-span">
                      <FormField label="Announcement Message">
                        <textarea
                          className="admin-form-textarea"
                          rows={3}
                          value={formText(form, "maintenanceMessage")}
                          onChange={(event) =>
                            updateSetting("maintenanceMessage", event.target.value)
                          }
                          placeholder="e.g. We are performing server upgrades to bring you faster delivery and improved services. We will be back online shortly!"
                        />
                      </FormField>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="admin-faq-editor">
              {faqItems.map((item, index) => (
                <article className="admin-faq-item" key={index}>
                  <div className="admin-faq-item-heading">
                    <strong>Question {index + 1}</strong>
                    <button
                      type="button"
                      className="admin-faq-remove"
                      onClick={() =>
                        setFaqItems((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      aria-label={`Remove question ${index + 1}`}
                    >
                      <Trash2 size={15} /> Remove
                    </button>
                  </div>
                  <FormField label="Question">
                    <input
                      className="admin-form-input"
                      value={item.question}
                      onChange={(event) => updateFaq(index, "question", event.target.value)}
                      placeholder="e.g. How long does a top-up take?"
                    />
                  </FormField>
                  <FormField label="Answer">
                    <textarea
                      className="admin-form-input admin-form-textarea"
                      rows={3}
                      value={item.answer}
                      onChange={(event) => updateFaq(index, "answer", event.target.value)}
                      placeholder="Write a clear answer customers can understand."
                    />
                  </FormField>
                </article>
              ))}
              <Button
                className="admin-quiet-button"
                variant="outline"
                onClick={() => setFaqItems((current) => [...current, { question: "", answer: "" }])}
                disabled={faqItems.length >= 100}
              >
                <Plus size={15} /> Add FAQ
              </Button>
            </div>
          )}
          <div className="admin-editor-actions">
            <Button className="admin-primary-button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              className="admin-quiet-button"
              variant="outline"
              onClick={() => void load()}
              disabled={saving}
            >
              <RefreshCw size={14} /> Reload document
            </Button>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
