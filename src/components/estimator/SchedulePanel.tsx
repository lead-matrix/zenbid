import { useState, useEffect } from 'react';
import { Calendar, Plus, Check, Clock, Trash2, Flag, Users } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { toast } from 'sonner';
import type { ProjectSchedule } from '../../types';

interface Props {
  projectId: string;
}

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400',
};

export default function SchedulePanel({ projectId }: Props) {
  const [schedules, setSchedules] = useState<ProjectSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', scheduled_date: '', scheduled_time: '', duration_hours: '1', milestone: false, description: '' });
  const [saving, setSaving] = useState(false);

  const fetchSchedules = async () => {
    const { data } = await supabase.from('project_schedule').select('*').eq('project_id', projectId).order('scheduled_date');
    setSchedules((data as ProjectSchedule[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSchedules(); }, [projectId]);

  const handleAdd = async () => {
    if (!form.title || !form.scheduled_date) return toast.error('Title and date required');
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('project_schedule').insert({
      project_id: projectId,
      user_id: user!.id,
      title: form.title,
      description: form.description || null,
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time || null,
      duration_hours: parseFloat(form.duration_hours) || 1,
      milestone: form.milestone,
    });
    setSaving(false);
    if (error) return toast.error('Failed to add schedule item');
    toast.success('Schedule item added');
    setForm({ title: '', scheduled_date: '', scheduled_time: '', duration_hours: '1', milestone: false, description: '' });
    setShowForm(false);
    fetchSchedules();
  };

  const handleStatus = async (id: string, status: ProjectSchedule['status']) => {
    await supabase.from('project_schedule').update({ status }).eq('id', id);
    fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('project_schedule').delete().eq('id', id);
    fetchSchedules();
    toast.success('Removed');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-copper" /> Project Schedule
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs font-semibold text-copper hover:text-copper-hover">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 dark:bg-navy-950/60 rounded-xl p-4 border border-slate-200 dark:border-navy-800 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <input type="text" placeholder="Task title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            </div>
            <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            <input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            <input type="number" min="0.5" step="0.5" placeholder="Duration (hrs)" value={form.duration_hours} onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={form.milestone} onChange={e => setForm(f => ({ ...f, milestone: e.target.checked }))} className="accent-copper" />
              <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1"><Flag className="w-3 h-3 text-copper" /> Milestone</span>
            </label>
            <div className="col-span-2">
              <input type="text" placeholder="Notes (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="px-4 py-1.5 text-sm bg-copper text-white rounded-lg font-semibold hover:bg-copper-hover disabled:opacity-50">
              {saving ? 'Saving...' : 'Add Item'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-sm text-slate-400">Loading...</div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400">No schedule items yet. Add milestones, site visits, or crew days.</div>
      ) : (
        <div className="space-y-2">
          {schedules.map(s => (
            <div key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border ${s.milestone ? 'border-copper/30 bg-copper/5' : 'border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950/40'}`}>
              {s.milestone && <Flag className="w-3.5 h-3.5 text-copper mt-0.5 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.title}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${STATUS_COLORS[s.status]}`}>{s.status.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(s.scheduled_date).toLocaleDateString()}</span>
                  {s.scheduled_time && <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{s.scheduled_time}</span>}
                  <span className="text-xs text-slate-400">{s.duration_hours}h</span>
                </div>
                {s.description && <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>}
              </div>
              <div className="flex items-center gap-1">
                {s.status !== 'completed' && (
                  <button onClick={() => handleStatus(s.id, 'completed')} title="Mark complete" className="w-7 h-7 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/20 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  </button>
                )}
                <button onClick={() => handleDelete(s.id)} title="Delete" className="w-7 h-7 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
