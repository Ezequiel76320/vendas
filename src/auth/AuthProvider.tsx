import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { LocalSession, LocalUser } from "@/lib/localApi";
import { localApi } from "@/lib/localApi";

const AuthContext = createContext<{ session: LocalSession | null; user: LocalUser | null; loading: boolean; signOut: () => Promise<void> }>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<LocalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localApi.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = localApi.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => { data.subscription.unsubscribe(); };
  }, []);

  const value = useMemo(() => ({ session, user: session?.user ?? null, loading, signOut: async () => { await localApi.auth.signOut(); } }), [session, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
