import { useState, useEffect } from 'react';
import { Users, Plus, Mail, Check, X, DollarSign, Eye } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { formatCurrency } from '../../lib/calculations';
import { toast } from 'sonner';
import type { SubcontractorBid } from '../../types';

interface Props { projectId: string; projectName: string; }

const STATUS_COLORS: Record<SubcontractorBid['status'], string> = {
  invited: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  bid_submitted: 'bg-copper/10 text-copper dark:bg-copper/10',
  accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-500 dark:bg-red-900/20 dark:text-red-400',
};

export default function SubcontractorPanel({ projectId, projectName }: Props) {
  const [bids, setBids] = useState<SubcontractorBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sub_name: '', sub_email: '', sub_phone: '', trade_scope: '' });
  const [saving, setSaving] = useState(false);

  const fetchBids = async () => {
    const { data } = await supabase.from('subcontractor_bids').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    setBids((data as SubcontractorBid[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBids(); }, [projectId]);

  const handleInvite = async () => {
    if (!form.sub_name || !form.sub_email || !form.trade_scope) return toast.error('Name, email, and scope required');
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('subcontractor_bids').insert({
      project_id: projectId,
      user_id: user!.id,
      sub_name: form.sub_name,
      sub_email: form.sub_email,
      sub_phone: form.sub_phone || null,
      trade_scope: form.trade_scope,
    });
    setSaving(false);
    if (error) return toast.error('Failed to create invite');
    toast.success(`${form.sub_name} invited to bid`);
    setForm({ sub_name: '', sub_email: '', sub_phone: '', trade_scope: '' });
    setShowForm(false);
    fetchBids();
  };

  const handleAccept = async (id: string) => {
    await supabase.from('subcontractor_bids').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', id);
    toast.success('Bid accepted!');
    fetchBids();
  };

  const handleReject = async (id: string) => {
    await supabase.from('subcontractor_bids').update({ status: 'rejected' }).eq('id', id);
    fetchBids();
  };

  const bidPortalUrl = (token: string) => `${window.location.origin}/sub-bid/${token}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-copper" /> Subcontractor Bids
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs font-semibold text-copper hover:text-copper-hover">
          <Plus className="w-3.5 h-3.5" /> Invite Sub
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 dark:bg-navy-950/60 rounded-xl p-4 border border-slate-200 dark:border-navy-800 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Sub name *" value={form.sub_name} onChange={e => setForm(f => ({ ...f, sub_name: e.target.value }))}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            <input type="email" placeholder="Email *" value={form.sub_email} onChange={e => setForm(f => ({ ...f, sub_email: e.target.value }))}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            <input type="tel" placeholder="Phone" value={form.sub_phone} onChange={e => setForm(f => ({ ...f, sub_phone: e.target.value }))}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none" />
            <div className="col-span-2">
              <textarea placeholder="Scope of work for this sub *" rows={2} value={form.trade_scope} onChange={e => setForm(f => ({ ...f, trade_scope: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 focus:border-copper focus:outline-none resize-none" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">Sub receives a secure link to view their scoped work and submit a bid. You approve or reject from here.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg">Cancel</button>
            <button onClick={handleInvite} disabled={saving} className="px-4 py-1.5 text-sm bg-copper text-white rounded-lg font-semibold hover:bg-copper-hover disabled:opacity-50">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{saving ? 'Inviting...' : 'Send Invite'}</span>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-400 text-center py-3">Loading...</div>
      ) : bids.length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-3">No subcontractor bids yet. Invite subs to get competitive bids on scoped work.</div>
      ) : (
        <div className="space-y-2">
          {bids.map(bid => (
            <div key={bid.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950/40">
              <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{bid.sub_name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${STATUS_COLORS[bid.status]}`}>{bid.status.replace('_', ' ')}</span>
                </div>
                <p className="text-xs text-slate-400 truncate">{bid.trade_scope}</p>
                {bid.bid_amount && <p className="text-xs text-copper font-semibold mt-0.5">{formatCurrency(bid.bid_amount)} bid submitted</p>}
              </div>
              <div className="flex items-center gap-1">
                <a href={bidPortalUrl(bid.bid_token)} target="_blank" rel="noopener noreferrer" title="Open bid portal" className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center justify-center">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                </a>
                {bid.status === 'bid_submitted' && (
                  <>
                    <button onClick={() => handleAccept(bid.id)} className="w-7 h-7 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/20 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    </button>
                    <button onClick={() => handleReject(bid.id)} className="w-7 h-7 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 flex items-center justify-center">
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </button>
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
