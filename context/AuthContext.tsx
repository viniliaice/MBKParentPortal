import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, type SupabaseProfile } from '@/lib/supabase';

interface User {
  id: string;
  name: string;
  email: string;
  profileId: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_KEY = '@mbk_auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY).then(val => {
      if (val) setUser(JSON.parse(val));
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          return 'Incorrect email or password.';
        }
        return authError.message;
      }

      const authUserId = authData.user?.id;
      if (!authUserId) {
        return 'Authentication failed. Please try again.';
      }

      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', authUserId)
        .single();

      if (profileError || !profile) {
        const { data: fallbackProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email.trim().toLowerCase())
          .single();

        if (!fallbackProfile) {
          await supabase.auth.signOut();
          return 'Parent account not found. Contact support.';
        }

        await supabase
          .from('profiles')
          .update({ auth_id: authUserId })
          .eq('id', fallbackProfile.id);

        profile = fallbackProfile as SupabaseProfile;
      }

      const appUser: User = {
        id: (profile as SupabaseProfile).id,
        name: (profile as SupabaseProfile).name,
        email: (profile as SupabaseProfile).email,
        profileId: (profile as SupabaseProfile).id,
      };

      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(appUser));
      setUser(appUser);
      return null;
    } catch {
      return 'Something went wrong. Please try again.';
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
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