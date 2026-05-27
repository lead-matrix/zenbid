/**
 * useAppStore.ts — Global Zustand store.
 *
 * ARCHITECTURE NOTE:
 * Auth state (session, user, profile) is now owned by AuthProvider.
 * Organization state is owned by OrganizationProvider.
 * This store retains:
 *   - UI state (theme, sidebar, notifications)
 *   - Legacy profile access for components not yet migrated to useAuth()
 *   - Backward-compatible impersonation bridge (delegates to OrganizationProvider)
 *
 * MIGRATION PATH:
 * Components should gradually move from:
 *   useAppStore(s => s.profile)  → useAuth().profile
 *   useAppStore(s => s.activeUserId()) → useOrganization().activeUserId
 *
 * The getters below remain functional during migration.
 */

import { create } from 'zustand';
import type { Profile } from '../types';
import { supabase } from '../api/supabase';

interface AppState {
  // ── Profile (kept for backward compat — prefer useAuth().profile) ──
  profile: Profile | null;
  loading: boolean;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;

  // ── Legacy impersonation bridge ────────────────────────────────
  // NOTE: New code should use OrganizationProvider.startImpersonation()
  // These remain for backward compat with AdminPortal and useProjects
  impersonatedProfile: Profile | null;
  startImpersonation: (target: Profile) => void;
  stopImpersonation: () => void;
  activeProfile: () => Profile | null;
  activeUserId: () => string | null;

  // ── UI state ────────────────────────────────────────────────────
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  profile: null,
  loading: false,
  impersonatedProfile: null,
  sidebarCollapsed: false,

  setProfile: (profile) => set({ profile }),

  fetchProfile: async () => {
    if (get().profile || get().loading) return; // Skip if already loaded or in progress

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      set({ loading: true });
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[useAppStore] fetchProfile error:', error.message);
        return;
      }
      if (data) {
        set({ profile: data as Profile });
      }
    } catch (err) {
      console.error('[useAppStore] fetchProfile unexpected error:', err);
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('[useAppStore] updateProfile error:', error.message);
        return;
      }
      if (data) {
        set({ profile: data as Profile });
      }
    } catch (err) {
      console.error('[useAppStore] updateProfile unexpected error:', err);
    }
  },

  // ── Impersonation ──────────────────────────────────────────────
  startImpersonation: (target: Profile) => {
    // Immediately clear projects/data before setting new user
    set({ impersonatedProfile: target });
  },

  stopImpersonation: () => {
    // Clear impersonation state atomically
    set({ impersonatedProfile: null });
  },

  activeProfile: () => {
    const { impersonatedProfile, profile } = get();
    return impersonatedProfile ?? profile;
  },

  activeUserId: () => {
    const { impersonatedProfile, profile } = get();
    return (impersonatedProfile ?? profile)?.id ?? null;
  },

  // ── UI ─────────────────────────────────────────────────────────
  toggleSidebar: () => {
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
}));
