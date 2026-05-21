/**
 * permissionGuard.ts
 * ─────────────────────────────────────────────────────────────────
 * Centralized RBAC — the single permission enforcement layer.
 *
 * ROLE HIERARCHY (highest → lowest):
 *   super_admin → admin → sales_manager → estimator → technician → viewer
 *
 * Usage (React hook):
 *   const { can, role } = usePermissions();
 *   if (can('manage_feature_flags')) { ... }
 *
 * Usage (guard function, non-React):
 *   hasPermission(profile, 'edit_proposals')
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { supabase } from '../api/supabase';

// ─── Role types ────────────────────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'sales_manager'
  | 'estimator'
  | 'technician'
  | 'viewer';

// ─── Permission definitions ────────────────────────────────────────

export type Permission =
  // Proposals
  | 'create_proposals'
  | 'edit_proposals'
  | 'delete_proposals'
  | 'send_proposals'
  | 'lock_proposals'
  // Line items
  | 'edit_line_items'
  // Price book
  | 'manage_price_book'
  // Templates
  | 'use_templates'
  | 'manage_templates'
  // AI
  | 'use_ai_scope'
  | 'manage_ai_limits'
  // Analytics
  | 'view_analytics'
  | 'export_analytics'
  // Team / org
  | 'invite_members'
  | 'manage_members'
  | 'manage_roles'
  // Admin
  | 'manage_feature_flags'
  | 'view_audit_logs'
  | 'manage_system_settings'
  | 'manage_billing'
  // Field mode
  | 'use_field_mode';

// ─── Permission matrix ─────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  super_admin: new Set<Permission>([
    'create_proposals', 'edit_proposals', 'delete_proposals', 'send_proposals', 'lock_proposals',
    'edit_line_items',
    'manage_price_book',
    'use_templates', 'manage_templates',
    'use_ai_scope', 'manage_ai_limits',
    'view_analytics', 'export_analytics',
    'invite_members', 'manage_members', 'manage_roles',
    'manage_feature_flags', 'view_audit_logs', 'manage_system_settings', 'manage_billing',
    'use_field_mode',
  ]),

  admin: new Set<Permission>([
    'create_proposals', 'edit_proposals', 'delete_proposals', 'send_proposals', 'lock_proposals',
    'edit_line_items',
    'manage_price_book',
    'use_templates', 'manage_templates',
    'use_ai_scope', 'manage_ai_limits',
    'view_analytics', 'export_analytics',
    'invite_members', 'manage_members', 'manage_roles',
    'view_audit_logs',
    'use_field_mode',
  ]),

  sales_manager: new Set<Permission>([
    'create_proposals', 'edit_proposals', 'send_proposals', 'lock_proposals',
    'edit_line_items',
    'use_templates',
    'use_ai_scope',
    'view_analytics', 'export_analytics',
    'invite_members',
    'use_field_mode',
  ]),

  estimator: new Set<Permission>([
    'create_proposals', 'edit_proposals', 'send_proposals',
    'edit_line_items',
    'use_templates',
    'use_ai_scope',
    'view_analytics',
    'use_field_mode',
  ]),

  technician: new Set<Permission>([
    'use_field_mode',
    'view_analytics',
  ]),

  viewer: new Set<Permission>([
    'view_analytics',
  ]),
};

// ─── Pure guard function ───────────────────────────────────────────

/**
 * Returns true if the given role has the requested permission.
 * Safe to call in non-React contexts (Edge Functions, utility code).
 */
export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Returns true if the role is at least as privileged as the minimum.
 */
const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 6,
  admin: 5,
  sales_manager: 4,
  estimator: 3,
  technician: 2,
  viewer: 1,
};

export function isAtLeastRole(role: UserRole | null | undefined, minimum: UserRole): boolean {
  if (!role) return false;
  return (ROLE_RANK[role] ?? 0) >= ROLE_RANK[minimum];
}

// ─── React hook ────────────────────────────────────────────────────

export interface PermissionState {
  role: UserRole | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  isAtLeast: (minimum: UserRole) => boolean;
}

/**
 * React hook that reads the current user's role from Supabase profiles
 * and exposes a typed `can()` helper for UI permission gating.
 *
 * @example
 * const { can, isAtLeast } = usePermissions();
 * {can('manage_feature_flags') && <FeatureFlagsPanel />}
 * {isAtLeast('sales_manager') && <AnalyticsDashboard />}
 */
export function usePermissions(): PermissionState {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!cancelled) {
        setRole((profile?.role as UserRole) ?? 'viewer');
        setLoading(false);
      }
    }

    loadRole();

    // Keep role in sync with auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      loadRole();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    loading,
    can: (permission: Permission) => hasPermission(role, permission),
    isAtLeast: (minimum: UserRole) => isAtLeastRole(role, minimum),
  };
}
