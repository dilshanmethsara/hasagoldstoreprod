import { useQuery } from "@tanstack/react-query";
import { getFirebaseAuth } from "@/lib/firebase";
import { checkAdminSession } from "@/api/admin";

/**
 * Is the signed-in Firebase account an administrator?
 *
 * The answer is resolved server-side from `ADMIN_UIDS` (the client never sees
 * the list), and cached per UID. `src/routes/__root.tsx` uses it to keep
 * administrator accounts inside the admin panel instead of the storefront.
 */
export function useAdminSession(uid: string | null | undefined) {
  return useQuery({
    queryKey: ["adminSession", uid ?? null, getFirebaseAuth().currentUser?.uid ?? null],
    queryFn: async () => {
      const user = getFirebaseAuth().currentUser;
      if (!user) return { isAdmin: false };
      try {
        return await checkAdminSession({ data: { idToken: await user.getIdToken() } });
      } catch {
        // A stale token, an unverified address, or an API hiccup must never
        // look like admin access — treat failures as "not an administrator".
        return { isAdmin: false };
      }
    },
    enabled: Boolean(uid),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    placeholderData: undefined,
  });
}
