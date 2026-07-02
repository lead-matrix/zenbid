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
  // ── UI state ────────────────────────────────────────────────────
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,

  // ── UI ─────────────────────────────────────────────────────────
  toggleSidebar: () => {
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
}));
