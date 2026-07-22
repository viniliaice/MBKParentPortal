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

  const login = async (email: string, _password: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (error || !data) {
        return 'Parent account not found with this email.';
      }

      const profile = data as SupabaseProfile;
      const appUser: User = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        profileId: profile.id,
      };

      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(appUser));
      setUser(appUser);
      return null;
    } catch {
      return 'Something went wrong. Please try again.';
    }
  };

  const logout = async () => {
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
