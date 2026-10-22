import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAccount } from "@/components/account-context";

const StoreContext = createContext<{ favorites: string[]; toggleFavorite: (id: string) => void }>({
  favorites: [],
  toggleFavorite: () => {},
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, update } = useAccount();
  const [guestFavorites, setGuestFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (user) setGuestFavorites([]);
  }, [user]);

  const toggleFavorite = useCallback(
    (id: string) => {
      const favorites = user?.favorites ?? guestFavorites;
      const next = favorites.includes(id)
        ? favorites.filter((item) => item !== id)
        : [...favorites, id];
      if (!user) {
        setGuestFavorites(next);
        return;
      }
      void update({ favorites: next }).catch((error: unknown) => {
        console.error("Could not save favorite:", error);
        toast.error("Could not save this favorite to your account.");
      });
    },
    [guestFavorites, update, user],
  );

  const favorites = user?.favorites ?? guestFavorites;
  return (
    <StoreContext.Provider value={{ favorites, toggleFavorite }}>{children}</StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
