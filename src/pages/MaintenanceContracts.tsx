import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Plus, DollarSign, Users, CheckCircle, XCircle, PauseCircle, ChevronRight, ArrowRight, Calendar, Copy, Check } from 'lucide-react';
import { supabase } from '../api/supabase';
import { formatCurrency } from '../lib/calculations';
import { toast } from 'sonner';
import type { MaintenanceContract, TradeType } from '../types';
import { TRADE_EMOJIS } from '../types';

const STATUS_STYLES: Record<MaintenanceContract['status'], { label: string; icon: any; cls: string }> = {
  active: { label: 'Active', icon: CheckCircle, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' },
  paused: { label: 'Paused', icon: PauseCircle, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' },
  cancelled: { label: 'Cancelled', icon: XCircle, cls: 'text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-400' },
  expired: { label: 'Expired', icon: XCircle, cls: 'text-slate-500 bg-slate-100 dark:bg-navy-800 dark:text-slate-400' },
};

const TRADES: TradeType[] = ['electrical','roofing','hvac','painting','plumbing','drain','general','other'];
const CYCLES = ['monthly','quarterly','annually'] as const;

export default function MaintenanceContracts() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '',
    trade: 'general' as TradeType, title: '', description: '',
    monthly_amount: '', billing_cycle: 'monthly' as MaintenanceContract['billing_cycle'],
    start_date: '', end_date: '', scope_of_work: '', visit_frequency: 'monthly',
    auto_renew: true,
  });

  const fetchContracts = async () => {
    const { data } = await supabase.from('maintenance_contracts').select('*').order('created_at', { ascending: false });
    setContracts((data as MaintenanceContract[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchContracts(); }, []);

  const totalMRR = contracts.filter(c => c.status === 'active').reduce((sum, c) => {
    if (c.billing_cycle === 'monthly') return sum + c.monthly_amount;
    if (c.billing_cycle === 'quarterly') return sum + c.monthly_amount / 3;
    return sum + c.monthly_amount / 12;
  }, 0);

  const handleCreate = async () => {
    if (!form.client_name || !form.client_email || !form.title || !form.monthly_amount) return toast.error('Please fill required fields');
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('maintenance_contracts').insert({
      user_id: user!.id,
      client_name: form.client_name,
      client_email: form.client_email,
      client_phone: form.client_phone || null,
      trade: form.trade,
      title: form.title,
      description: form.description || null,
      monthly_amount: parseFloat(form.monthly_amount),
      billing_cycle: form.billing_cycle,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      scope_of_work: form.scope_of_work || null,
      visit_frequency: form.visit_frequency,
      auto_renew: form.auto_renew,
    });
    setSaving(false);
    if (error) return toast.error('Failed to create contract');
    toast.success('Maintenance contract created!');
    setShowForm(false);
    setForm({ client_name: '', client_email: '', client_phone: '', trade: 'general', title: '', description: '', monthly_amount: '', billing_cycle: 'monthly', start_date: '', end_date: '', scope_of_work: '', visit_frequency: 'monthly', auto_renew: true });
    fetchContracts();
  };

  const copyContractLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/contract/${token}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Contract link copied!');
  };

  const updateStatus = async (id: string, status: MaintenanceContract['status']) => {
    await supabase.from('maintenance_contracts').update({ status }).eq('id', id);
    fetchContracts();
    toast.success(`Contract ${status}`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-copper" /> Maintenance Contracts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Recurring agreements that generate predictable revenue</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-copper hover:bg-copper-hover text-white rounded-xl font-semibold text-sm transition-colors">
          <Plus className="w-4 h-4" /> New Contract
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Contracts', value: contracts.filter(c => c.status === 'active').length, icon: CheckCircle, color: 'text-emerald-500' },
          { label: 'Monthly Recurring', value: formatCurrency(totalMRR), icon: DollarSign, color: 'text-copper' },
          { label: 'Total Clients', value: contracts.length, icon: Users, color: 'text-blue-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-800">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* New Contract Form */}
      {showForm && (
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">New Maintenance Contract</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 block">Client Name *</label>
              <input type="text" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 focus:border-copper focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 block">Client Email *</label>
              <input type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 focus:border-copper focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 block">Contract Title *</label>
              <input type="text" placeholder="e.g. HVAC Annual Maintenance" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 focus:border-copper focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 block">Trade</label>
              <select value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value as TradeType }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 focus:border-copper focus:outline-none">
                {TRADES.map(t => <option key={t} value={t}>{TRADE_EMOJIS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 block">Amount *</label>
              <input type="number" min="0" step="0.01" placeholder="99.00" value={form.monthly_amount} onChange={e => setForm(f => ({ ...f, monthly_amount: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 focus:border-copper focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 block">Billing Cycle</label>
              <select value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 focus:border-copper focus:outline-none">
                {CYCLES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 block">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 focus:border-copper focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 block">End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 focus:border-copper focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 block">Scope of Work</label>
              <textarea rows={2} value={form.scope_of_work} onChange={e => setForm(f => ({ ...f, scope_of_work: e.target.value }))} placeholder="What's included in this maintenance agreement..."
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 focus:border-copper focus:outline-none resize-none" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.auto_renew} onChange={e => setForm(f => ({ ...f, auto_renew: e.target.checked }))} className="accent-copper" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Auto-renew</span>
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-xl">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 bg-copper hover:bg-copper-hover text-white rounded-xl text-sm font-bold disabled:opacity-50">
              <ArrowRight className="w-4 h-4" />{saving ? 'Creating...' : 'Create Contract'}
            </button>
          </div>
        </div>
      )}

      {/* Contract List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading contracts...</div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-12">
          <RefreshCw className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No maintenance contracts yet</p>
          <p className="text-sm text-slate-400 mt-1">Turn one-time jobs into recurring monthly revenue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => {
            const s = STATUS_STYLES[c.status];
            return (
              <div key={c.id} className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-800 p-4 flex items-center gap-4">
                <span className="text-2xl">{TRADE_EMOJIS[c.trade as TradeType] || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{c.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${s.cls}`}>
                      <s.icon className="w-3 h-3" />{s.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{c.client_name} · {c.client_email}</p>
                  <p className="text-xs text-copper font-semibold mt-0.5">{formatCurrency(c.monthly_amount)} / {c.billing_cycle}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => copyContractLink(c.share_token, c.id)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center justify-center" title="Copy contract link">
                    {copied === c.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  {c.status === 'active' && (
                    <button onClick={() => updateStatus(c.id, 'paused')} className="w-8 h-8 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/20 flex items-center justify-center" title="Pause">
                      <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                    </button>
                  )}
                  {c.status === 'paused' && (
                    <button onClick={() => updateStatus(c.id, 'active')} className="w-8 h-8 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/20 flex items-center justify-center" title="Activate">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
