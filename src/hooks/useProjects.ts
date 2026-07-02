/**
 * useProjects.ts
 * ─────────────────────────────────────────────────────────────────
 * Organization-scoped project data hook.
 *
 * TENANT ISOLATION:
 *   Queries are scoped by organization_id (not user_id) when the user
 *   belongs to an organization. This ensures all org members see the
 *   same projects, and no cross-tenant data leaks.
 *
 *   Fallback: if organization_id is not yet populated (legacy users),
 *   falls back to user_id scoping for backward compatibility.
 *
 * IMPERSONATION:
 *   When an admin is impersonating a user, uses the impersonated
 *   user's organization_id. Clears projects immediately on user switch
 *   to prevent data flash.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../api/supabase';
import { useOrganization } from '../providers/OrganizationProvider';
import type { Project, StatusType } from '../types';
import { toast } from 'sonner';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeUserId, activeProfile: profile } = useOrganization();
  const prevUserIdRef = useRef<string | null>(null);

  const fetchProjects = useCallback(async () => {
    const userId = activeUserId;

    if (!userId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      // Prefer organization-scoped query for proper tenant isolation
      const orgId = profile?.organization_id;
      if (orgId) {
        query = query.eq('organization_id', orgId);
      } else {
        // Fallback for legacy users without org assignment
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useProjects] fetchProjects error:', error.message);
        toast.error('Failed to load projects');
        setProjects([]);
      } else {
        setProjects((data as Project[]) || []);
      }
    } catch (err) {
      console.error('[useProjects] Unexpected error:', err);
      toast.error('Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear immediately when user switches (prevents data flash during impersonation)
  // and subscribe to projects realtime changes for instant updates
  useEffect(() => {
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== activeUserId) {
      setProjects([]);
    }
    prevUserIdRef.current = activeUserId;
    fetchProjects();

    const orgId = profile?.organization_id;
    const userId = activeUserId;

    if (!userId) return;

    // Org-scoped realtime for projects list
    const channelName = `projects_realtime:${orgId ?? userId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: orgId
          ? `organization_id=eq.${orgId}`
          : `user_id=eq.${userId}`,
      }, () => {
        // Refetch projects when changes occur in database
        fetchProjects();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProjects, activeUserId]);

  const createProject = async (input: Partial<Project>): Promise<Project | null> => {
    const userId = activeUserId;
    if (!userId) return null;

    const brandSnapshot = profile ? {
      company_name:  input.company_name  || profile.company_name  || '',
      company_email: input.company_email || profile.company_email || '',
      company_phone: input.company_phone || profile.company_phone || '',
      company_logo:  input.company_logo  || profile.company_logo  || '',
      labor_markup:     input.labor_markup     ?? profile.default_labor_markup     ?? 30,
      material_markup:  input.material_markup  ?? profile.default_material_markup  ?? 18,
      equipment_markup: input.equipment_markup ?? profile.default_equipment_markup ?? 12,
      tax_rate:         input.tax_rate         ?? profile.default_tax_rate         ?? 8,
    } : {};

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...input,
          ...brandSnapshot,
          user_id: userId,
          organization_id: profile?.organization_id ?? null,
          status: input.status ?? 'lead',
        })
        .select()
        .single();

      if (error) {
        console.error('[useProjects] createProject error:', error.message);
        toast.error('Failed to create project');
        return null;
      }

      const newProject = data as Project;
      setProjects(prev => [newProject, ...prev]);
      toast.success('Project created!');
      return newProject;
    } catch (err) {
      console.error('[useProjects] createProject unexpected error:', err);
      toast.error('Failed to create project');
      return null;
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>): Promise<void> => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[useProjects] updateProject error:', error.message);
        toast.error('Failed to update project');
        return;
      }

      setProjects(prev =>
        prev.map(p => p.id === id ? { ...p, ...updates } : p)
      );
    } catch (err) {
      console.error('[useProjects] updateProject unexpected error:', err);
      toast.error('Failed to update project');
    }
  };

  const deleteProject = async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[useProjects] deleteProject error:', error.message);
        toast.error('Failed to delete project');
        return;
      }

      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success('Project deleted');
    } catch (err) {
      console.error('[useProjects] deleteProject unexpected error:', err);
      toast.error('Failed to delete project');
    }
  };

  const updateProjectStatus = async (id: string, status: StatusType): Promise<void> => {
    await updateProject(id, { status });
  };

  return {
    projects,
    loading,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    updateProjectStatus,
  };
}

/**
 * useProject — single project hook by ID.
 * Used by EstimatorWorkspace and other single-project views.
 */
export function useProject(id: string | undefined) {
  const [project, setProject] = useState<import('../types').Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      if (error) { console.error('[useProject] fetch error:', error.message); setProject(null); }
      else { setProject(data as import('../types').Project); }
    } catch (err) {
      console.error('[useProject] unexpected error:', err);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const updateProject = async (updates: Partial<import('../types').Project>): Promise<void> => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { console.error('[useProject] update error:', error.message); return; }
      setProject(prev => prev ? { ...prev, ...updates } : prev);
    } catch (err) {
      console.error('[useProject] update unexpected error:', err);
    }
  };

  return { project, loading, fetchProject, updateProject };
}

