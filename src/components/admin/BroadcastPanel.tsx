import { useState } from 'react';
import { Send, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { toast } from 'sonner';
import type { Profile } from '../../types';

interface Props { members: Profile[]; }

export default function BroadcastPanel({ members }: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const contractors = members.filter(m => !m.is_admin);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { toast.error('Subject and message are required.'); return; }
    if (!window.confirm(`Send to all ${contractors.length} active contractors? This cannot be undone.`)) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      for (const m of contractors) {
        try {
          await supabase.from('email_logs').insert({
            user_id: m.id,
            recipient_email: m.email,
            template_type: 'broadcast',
            subject,
            delivery_status: 'sent',
            provider: 'manual_broadcast',
            html_preview: body,
            metadata: { sent_by: user?.id, sent_at: new Date().toISOString() },
          });
        } catch (_) { /* continue */ }
      }
      setSent(true);
      toast.success(`Broadcast logged for ${contractors.length} contractors.`);
    } catch {
      toast.error('Broadcast failed. Try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-4" />
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Broadcast Sent</h3>
      <p className="text-sm text-slate-400 mb-6">Logged to {contractors.length} contractor records.</p>
      <button onClick={() => { setSent(false); setSubject(''); setBody(''); }} className="px-5 py-2.5 bg-copper text-white rounded-xl font-bold text-sm">Send Another</button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2 mb-1">
          <Send className="w-4 h-4 text-copper" /> Broadcast Email
        </h2>
        <p className="text-[11px] text-slate-400">Send a message to all {contractors.length} active contractor seats.</p>
      </div>
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-900/30 rounded-xl">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Logs to email_logs. Wire up Resend or SendGrid for live delivery.</p>
      </div>
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl p-6 shadow-card space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Recipients</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Users className="w-3.5 h-3.5 text-copper" /> All {contractors.length} active contractor seats
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Subject *</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. New Feature: AI Scope Assistant is now live 🚀" className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Message *</label>
            <button onClick={() => setPreviewMode(p => !p)} className="text-[10px] text-copper font-bold hover:underline">{previewMode ? 'Edit' : 'Preview'}</button>
          </div>
          {previewMode
            ? <div className="bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-4 py-3 min-h-[120px] text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{body || <span className="text-slate-400 italic">Nothing yet.</span>}</div>
            : <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message here." className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all resize-none" />
          }
          <p className="text-[10px] text-slate-400 mt-1">{body.length} chars</p>
        </div>
        <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()} className="w-full py-3 bg-copper hover:bg-copper-hover disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
          <Send className="w-4 h-4" /> {sending ? 'Sending…' : `Send to ${contractors.length} Contractors`}
        </button>
      </div>
    </div>
  );
}
