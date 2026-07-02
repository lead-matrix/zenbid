/**
 * AuthProvider.tsx
 * ─────────────────────────────────────────────────────────────────
 * SINGLE source of truth for authentication state across the app.
 *
 * Replaces the dual onAuthStateChange() subscriptions that existed
 * in SmartRoot and ProtectedRoute — those caused memory leaks and
 * double renders. This provider mounts ONCE at the app root and
 * all components consume it via useAuth().
 *
 * What it provides:
 *   - session: Supabase Session | null
 *   - user: Supabase User | null
 *   - profile: Profile | null (fetched after auth)
 *   - loading: boolean (true during initial auth resolution)
 *   - signOut: () => Promise<void>
 *   - refreshProfile: () => Promise<void>
 * ─────────────────────────────────────────────────────────────────
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import type { Profile } from '../types';

// ─── Context shape ─────────────────────────────────────────────────

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard against setting state after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Profile fetcher ─────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthProvider] Profile fetch error:', error.message);
        return;
      }
      if (mountedRef.current) {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error('[AuthProvider] Unexpected profile error:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUser = user;
    if (!currentUser) return;
    await fetchProfile(currentUser.id);
  }, [user, fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    try {
      const currentUser = user;
      if (!currentUser) return;

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) {
        console.error('[AuthProvider] updateProfile error:', error.message);
        return;
      }
      if (data && mountedRef.current) {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error('[AuthProvider] updateProfile unexpected error:', err);
    }
  }, [user]);

  // ── Single auth listener — mounted once ────────────────────────
  useEffect(() => {
    let initialized = false;

    // Get existing session immediately (avoids flicker)
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!mountedRef.current) return;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        fetchProfile(existingSession.user.id).finally(() => {
          if (mountedRef.current) setLoading(false);
        });
      } else {
        setLoading(false);
      }
      initialized = true;
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mountedRef.current) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }

        // Only flip loading after initialization is done
        if (initialized && mountedRef.current) {
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Sign out ────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>. Wrap your app in <AuthProvider>.');
  }
  return ctx;
}
