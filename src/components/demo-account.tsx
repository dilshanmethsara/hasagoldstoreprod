import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';

const profileSchema = z.object({ email: z.string().email().max(254), name: z.string().min(1).max(80), players: z.record(z.string().max(64)), recent: z.array(z.string()).max(4), notifications: z.object({ updates: z.boolean(), reminders: z.boolean() }) });
export type DemoProfile = z.infer<typeof profileSchema>;
export type ThemeChoice = 'light' | 'dark' | 'system';
const key = 'hasa-demo-profiles-v1';
type Account = { ready: boolean; user: DemoProfile | null; profiles: DemoProfile[]; adminUpdateProfile: (email: string, values: Partial<DemoProfile>) => boolean; theme: ThemeChoice; resolvedTheme: 'light' | 'dark'; setTheme: (theme: ThemeChoice) => void; signup: (name: string, email: string) => void; login: (email: string, remember: boolean) => boolean; logout: () => void; update: (values: Partial<DemoProfile>) => boolean; viewGame: (id: string) => void };
const Context = createContext<Account | null>(null);
export function DemoAccountProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<DemoProfile[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [theme, chooseTheme] = useState<ThemeChoice>('system');
  const [resolvedTheme, setResolved] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    try {
      const parsed = z.array(profileSchema).max(50).safeParse(JSON.parse(localStorage.getItem(key) || '[]'));
      if (parsed.success) setProfiles(parsed.data);
      setEmail(sessionStorage.getItem('hasa-session') || localStorage.getItem('hasa-remember'));
      const saved = localStorage.getItem('hasa-theme');
      if (saved === 'light' || saved === 'dark') chooseTheme(saved);
    } catch { toast.error('Device storage is unavailable. Changes will last for this visit only.'); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function apply() { const next = theme === 'system' ? media.matches ? 'dark' : 'light' : theme; document.documentElement.classList.toggle('dark', next === 'dark'); document.documentElement.style.colorScheme = next; setResolved(next); }
    apply(); media.addEventListener('change', apply);
    try { localStorage.setItem('hasa-theme', theme); } catch { /* Session-only fallback. */ }
    return () => media.removeEventListener('change', apply);
  }, [theme, ready]);
  function save(next: DemoProfile[]) { setProfiles(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { toast.error('Could not save on this device. Your changes remain available this visit.'); } }
  function session(value: string | null, remember = false) { setEmail(value); try { if (value) sessionStorage.setItem('hasa-session', value); else sessionStorage.removeItem('hasa-session'); if (remember && value) localStorage.setItem('hasa-remember', value); else localStorage.removeItem('hasa-remember'); } catch { /* In-memory session still works. */ } }
  const user = profiles.find(profile => profile.email === email) || null;
  function adminUpdateProfile(target: string, values: Partial<DemoProfile>) {
    const profile = profiles.find(item => item.email === target);
    if (!profile) return false;
    const result = profileSchema.safeParse({ ...profile, ...values, email: target });
    if (!result.success) return false;
    save(profiles.map(item => item.email === target ? result.data : item));
    return true;
  }
  function update(values: Partial<DemoProfile>) {
    if (!user) return false;
    const result = profileSchema.safeParse({ ...user, ...values });
    if (!result.success || profiles.some(profile => profile.email !== user.email && profile.email === result.data.email)) return false;
    save(profiles.map(profile => profile.email === user.email ? result.data : profile));
    if (result.data.email !== user.email) { let remembered = false; try { remembered = Boolean(localStorage.getItem('hasa-remember')); } catch { /* No storage. */ } session(result.data.email, remembered); }
    return true;
  }
  return <Context.Provider value={{ ready, user, profiles, adminUpdateProfile, theme, resolvedTheme, setTheme: chooseTheme, signup: (name, value) => { const normalized = value.trim().toLowerCase(); if (profiles.some(profile => profile.email === normalized)) throw new Error('A demo profile with this email already exists. Log in instead.'); const result = profileSchema.parse({ name: name.trim(), email: normalized, players: {}, recent: [], notifications: { updates: false, reminders: false } }); save([...profiles, result]); session(normalized); }, login: (value, remember) => { const normalized = value.trim().toLowerCase(); if (!profiles.some(profile => profile.email === normalized)) return false; session(normalized, remember); return true; }, logout: () => session(null), update, viewGame: id => { if (user && user.recent[0] !== id) update({ recent: [id, ...user.recent.filter(item => item !== id)].slice(0,4) }); } }}>{children}</Context.Provider>;
}
export function useDemoAccount() { const account = useContext(Context); if (!account) throw new Error('Demo account provider is missing'); return account; }