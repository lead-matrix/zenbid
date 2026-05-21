import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../api/supabase';
import type { Project, StatusType } from '../types';
import { toast } from 'sonner';
import { eventBus } from '../lib/eventBus';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load projects');
    } else {
      setProjects((data as Project[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (input: Partial<Project>): Promise<Project | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...input,
        user_id: user.id,
        status: 'lead',
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create project');
      return null;
    }

    const newProject = data as Project;
    setProjects(prev => [newProject, ...prev]);
    toast.success('Project created!');
    return newProject;
  };

  const updateProject = async (id: string, updates: Partial<Project>): Promise<void> => {
    const { error } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update project');
      return;
    }

    const proj = projects.find(p => p.id === id);
    const clientEmail = updates.client_email || proj?.client_email;

    setProjects(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );

    if (updates.status === 'sent') {
      eventBus.emit('proposal.sent', { projectId: id, sentAt: new Date().toISOString(), clientEmail });
    } else if (updates.status === 'lost') {
      eventBus.emit('proposal.abandoned', { projectId: id, abandonedAt: new Date().toISOString() });
    }
  };

  const deleteProject = async (id: string): Promise<void> => {
    const { error } = await supabase.from('projects').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete project');
      return;
    }

    setProjects(prev => prev.filter(p => p.id !== id));
    toast.success('Project deleted');
  };

  const updateStatus = async (id: string, status: StatusType): Promise<void> => {
    await updateProject(id, { status });
  };

  return { projects, loading, fetchProjects, createProject, updateProject, deleteProject, updateStatus };
}

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast.error('Failed to load project');
    } else {
      setProject(data as Project);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const updateProject = async (updates: Partial<Project>): Promise<void> => {
    if (!id) return;
    const { error } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setProject(prev => {
        const next = prev ? { ...prev, ...updates } : null;
        if (updates.status === 'sent') {
          eventBus.emit('proposal.sent', { projectId: id, sentAt: new Date().toISOString(), clientEmail: next?.client_email });
        } else if (updates.status === 'lost') {
          eventBus.emit('proposal.abandoned', { projectId: id, abandonedAt: new Date().toISOString() });
        }
        return next;
      });
    }
  };

  return { project, loading, fetchProject, updateProject, setProject };
}
