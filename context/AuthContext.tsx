import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, type SupabaseLinkedProfile } from '@/lib/supabase';
import { DEMO_PARENT_ID, DEMO_PARENT_NAME, isDemoMode } from '@/lib/demoMode';

interface User {
  id: string;
  name: string;
  email: string;
  profileId: string;
  /**
   * Always 'parent' in this app. The database also holds teacher, supervisor,
   * office and admin accounts, but they belong to the school's own systems: this
   * portal is a parents-only client (see docs/schema.md), and login below refuses
   * any other role.
   */
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_KEY = '@mbk_auth_user';

/**
 * A connection that never reached the server is not the parent's mistake, and the
 * raw browser message ("Failed to fetch", "Network request failed") is not something
 * a parent can act on. Everything network-shaped maps to one line of plain English.
 */
const OFFLINE_MESSAGE = 'Can’t reach the school server. Check your connection and try again.';

/**
 * The message a transport failure carries depends on the platform — "Failed to
 * fetch" in a browser, "Network request failed" on a device. supabase-js's own
 * signal is the reliable one: a failed request is an `AuthRetryableFetchError`
 * with status 0 (see @supabase/auth-js lib/fetch). The message patterns stay as a
 * fallback for errors that arrive wrapped or re-thrown.
 */
const NETWORK_MESSAGE = /failed to fetch|network request failed|networkerror|load failed|fetch failed|timed? ?out|offline/i;

function isNetworkFailure(error: unknown): boolean {
  if (typeof error === 'string') return NETWORK_MESSAGE.test(error);
  if (error && typeof error === 'object') {
    const e = error as { name?: string; status?: number; message?: string };
    if (e.name === 'AuthRetryableFetchError') return true;
    if (e.status === 0) return true;
    if (typeof e.message === 'string') return NETWORK_MESSAGE.test(e.message);
  }
  return false;
}

/**
 * Sign-in is real Supabase Auth. The returned profile comes from the
 * `link_profile()` security-definer RPC, which is the only way the client can
 * read its own row (the profiles table has no anonymous access at all — see
 * docs/security-model.md). The cached copy in AsyncStorage is for rendering
 * before the network answers; nothing security sensitive relies on it.
 *
 * The portal is for parents only. A staff account that signs in here is signed
 * straight back out: teachers, supervisors, the office and administrators use
 * the school's own systems, and the parent app must not become a second, weaker
 * door into staff data. The database enforces the same thing independently.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY)
      .then(val => {
        if (val) setUser(JSON.parse(val));
      })
      .catch(() => {
        // A corrupt cache must never block the app; the session is re-checked on login.
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    const normalisedEmail = email.trim().toLowerCase();

    // Development builds only (see lib/demoMode.ts). Nothing is sent anywhere: the
    // demo account exists so the signed-in screens can be reviewed offline.
    if (isDemoMode()) {
      const demoUser: User = {
        id: DEMO_PARENT_ID,
        name: DEMO_PARENT_NAME,
        email: normalisedEmail || 'demo@mbk.school',
        profileId: DEMO_PARENT_ID,
        role: 'parent',
      };
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(demoUser));
      setUser(demoUser);
      return null;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalisedEmail,
        password,
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          return 'Incorrect email or password.';
        }
        if (isNetworkFailure(authError)) {
          return OFFLINE_MESSAGE;
        }
        return authError.message;
      }

      if (!authData.user) {
        return 'Authentication failed. Please try again.';
      }

      const { data: profiles, error: profileError } = await supabase.rpc('link_profile');

      if (profileError) {
        await supabase.auth.signOut();
        return 'Could not load your account. Please try again.';
      }

      const profile = (profiles as SupabaseLinkedProfile[] | null)?.[0];
      if (!profile) {
        await supabase.auth.signOut();
        return 'No school account is linked to this email. Contact the school office.';
      }

      if (profile.role !== 'parent') {
        await supabase.auth.signOut();
        return 'This app is for parent accounts. School staff sign in to the school system instead.';
      }

      const appUser: User = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        profileId: profile.id,
        role: profile.role,
      };

      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(appUser));
      setUser(appUser);
      return null;
    } catch (err) {
      return isNetworkFailure(err) ? OFFLINE_MESSAGE : 'Something went wrong. Please try again.';
    }
  };

  const logout = async () => {
    if (!isDemoMode()) {
      try {
        // Stop push notifications for the signed-out account. Best effort: a
        // failure here must not keep the user signed in.
        await supabase.rpc('clear_push_token');
      } catch {
        // ignored on purpose
      }
      await supabase.auth.signOut();
    }
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
