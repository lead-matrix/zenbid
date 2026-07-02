import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import type { Project, TradeType } from '../../types';
import { TRADE_EMOJIS } from '../../types';

interface Props {
  onClose: () => void;
  onCreate: (data: Partial<Project>) => Promise<Project | null>;
}

const TRADES: { value: TradeType; label: string }[] = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'painting', label: 'Painting' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'drain', label: 'Drain & Sewer' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
];

export default function AddProjectModal({ onClose, onCreate }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    trade: 'general' as TradeType,
    client_name: '',
    client_email: '',
    client_phone: '',
    project_address: '',
    start_date: '',
    valid_until: '',
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const projectData: Partial<Project> = {
      ...form,
      status: 'lead',
      labor_markup: profile?.default_labor_markup ?? 30,
      material_markup: profile?.default_material_markup ?? 18,
      equipment_markup: profile?.default_equipment_markup ?? 12,
      tax_rate: profile?.default_tax_rate ?? 8,
      company_name: profile?.company_name ?? '',
      company_email: profile?.company_email ?? '',
      company_phone: profile?.company_phone ?? '',
      company_logo: profile?.company_logo ?? '',
      subtotal: 0,
      margin_amount: 0,
      tax_amount: 0,
      total_value: 0,
    };

    const created = await onCreate(projectData);
    setLoading(false);
    if (created) onClose();
  };

  return (
    <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-navy-900 border border-slate-150 dark:border-navy-800 rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-navy-800">
          <div>
            <h2 className="text-lg font-bold font-sora text-slate-900 dark:text-white">Create New Bid</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Fill in the project details below to build your estimate</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors text-slate-400 dark:text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Project Name *</label>
            <input
              id="new-project-name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="e.g. Office Rewire – Suite 400"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
            />
          </div>

          {/* Trade Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Trade</label>
            <div className="grid grid-cols-4 gap-2">
              {TRADES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, trade: t.value }))}
                  className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all ${
                    form.trade === t.value
                      ? 'border-copper bg-copper-50/50 dark:bg-copper-950/20 text-copper font-semibold shadow-sm'
                      : 'border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                  }`}
                >
                  <span className="text-lg">{TRADE_EMOJIS[t.value]}</span>
                  <span className="truncate w-full text-center">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Client Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Client Name *</label>
              <input
                id="new-project-client"
                name="client_name"
                type="text"
                value={form.client_name}
                onChange={handleChange}
                required
                placeholder="John Doe"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Client Phone</label>
              <input
                name="client_phone"
                type="tel"
                value={form.client_phone}
                onChange={handleChange}
                placeholder="(555) 000-0000"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Client Email</label>
            <input
              name="client_email"
              type="email"
              value={form.client_email}
              onChange={handleChange}
              placeholder="client@email.com"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Project Address</label>
            <input
              name="project_address"
              type="text"
              value={form.project_address}
              onChange={handleChange}
              placeholder="123 Main St, City, State"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Start Date</label>
              <input
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Valid Until</label>
              <input
                name="valid_until"
                type="date"
                value={form.valid_until}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Notes / Scope of Work</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the scope of work..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/20">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800 transition-all"
          >
            Cancel
          </button>
          <button
            id="create-project-submit"
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={loading || !form.name || !form.client_name}
            className="px-5 py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
