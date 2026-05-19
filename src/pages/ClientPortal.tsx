import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../api/supabase';
import { calcTotals, formatCurrency } from '../lib/calculations';
import type { Project, ProjectItem } from '../types';
import { TRADE_EMOJIS } from '../types';
import { toast } from 'sonner';

// ── Canvas Signature Pad ─────────────────────────────────────────────────────
function SignaturePad({
  onSign,
  onClear,
  signed,
}: {
  onSign: (dataUrl: string) => void;
  onClear: () => void;
  signed: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    lastPos.current = pos;
  }, []);

  const endDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSign(canvas.toDataURL('image/png'));
  }, [onSign]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', endDraw);
    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      window.removeEventListener('mouseup', endDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      window.removeEventListener('touchend', endDraw);
    };
  }, [startDraw, draw, endDraw]);

  return (
    <div className="space-y-2">
      <div
        className={`relative rounded-xl border-2 ${
          signed ? 'border-emerald-300 bg-emerald-50/30' : 'border-dashed border-slate-300 bg-slate-50'
        } transition-colors overflow-hidden`}
        style={{ height: 96 }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={192}
          className="w-full h-full cursor-crosshair touch-none"
        />
        {!signed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-slate-400 select-none">✍️ Sign here</span>
          </div>
        )}
      </div>
      {signed && (
        <button
          onClick={handleClear}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors underline"
        >
          Clear signature
        </button>
      )}
    </div>
  );
}

// ── Main ClientPortal Component ──────────────────────────────────────────────
export default function ClientPortal() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState<'approve' | 'changes' | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: proj, error } = await supabase
        .from('projects')
        .select('*')
        .eq('share_token', shareToken)
        .single();

      if (error || !proj) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProject(proj as Project);

      const { data: projectItems } = await supabase
        .from('project_items')
        .select('*')
        .eq('project_id', proj.id)
        .order('sort_order');

      setItems((projectItems as ProjectItem[]) || []);
      setLoading(false);
    };

    fetchData();
  }, [shareToken]);

  // ── Notify contractor via edge function ─────────────────────────────────
  const notifyContractor = async (actionType: 'approve' | 'changes', msg: string) => {
    if (!project) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    try {
      await fetch(`${supabaseUrl}/functions/v1/notify-contractor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          shareToken,
          action: actionType,
          clientMessage: msg || null,
          clientName: project.client_name,
        }),
      });
    } catch (e) {
      // Non-fatal — notification failed silently
      console.warn('Contractor notification failed:', e);
    }
  };

  const handleApprove = async () => {
    if (!project) return;
    if (!signatureDataUrl) {
      setSignatureError(true);
      toast.error('Please sign the proposal before approving.');
      return;
    }
    setSignatureError(false);
    setSubmitting(true);

    const { error } = await supabase
      .from('projects')
      .update({
        status: 'approved',
        client_approved_at: new Date().toISOString(),
        client_message: message || null,
        signature_data: signatureDataUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('share_token', shareToken);

    if (error) {
      console.error('Approval error:', error);
      toast.error('Failed to submit. Please try again.');
    } else {
      // Notify contractor
      await notifyContractor('approve', message);
      setSubmitted(true);
      setAction(null);
      toast.success('Bid approved! The contractor has been notified.');
    }
    setSubmitting(false);
  };

  const handleRequestChanges = async () => {
    if (!project) return;
    if (!message.trim()) {
      toast.error('Please describe the changes you need.');
      return;
    }
    setSubmitting(true);

    const { error } = await supabase
      .from('projects')
      .update({
        client_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('share_token', shareToken);

    if (error) {
      console.error('Changes request error:', error);
      toast.error('Failed to submit. Please try again.');
    } else {
      // Notify contractor
      await notifyContractor('changes', message);
      setSubmitted(true);
      setAction(null);
      toast.success('Message sent! The contractor will review your feedback.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-copper-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-slate-800">Proposal not found</h2>
          <p className="text-slate-500 text-sm mt-2">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const totals = calcTotals(items, project.labor_markup, project.material_markup, project.equipment_markup, project.tax_rate);
  const isApproved = !!project.client_approved_at;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── Header ── */}
      <div style={{ background: '#0F172A' }} className="w-full">
        <div className="max-w-4xl mx-auto px-8 py-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {project.company_logo ? (
              <img src={project.company_logo} alt="Company logo" className="w-14 h-14 object-contain rounded-xl bg-white p-1.5" />
            ) : (
              <div className="w-14 h-14 bg-navy-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {(project.company_name || 'C').charAt(0)}
                </span>
              </div>
            )}
            <div>
              <div className="text-white font-bold text-xl">{project.company_name || 'Your Company'}</div>
              <div className="text-slate-400 text-sm mt-0.5">
                {project.company_email} {project.company_phone && `· ${project.company_phone}`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div style={{ color: '#C07840' }} className="text-2xl font-bold tracking-wide">PROPOSAL</div>
            <div className="text-slate-400 text-sm mt-0.5">
              Date: {new Date(project.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            {project.valid_until && (
              <div className="text-slate-400 text-sm">
                Valid Until: {new Date(project.valid_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Client + Project Info ── */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-8 py-6 grid grid-cols-2 gap-8">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Prepared For</div>
            <div className="text-xl font-bold text-slate-900">{project.client_name}</div>
            {project.client_email && <div className="text-sm text-slate-500 mt-0.5">{project.client_email}</div>}
            {project.client_phone && <div className="text-sm text-slate-500">{project.client_phone}</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Project</div>
            <div className="flex items-center gap-2">
              <span>{TRADE_EMOJIS[project.trade]}</span>
              <span className="text-xl font-bold text-slate-900">{project.name}</span>
            </div>
            {project.project_address && <div className="text-sm text-slate-500 mt-0.5">{project.project_address}</div>}
            {project.start_date && (
              <div className="text-sm text-slate-500">
                Start: {new Date(project.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* ── Already approved banner ── */}
        {isApproved && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <div className="text-emerald-800 font-bold text-sm">This proposal has been approved</div>
              <div className="text-emerald-600 text-xs mt-0.5">
                Approved on {new Date(project.client_approved_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        )}

        {/* ── Submitted confirmation ── */}
        {submitted && (
          <div className="bg-copper-50/50 border border-copper-200 rounded-2xl px-6 py-5 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <div className="text-copper-800 font-bold">
              {action === null ? 'Response submitted!' : 'Message sent!'}
            </div>
            <div className="text-copper-700 text-sm mt-1">
              {project.company_name || 'The contractor'} has been notified and will be in touch shortly.
            </div>
          </div>
        )}

        {/* ── Line Items ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-800 px-5 py-3 grid grid-cols-12 gap-2">
            <div className="col-span-5 text-xs font-semibold text-slate-300 uppercase tracking-wide">Description</div>
            <div className="col-span-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Category</div>
            <div className="col-span-1 text-xs font-semibold text-slate-300 uppercase tracking-wide text-center">Qty</div>
            <div className="col-span-1 text-xs font-semibold text-slate-300 uppercase tracking-wide text-center">Unit</div>
            <div className="col-span-1 text-xs font-semibold text-slate-300 uppercase tracking-wide text-right">Unit Price</div>
            <div className="col-span-2 text-xs font-semibold text-slate-300 uppercase tracking-wide text-right">Total</div>
          </div>

          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No line items in this proposal</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                >
                  <div className="col-span-5 text-sm text-slate-800 font-medium">{item.description || '—'}</div>
                  <div className="col-span-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${getCategoryClass(item.category)}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="col-span-1 text-sm text-slate-600 text-center">{item.quantity}</div>
                  <div className="col-span-1 text-sm text-slate-500 text-center">{item.unit}</div>
                  <div className="col-span-1 text-sm text-slate-700 text-right">${item.unit_price.toFixed(2)}</div>
                  <div className="col-span-2 text-sm font-bold text-slate-900 text-right">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Totals ── */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between py-2 px-4 bg-slate-100 rounded-xl">
              <span className="text-sm text-slate-600">Subtotal</span>
              <span className="text-sm font-semibold text-slate-800">{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.marginAmount > 0 && (
              <div className="flex justify-between py-2 px-4 bg-white rounded-xl border border-slate-100">
                <span className="text-sm text-slate-500">Overhead &amp; Profit</span>
                <span className="text-sm font-medium text-slate-700">{formatCurrency(totals.marginAmount)}</span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex justify-between py-2 px-4 bg-slate-100 rounded-xl">
                <span className="text-sm text-slate-500">Tax</span>
                <span className="text-sm font-medium text-slate-700">{formatCurrency(totals.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between py-3.5 px-4 bg-navy-600 rounded-xl">
              <span className="text-sm font-bold text-white">TOTAL</span>
              <span className="text-lg font-bold text-white">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Notes ── */}
        {project.notes && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Notes &amp; Scope of Work</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{project.notes}</p>
          </div>
        )}

        {/* ── Signature Block ── PLACED BEFORE action buttons ── */}
        {!isApproved && !submitted && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wide">Signatures</h3>
            <p className="text-xs text-slate-400 mb-5">By signing, you acknowledge and agree to the terms of this proposal.</p>

            <div className="grid grid-cols-2 gap-8">
              {/* Client Signature */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Client Signature
                  {action === 'approve' && (
                    <span className="ml-1.5 text-red-400">*required</span>
                  )}
                </div>
                <SignaturePad
                  onSign={(url) => { setSignatureDataUrl(url); setSignatureError(false); }}
                  onClear={() => setSignatureDataUrl(null)}
                  signed={!!signatureDataUrl}
                />
                {signatureError && (
                  <p className="text-xs text-red-500 mt-1.5">Please sign before approving.</p>
                )}
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <div className="text-xs text-slate-400">Signature &amp; Date: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              {/* Authorized By */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Authorized By</div>
                <div
                  className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center"
                  style={{ height: 96 }}
                >
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-600">{project.company_name || 'Company Representative'}</div>
                    <div className="text-xs text-slate-400 mt-0.5">Contractor</div>
                  </div>
                </div>
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <div className="text-xs text-slate-400">{project.company_name || 'Authorized Representative'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Signature Block (approved state) ── */}
        {(isApproved || submitted) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Client Signature</div>
                <div className="border-b-2 border-slate-300 mb-2 pb-6" />
                <div className="text-xs text-slate-400">Signature &amp; Date</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Authorized By</div>
                <div className="border-b-2 border-slate-300 mb-2 pb-6" />
                <div className="text-xs text-slate-400">{project.company_name || 'Company Representative'}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Action Buttons ── (AFTER signature) */}
        {!submitted && !isApproved && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Your Response</h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                id="approve-bid-btn"
                onClick={() => setAction(action === 'approve' ? null : 'approve')}
                className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                  action === 'approve'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                ✅ Approve This Bid
              </button>
              <button
                id="request-changes-btn"
                onClick={() => setAction(action === 'changes' ? null : 'changes')}
                className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                  action === 'changes'
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200'
                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}
              >
                ✏️ Request Changes
              </button>
            </div>

            {action && (
              <div className="space-y-3">
                {action === 'approve' && !signatureDataUrl && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <span className="text-amber-500 mt-0.5">⚠️</span>
                    <p className="text-xs text-amber-700">
                      Please scroll up and sign the proposal above before confirming approval.
                    </p>
                  </div>
                )}
                {action === 'approve' && signatureDataUrl && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <span className="text-emerald-500">✅</span>
                    <p className="text-xs text-emerald-700 font-medium">Signature captured. You're ready to approve.</p>
                  </div>
                )}
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  placeholder={
                    action === 'approve'
                      ? 'Optional: Add a message for the contractor...'
                      : 'Describe the changes you need... (required)'
                  }
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-copper-200 focus:border-copper-400 resize-none transition-all"
                />
                <button
                  id="submit-response-btn"
                  onClick={action === 'approve' ? handleApprove : handleRequestChanges}
                  disabled={submitting}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-50 ${
                    action === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                      : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200'
                  }`}
                >
                  {submitting
                    ? 'Submitting…'
                    : action === 'approve'
                    ? 'Confirm Approval'
                    : 'Send Changes Request'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ background: '#0A1024' }} className="rounded-2xl px-6 py-4 text-center">
          <div className="text-slate-400 text-xs">
            {project.company_name} · Powered by PeakEstimator · {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}

function getCategoryClass(category: string): string {
  const map: Record<string, string> = {
    material: 'category-material',
    labor: 'category-labor',
    equipment: 'category-equipment',
    other: 'category-other',
  };
  return map[category] || 'category-other';
}
