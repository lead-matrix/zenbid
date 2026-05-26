import { useState, useEffect } from 'react';
import { CreditCard, Plus, Check, Copy, ExternalLink, DollarSign } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { formatCurrency } from '../../lib/calculations';
import { toast } from 'sonner';
import type { DepositRequest, Project } from '../../types';

interface Props {
  project: Project;
}

export default function DepositPanel({ project }: Props) {
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', percentage: '50', description: '50% deposit to secure your project', payment_link: '' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchDeposits = async () => {
    const { data } = await supabase.from('deposit_requests').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
    setDeposits((data as DepositRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDeposits(); }, [project.id]);

  const totalValue = project.total_value || 0;
  const suggestedAmount = parseFloat(form.percentage) > 0 ? (totalValue * parseFloat(form.percentage) / 100).toFixed(2) : '';

  const handleAdd = async () => {
    const amount = parseFloat(form.amount || suggestedAmount);
    if (!amount || amount <= 0) return toast.error('Enter a deposit amount');
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('deposit_requests').insert({
      project_id: project.id,
      user_id: user!.id,
      amount,
      percentage: parseFloat(form.percentage) || null,
      description: form.description,
      payment_link: form.payment_link || null,
    });
    setSaving(false);
    if (error) return toast.error('Failed to create deposit request');
    toast.success('Deposit request created!');
    setShowForm(false);
    fetchDeposits();
  };

  const markPaid = async (id: string) => {
    await supabase.from('deposit_requests').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    toast.success('Marked as paid!');
    fetchDeposits();
  };

  const copyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Payment link copied!');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-copper" /> Deposit Collection
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs font-semibold text-copper hover:text-copper-hover">
          <Plus className="w-3.5 h-3.5" /> Request Deposit
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 dark:bg-navy-950/60 rounded-xl p-4 border border-slate-200 dark:border-navy-800 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">% of Total</label>
              <input type="number" min="0" max="100" value={form.percentage} onChange={e => { setForm(f => ({ ...f, percentage: e.target.value, amount: (totalValue * parseFloat(e.target.value || '0') / 100).toFixed(2) })); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Amount ($)</label>
              <input type="number" min="0" step="0.01" value={form.amount || suggestedAmount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder={suggestedAmount || '0.00'}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Description shown to client</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Payment Link (Venmo, PayPal, Stripe, Zelle, etc.)</label>
              <input type="url" placeholder="https://paypal.me/yourlink" value={form.payment_link} onChange={e => setForm(f => ({ ...f, payment_link: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">Deposit request will appear on the client portal. Client clicks your payment link to pay, then you mark it as received.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="px-4 py-1.5 text-sm bg-copper text-white rounded-lg font-semibold hover:bg-copper-hover disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Request'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-400 text-center py-3">Loading...</div>
      ) : deposits.length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-3">No deposit requests yet. Request one to get paid before the job starts.</div>
      ) : (
        <div className="space-y-2">
          {deposits.map(d => (
            <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border ${d.status === 'paid' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/30 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950/40'}`}>
              <DollarSign className={`w-4 h-4 flex-shrink-0 ${d.status === 'paid' ? 'text-emerald-500' : 'text-copper'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(d.amount)} {d.percentage ? `(${d.percentage}%)` : ''}</p>
                <p className="text-xs text-slate-400 truncate">{d.description}</p>
              </div>
              <div className="flex items-center gap-1">
                {d.status === 'paid' ? (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> Paid</span>
                ) : (
                  <>
                    {d.payment_link && (
                      <>
                        <button onClick={() => copyLink(d.payment_link!, d.id)} className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center justify-center">
                          {copied === d.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                        <a href={d.payment_link} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center justify-center">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </a>
                      </>
                    )}
                    <button onClick={() => markPaid(d.id)} className="text-xs text-emerald-600 font-semibold hover:underline px-2">Mark Paid</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
