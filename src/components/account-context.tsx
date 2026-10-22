import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import { toast } from "sonner";
import type { FirebaseError } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reload,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
  EmailAuthProvider,
  type AuthCredential,
  type User as FirebaseUser,
} from "firebase/auth";
import { FirebaseSetupError, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { ensureUserDoc, fetchUserDoc, updateUserDoc } from "@/lib/firestore";
import { ensureMemberId } from "@/api/memberId";
import { sendVerificationEmail } from "@/api/sendVerificationEmail";
import type { ThemeChoice, UserDoc } from "@/lib/firestore-schema";

export type { ThemeChoice } from "@/lib/firestore-schema";

const profileSchema = z.object({
  email: z.string().email().max(254),
  emailVerified: z.boolean(),
  name: z.string().min(1).max(80),
  phoneNumber: z.string().max(32).optional(),
  profileComplete: z.boolean(),
  memberId: z
    .string()
    .regex(/^HG-[A-HJ-NP-Z2-9]{8}$/)
    .optional(),
  players: z.record(z.string().max(64)),
  recent: z.array(z.string()).max(4),
  favorites: z.array(z.string()).max(100),
  notifications: z.object({ updates: z.boolean(), reminders: z.boolean() }),
});
export type AccountProfile = z.infer<typeof profileSchema>;

type Account = {
  ready: boolean;
  profileCompletionInProgress: boolean;
  uid: string | null;
  user: AccountProfile | null;
  /** Firebase provider IDs attached to the signed-in account, e.g. "password", "google.com". */
  linkedProviders: string[];
  /** Profile picture from the linked Google account, when available. */
  photoUrl: string | null;
  theme: ThemeChoice;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeChoice) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  loginWithGoogle: (remember: boolean) => Promise<void>;
  /** Links Google to the signed-in account. Resolves false when the popup is dismissed. */
  linkGoogle: () => Promise<boolean>;
  googleLinkEmail: string | null;
  linkGoogleWithPassword: (password: string, remember: boolean) => Promise<void>;
  completeProfile: (name: string, phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  update: (values: Partial<AccountProfile>) => Promise<void>;
  viewGame: (id: string) => Promise<void>;
};

const Context = createContext<Account | null>(null);

function usernameFromEmail(email: string): string {
  return email.split("@")[0] || "Player";
}

/** Prefers the linked Google profile photo, falling back to the account photo. */
function accountPhotoUrl(firebaseUser: FirebaseUser): string | null {
  const googleProvider = firebaseUser.providerData.find(
    (provider) => provider.providerId === "google.com",
  );
  return googleProvider?.photoURL ?? firebaseUser.photoURL ?? null;
}

function profileFromAccount(
  firebaseUser: FirebaseUser,
  data: Partial<UserDoc> = {},
): AccountProfile {
  const email = (firebaseUser.email || "").trim().toLowerCase();
  return profileSchema.parse({
    email,
    emailVerified: firebaseUser.emailVerified,
    name: (data.displayName || firebaseUser.displayName || "").trim() || usernameFromEmail(email),
    ...(typeof data.phoneNumber === "string" ? { phoneNumber: data.phoneNumber } : {}),
    profileComplete: data.profileComplete !== false,
    ...(data.memberId ? { memberId: data.memberId } : {}),
    players: data.savedPlayerIds ?? {},
    recent: data.recentViewedGames ?? [],
    favorites: data.favorites ?? [],
    notifications: data.notificationPrefs ?? { updates: false, reminders: false },
  });
}

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured) throw new FirebaseSetupError();
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AccountProfile | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [theme, chooseTheme] = useState<ThemeChoice>("system");
  const [resolvedTheme, setResolved] = useState<"light" | "dark">("light");
  const [profileCompletionInProgress, setProfileCompletionInProgress] = useState(false);
  const uidRef = useRef<string | null>(null);
  const authGeneration = useRef(0);
  const appliedTheme = useRef<"light" | "dark" | null>(null);
  const pendingGoogleCredential = useRef<AuthCredential | null>(null);
  const [googleLinkEmail, setGoogleLinkEmail] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !isFirebaseConfigured) {
      setReady(true);
      return;
    }

    let unsubscribe = () => {};
    try {
      unsubscribe = onIdTokenChanged(
        getFirebaseAuth(),
        async (firebaseUser) => {
          const generation = ++authGeneration.current;
          if (!firebaseUser) {
            uidRef.current = null;
            setUid(null);
            setUser(null);
            setLinkedProviders([]);
            setPhotoUrl(null);
            pendingGoogleCredential.current = null;
            setGoogleLinkEmail(null);
            chooseTheme("system");
            setReady(true);
            return;
          }

          if (!firebaseUser.emailVerified) {
            uidRef.current = null;
            setUid(null);
            setUser(null);
            setLinkedProviders([]);
            setPhotoUrl(null);
            pendingGoogleCredential.current = null;
            setGoogleLinkEmail(null);
            chooseTheme("system");
            setReady(true);
            return;
          }

          if (uidRef.current === firebaseUser.uid) return;

          uidRef.current = firebaseUser.uid;
          setUid(firebaseUser.uid);
          setLinkedProviders(firebaseUser.providerData.map((provider) => provider.providerId));
          setPhotoUrl(accountPhotoUrl(firebaseUser));
          setReady(false);
          setUser(null);
          let memberIdAssignmentFailed = false;
          try {
            const existingUserDoc = await fetchUserDoc(firebaseUser.uid);
            await ensureUserDoc({
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? "",
              displayName: firebaseUser.displayName ?? usernameFromEmail(firebaseUser.email ?? ""),
              profileComplete:
                existingUserDoc?.profileComplete ??
                !firebaseUser.providerData.some((provider) => provider.providerId === "google.com"),
            });
            let userDoc = await fetchUserDoc(firebaseUser.uid);
            if (!userDoc) throw new Error("Your account profile could not be loaded.");
            if (!userDoc.memberId) {
              memberIdAssignmentFailed = true;
              await ensureMemberId({ data: { idToken: await firebaseUser.getIdToken() } });
              userDoc = await fetchUserDoc(firebaseUser.uid);
              if (!userDoc?.memberId) throw new Error("Your customer ID could not be assigned.");
            }
            if (generation !== authGeneration.current) return;
            setUser(profileFromAccount(firebaseUser, userDoc));
            chooseTheme(userDoc.theme ?? "system");
          } catch (error) {
            console.error("Could not load the Firestore account profile:", error);
            if (generation === authGeneration.current) {
              setUser(
                profileFromAccount(firebaseUser, {
                  profileComplete: !firebaseUser.providerData.some(
                    (provider) => provider.providerId === "google.com",
                  ),
                }),
              );
              toast.error(
                memberIdAssignmentFailed
                  ? "Could not load your customer ID. Please refresh and try again."
                  : "Could not load your saved account preferences. Please try again.",
              );
            }
          } finally {
            if (generation === authGeneration.current) setReady(true);
          }
        },
        (error) => {
          console.error("Firebase auth listener error:", error);
          setUid(null);
          uidRef.current = null;
          setUser(null);
          setReady(true);
          toast.error("Could not verify your sign-in. Refresh the page and try again.");
        },
      );
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      setReady(true);
      toast.error(error instanceof Error ? error.message : "Firebase could not be initialized.");
    }
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready || !uid || !user || user.memberId) return;
    const firebaseUser = getFirebaseAuth().currentUser;
    if (!firebaseUser || firebaseUser.uid !== uid) return;

    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const assignMemberId = async () => {
      attempt += 1;
      try {
        await ensureMemberId({ data: { idToken: await firebaseUser.getIdToken() } });
        const userDoc = await fetchUserDoc(uid);
        if (!userDoc?.memberId) throw new Error("Your customer ID could not be loaded.");
        if (active) setUser(profileFromAccount(firebaseUser, userDoc));
      } catch (error) {
        console.error("Could not assign the customer ID:", error);
        if (active && attempt < 5) {
          timeout = setTimeout(() => void assignMemberId(), 1000 * 2 ** (attempt - 1));
        } else if (active) {
          toast.error("Your customer ID could not be assigned. Refresh the page to retry.");
        }
      }
    };
    timeout = setTimeout(() => void assignMemberId(), 0);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [ready, uid, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let transitionTimeout: number | undefined;
    const apply = () => {
      const next = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      const root = document.documentElement;
      if (transitionTimeout !== undefined) window.clearTimeout(transitionTimeout);
      root.classList.remove("theme-transitioning");
      if (appliedTheme.current !== null && appliedTheme.current !== next) {
        root.classList.add("theme-transitioning");
        transitionTimeout = window.setTimeout(() => {
          root.classList.remove("theme-transitioning");
        }, 250);
      } else {
        transitionTimeout = undefined;
      }
      root.classList.toggle("dark", next === "dark");
      root.style.colorScheme = next;
      appliedTheme.current = next;
      setResolved(next);
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      if (transitionTimeout !== undefined) window.clearTimeout(transitionTimeout);
      document.documentElement.classList.remove("theme-transitioning");
    };
  }, [theme]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    assertFirebaseConfigured();
    const auth = getFirebaseAuth();
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    try {
      if (trimmedName) await updateProfile(credential.user, { displayName: trimmedName });
      await sendVerificationEmail({
        data: {
          idToken: await credential.user.getIdToken(),
          appOrigin: window.location.origin,
        },
      });
    } finally {
      if (auth.currentUser?.uid === credential.user.uid) await firebaseSignOut(auth);
    }
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    assertFirebaseConfigured();
    const auth = getFirebaseAuth();
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    await reload(credential.user);
    if (!credential.user.emailVerified) {
      try {
        await sendVerificationEmail({
          data: {
            idToken: await credential.user.getIdToken(),
            appOrigin: window.location.origin,
          },
        });
      } finally {
        if (auth.currentUser?.uid === credential.user.uid) await firebaseSignOut(auth);
      }
      throw Object.assign(
        new Error(
          "Verify your email address before signing in. We sent you a new verification link.",
        ),
        {
          code: "auth/email-not-verified",
        },
      );
    }
    await credential.user.getIdToken(true);
    await ensureUserDoc({
      uid: credential.user.uid,
      email: credential.user.email ?? "",
      displayName: credential.user.displayName ?? usernameFromEmail(credential.user.email ?? ""),
    });
  }, []);

  const loginWithGoogle = useCallback(async (remember: boolean) => {
    assertFirebaseConfigured();
    const auth = getFirebaseAuth();
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
      pendingGoogleCredential.current = null;
      setGoogleLinkEmail(null);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      const credential = GoogleAuthProvider.credentialFromError(error as FirebaseError);
      const email = (error as { customData?: { email?: string } } | null)?.customData?.email;
      if (code === "auth/account-exists-with-different-credential" && credential && email) {
        pendingGoogleCredential.current = credential;
        setGoogleLinkEmail(email.trim().toLowerCase());
        throw Object.assign(
          new Error(
            "This email already has a password account. Sign in with its password to link Google.",
          ),
          { code: "auth/google-link-required" },
        );
      }
      throw error;
    }
  }, []);

  const linkGoogle = useCallback(async () => {
    assertFirebaseConfigured();
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) throw new Error("Sign in to link your Google account.");
    if (currentUser.providerData.some((provider) => provider.providerId === "google.com")) {
      return true;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await linkWithPopup(currentUser, provider);
      setLinkedProviders(result.user.providerData.map((entry) => entry.providerId));
      setPhotoUrl(accountPhotoUrl(result.user));
      return true;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return false;
      }
      if (code === "auth/provider-already-linked") {
        setLinkedProviders(currentUser.providerData.map((entry) => entry.providerId));
        return true;
      }
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        throw Object.assign(
          new Error(
            "That Google account already belongs to another HASA account. Sign in with Google instead, or link a different Google account.",
          ),
          { code },
        );
      }
      if (code === "auth/requires-recent-login") {
        throw Object.assign(
          new Error("For security, log out and sign back in, then link Google."),
          { code },
        );
      }
      throw error;
    }
  }, []);

  const linkGoogleWithPassword = useCallback(
    async (password: string, remember: boolean) => {
      assertFirebaseConfigured();
      const email = googleLinkEmail;
      const pendingCredential = pendingGoogleCredential.current;
      if (!email || !pendingCredential) {
        throw new Error("Restart Google sign-in to securely link this account.");
      }
      const auth = getFirebaseAuth();
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await reload(credential.user);
      if (!credential.user.emailVerified) {
        await firebaseSignOut(auth);
        throw Object.assign(new Error("Verify your email before linking Google."), {
          code: "auth/email-not-verified",
        });
      }
      await linkWithCredential(credential.user, pendingCredential);
      pendingGoogleCredential.current = null;
      setGoogleLinkEmail(null);
      await ensureUserDoc({
        uid: credential.user.uid,
        email: credential.user.email ?? email,
        displayName: credential.user.displayName ?? usernameFromEmail(email),
      });
    },
    [googleLinkEmail],
  );

  const completeProfile = useCallback(
    async (name: string, phoneNumber: string) => {
      const currentUser = getFirebaseAuth().currentUser;
      const currentProfile = user;
      const trimmedName = name.trim();
      const normalizedPhone = phoneNumber.trim();
      if (!currentUser || !currentUser.emailVerified || !currentProfile) {
        throw new Error("Sign in with a verified account to complete your profile.");
      }
      if (trimmedName.length < 2 || trimmedName.length > 80) {
        throw new Error("Enter your full name (2–80 characters).");
      }
      if (!/^\+?[1-9]\d{7,14}$/.test(normalizedPhone.replace(/[\s()-]/g, ""))) {
        throw new Error("Enter a valid phone number with country code.");
      }
      setProfileCompletionInProgress(true);
      try {
        const { completeCustomerProfile } = await import("@/api/completeCustomerProfile");
        await updateProfile(currentUser, { displayName: trimmedName });
        await completeCustomerProfile({
          data: {
            idToken: await currentUser.getIdToken(),
            displayName: trimmedName,
            phoneNumber: normalizedPhone.replace(/[\s()-]/g, ""),
            acceptedTerms: true,
          },
        });
        setUser({
          ...currentProfile,
          name: trimmedName,
          phoneNumber: normalizedPhone.replace(/[\s()-]/g, ""),
          profileComplete: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        setProfileCompletionInProgress(false);
      }
    },
    [user],
  );

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured) {
      uidRef.current = null;
      setUid(null);
      setUser(null);
      return;
    }
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    assertFirebaseConfigured();
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim().toLowerCase());
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    assertFirebaseConfigured();
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser?.email) throw new Error("You must be signed in to change your password.");
    await reauthenticateWithCredential(
      currentUser,
      EmailAuthProvider.credential(currentUser.email, currentPassword),
    );
    await updatePassword(currentUser, newPassword);
  }, []);

  const update = useCallback(
    async (values: Partial<AccountProfile>) => {
      const currentUser = getFirebaseAuth().currentUser;
      const currentUid = uidRef.current;
      if (!user || !currentUid || !currentUser) throw new Error("Sign in to update your account.");
      const parsed = profileSchema.safeParse({ ...user, ...values, email: user.email });
      if (!parsed.success) throw new Error("The account details are not valid.");

      if (values.name && values.name.trim() !== user.name) {
        await updateProfile(currentUser, { displayName: values.name.trim() });
      }
      const next: Parameters<typeof updateUserDoc>[1] = {};
      if (values.name !== undefined) next.displayName = parsed.data.name;
      if (values.players !== undefined) next.savedPlayerIds = parsed.data.players;
      if (values.recent !== undefined) next.recentViewedGames = parsed.data.recent;
      if (values.favorites !== undefined) next.favorites = parsed.data.favorites;
      if (values.notifications !== undefined) next.notificationPrefs = parsed.data.notifications;
      await updateUserDoc(currentUid, next);
      setUser(parsed.data);
    },
    [user],
  );

  const setTheme = useCallback(async (nextTheme: ThemeChoice) => {
    const currentUid = uidRef.current;
    if (currentUid) await updateUserDoc(currentUid, { theme: nextTheme });
    chooseTheme(nextTheme);
  }, []);

  const viewGame = useCallback(
    async (id: string) => {
      if (!user || user.recent[0] === id) return;
      try {
        await update({ recent: [id, ...user.recent.filter((item) => item !== id)].slice(0, 4) });
      } catch (error) {
        console.error("Could not save recent game:", error);
        toast.error("Could not save this activity to your account.");
      }
    },
    [user, update],
  );

  return (
    <Context.Provider
      value={{
        ready,
        profileCompletionInProgress,
        uid,
        user,
        linkedProviders,
        photoUrl,
        theme,
        resolvedTheme,
        setTheme,
        signup,
        login,
        loginWithGoogle,
        linkGoogle,
        googleLinkEmail,
        linkGoogleWithPassword,
        completeProfile,
        logout,
        resetPassword,
        changePassword,
        update,
        viewGame,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAccount() {
  const account = useContext(Context);
  if (!account) throw new Error("Account provider is missing");
  return account;
}
