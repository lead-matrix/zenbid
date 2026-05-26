import { useState, useEffect } from 'react';
import { X, DollarSign, TrendingUp, TrendingDown, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { formatCurrency } from '../../lib/calculations';
import { toast } from 'sonner';
import type { Project, ProjectItem } from '../../types';

interface Props {
  project: Project;
  items: ProjectItem[];
  onClose: () => void;
  onSaved: () => void;
}

export default function JobCostingModal({ project, items, onClose, onSaved }: Props) {
  const [actualCosts, setActualCosts] = useState<Record<string, { cost: string; qty: string; notes: string }>>({});
  const [jobNotes, setJobNotes] = useState(project.job_notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<string, { cost: string; qty: string; notes: string }> = {};
    items.forEach(item => {
      init[item.id] = {
        cost: item.actual_cost != null ? String(item.actual_cost) : '',
        qty: item.actual_quantity != null ? String(item.actual_quantity) : '',
        notes: item.actual_notes || '',
      };
    });
    setActualCosts(init);
  }, [items]);

  const totalEstimated = project.total_value || 0;
  const totalActual = items.reduce((sum, item) => {
    const c = parseFloat(actualCosts[item.id]?.cost || '0') || 0;
    const q = parseFloat(actualCosts[item.id]?.qty || String(item.quantity)) || item.quantity;
    return sum + c * q;
  }, 0);
  const variance = totalEstimated - totalActual;
  const variancePct = totalEstimated > 0 ? ((variance / totalEstimated) * 100).toFixed(1) : '0';

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each item's actual cost
      for (const item of items) {
        const entry = actualCosts[item.id];
        if (!entry) continue;
        const actualCost = entry.cost !== '' ? parseFloat(entry.cost) : null;
        const actualQty = entry.qty !== '' ? parseFloat(entry.qty) : null;
        await supabase.from('project_items').update({
          actual_cost: actualCost,
          actual_quantity: actualQty,
          actual_notes: entry.notes || null,
        }).eq('id', item.id);
      }
      // Update project job completion
      await supabase.from('projects').update({
        actual_total: totalActual,
        job_completed_at: new Date().toISOString(),
        job_notes: jobNotes,
      }).eq('id', project.id);
      toast.success('Job costing saved!');
      onSaved();
      onClose();
    } catch (e) {
      toast.error('Failed to save job costing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-copper" /> Job Costing — Actuals
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enter real costs to compare against your estimate</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Variance Summary */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-slate-50 dark:bg-navy-950/60 border-b border-slate-200 dark:border-navy-800">
          <div className="text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Estimated</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(totalEstimated)}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Actual Cost</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(totalActual)}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Variance</p>
            <div className={`flex items-center justify-center gap-1 ${variance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {variance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <p className="text-lg font-bold">{variance >= 0 ? '+' : ''}{formatCurrency(variance)}</p>
            </div>
            <p className={`text-[11px] ${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {variance >= 0 ? `+${variancePct}% under` : `${variancePct}% over`} budget
            </p>
          </div>
        </div>

        {/* Line Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-slate-50 dark:bg-navy-950/60 rounded-xl p-4 border border-slate-200 dark:border-navy-800">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.description}</p>
                  <p className="text-xs text-slate-400">Estimated: {item.quantity} {item.unit} × {formatCurrency(item.unit_price)} = {formatCurrency(item.quantity * item.unit_price)}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider
                  ${item.category === 'labor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    item.category === 'material' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    item.category === 'equipment' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-400'}`}>
                  {item.category}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Actual Unit Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualCosts[item.id]?.cost || ''}
                    onChange={e => setActualCosts(prev => ({ ...prev, [item.id]: { ...prev[item.id], cost: e.target.value } }))}
                    placeholder={String(item.unit_price)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:border-copper focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Actual Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualCosts[item.id]?.qty || ''}
                    onChange={e => setActualCosts(prev => ({ ...prev, [item.id]: { ...prev[item.id], qty: e.target.value } }))}
                    placeholder={String(item.quantity)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:border-copper focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Notes</label>
                  <input
                    type="text"
                    value={actualCosts[item.id]?.notes || ''}
                    onChange={e => setActualCosts(prev => ({ ...prev, [item.id]: { ...prev[item.id], notes: e.target.value } }))}
                    placeholder="e.g. price increase"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:border-copper focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Job Notes */}
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Job Completion Notes</label>
            <textarea
              value={jobNotes}
              onChange={e => setJobNotes(e.target.value)}
              rows={2}
              placeholder="What went well? Any surprises? Lessons learned..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:border-copper focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-navy-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <AlertCircle className="w-3.5 h-3.5" />
            Actuals won't change the client-facing proposal
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-copper hover:bg-copper-hover text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Job Costing'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
