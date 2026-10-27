'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from Supabase profiles table
  const fetchProfile = useCallback(async (userId, fallbackEmail = '') => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data);
        return data;
      }

      // If profile doesn't exist yet, insert profile record
      if (error && error.code === 'PGRST116') {
        const newProfile = {
          id: userId,
          email: fallbackEmail,
          full_name: fallbackEmail.split('@')[0] || 'User',
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${userId}`,
        };
        const { data: created } = await supabase.from('profiles').insert([newProfile]).select().single();
        if (created) setProfile(created);
        return created;
      }
    } catch (err) {
      console.warn('Profile fetch note:', err);
    }
    return null;
  }, []);

  useEffect(() => {
    // 1. Check current session on load
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id, session.user.email);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.warn('Auth session check note:', err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    // 2. Subscribe to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = async (redirectPath = '/') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}${redirectPath}`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    if (res.data.user) {
      setUser(res.data.user);
      await fetchProfile(res.data.user.id, res.data.user.email);
    }
    return res.data;
  };

  const signUp = async (email, password, fullName, upiId = '', phone = '') => {
    // Provide dynamic redirect URL to current origin (Vercel / live domain / localhost)
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}` : undefined;

    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          upi_id: upiId,
          phone: phone,
        },
      },
    });

    if (res.error) throw res.error;

    // If session is returned immediately (email confirmation disabled), set active user
    if (res.data?.session && res.data?.user) {
      const profileData = {
        id: res.data.user.id,
        email,
        full_name: fullName,
        upi_id: upiId || null,
        phone: phone || null,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`,
      };
      try {
        await supabase.from('profiles').upsert([profileData]);
      } catch (err) {
        console.warn('Profile upsert note:', err);
      }
      setUser(res.data.user);
      setProfile(profileData);
    }
    return res.data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        refreshProfile: () => fetchProfile(user?.id, user?.email),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
