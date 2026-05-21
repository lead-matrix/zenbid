import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../api/supabase';
import { calcTotals, formatCurrency, calcFinancing, formatMonthly } from '../lib/pricingEngine';
import MultiOptionTiers from '../components/estimator/MultiOptionTiers';
import type { Project, ProjectItem } from '../types';
import { TRADE_EMOJIS } from '../types';
import { toast } from 'sonner';
import { eventBus } from '../lib/eventBus';

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
      ctx.strokeStyle = document.documentElement.classList.contains('dark') ? '#C58B5C' : '#1E293B';
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
          signed 
            ? 'border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/20' 
            : 'border-dashed border-slate-300 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/40'
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
            <span className="text-xs text-slate-400 dark:text-slate-500 select-none">✍️ Sign here</span>
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

  const [financingRate, setFinancingRate] = useState(9.99);
  const [financingMonths, setFinancingMonths] = useState(60);
  const [financingMinAmount, setFinancingMinAmount] = useState(1000);
  const [financingTerm, setFinancingTerm] = useState(60);

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
      
      // Fetch system settings for financing defaults
      try {
        const { data: sysSettings } = await supabase
          .from('system_settings')
          .select('*')
          .single();
        if (sysSettings) {
          setFinancingRate(sysSettings.financing_interest_rate ?? 9.99);
          const maxTerm = sysSettings.financing_max_term_months ?? 60;
          setFinancingMonths(maxTerm);
          setFinancingTerm(maxTerm); // Default to max term
          setFinancingMinAmount(sysSettings.financing_min_amount ?? 1000);
        }
      } catch (err) {
        console.error('Failed to load system settings financing defaults', err);
      }

      // Trigger proposal viewed event
      eventBus.emit('proposal.viewed', { 
        projectId: proj.id, 
        viewedAt: new Date().toISOString() 
      }).catch(err => console.warn('[ClientPortal] Failed to emit viewed event:', err));
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
      
      // Trigger proposal approved event to halt automated follow-up campaigns
      eventBus.emit('proposal.approved', {
        projectId: project.id,
        approvedAt: new Date().toISOString(),
        signatureData: signatureDataUrl,
        selectedTier: project.selected_option_tier || 'base'
      }).catch(err => console.warn('[ClientPortal] Failed to emit approved event:', err));
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

  const activeTier = project?.selected_option_tier || 'better';

  const visibleItems = project?.is_multi_option
    ? items.filter(item => !item.option_tier || item.option_tier === 'base' || item.option_tier === activeTier)
    : items;

  const totals = calcTotals(visibleItems, project.labor_markup, project.material_markup, project.equipment_markup, project.tax_rate);
  const isApproved = !!project.client_approved_at;

  const handleSelectTier = async (tier: 'good' | 'better' | 'best') => {
    if (!project || isApproved) return;
    
    setProject(prev => prev ? { ...prev, selected_option_tier: tier } : null);

    const { error } = await supabase
      .from('projects')
      .update({
        selected_option_tier: tier,
        updated_at: new Date().toISOString(),
      })
      .eq('share_token', shareToken);

    if (error) {
      console.error('Error selecting tier:', error);
      toast.error('Failed to save your package selection.');
    } else {
      toast.success(`Package updated to ${tier.toUpperCase()}!`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-navy-950 font-inter text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* ── Header ── */}
      <div className="w-full bg-navy-900 dark:bg-navy-950 border-b border-navy-800 dark:border-navy-900 transition-colors">
        <div className="max-w-4xl mx-auto px-8 py-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {project.company_logo ? (
              <img src={project.company_logo} alt="Company logo" className="w-14 h-14 object-contain rounded-xl bg-white p-1.5 shadow-sm" />
            ) : (
              <div className="w-14 h-14 bg-navy-800 dark:bg-navy-900 border border-navy-700/50 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl font-sora">
                  {(project.company_name || 'C').charAt(0)}
                </span>
              </div>
            )}
            <div>
              <div className="text-white font-bold text-xl font-sora">{project.company_name || 'Your Company'}</div>
              <div className="text-slate-400 text-sm mt-0.5 font-medium">
                {project.company_email} {project.company_phone && `· ${project.company_phone}`}
              </div>
            </div>
          </div>
          <div className="text-left">
            <div className="text-2xl font-bold font-sora tracking-wide text-copper">PROPOSAL</div>
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
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800 transition-colors">
        <div className="max-w-4xl mx-auto px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Prepared For</div>
            <div className="text-xl font-bold font-sora text-slate-900 dark:text-white">{project.client_name}</div>
            {project.client_email && <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{project.client_email}</div>}
            {project.client_phone && <div className="text-sm text-slate-500 dark:text-slate-400">{project.client_phone}</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Project Details</div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{TRADE_EMOJIS[project.trade]}</span>
              <span className="text-xl font-bold font-sora text-slate-900 dark:text-white">{project.name}</span>
            </div>
            {project.project_address && <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{project.project_address}</div>}
            {project.start_date && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Start: {new Date(project.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* ── Already approved banner ── */}
        {isApproved && (
          <div className="bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/65 rounded-2xl px-6 py-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <div className="text-emerald-800 dark:text-emerald-300 font-bold text-sm font-sora animate-fade-in">This proposal has been approved</div>
              <div className="text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                Approved on {new Date(project.client_approved_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        )}

        {/* ── Submitted confirmation ── */}
        {submitted && (
          <div className="bg-copper-50/30 dark:bg-copper-950/10 border border-copper-200 dark:border-copper-800/80 rounded-2xl px-6 py-5 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <div className="text-copper font-bold font-sora">
              {action === null ? 'Response submitted!' : 'Message sent!'}
            </div>
            <div className="text-slate-600 dark:text-slate-300 text-sm mt-1">
              {project.company_name || 'The contractor'} has been notified and will be in touch shortly.
            </div>
          </div>
        )}

        {project.is_multi_option && (
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-6 transition-colors">
            <MultiOptionTiers
              items={items}
              laborMarkup={project.labor_markup}
              materialMarkup={project.material_markup}
              equipmentMarkup={project.equipment_markup}
              taxRate={project.tax_rate}
              financingRate={financingRate}
              financingMonths={financingMonths}
              financingMinAmount={financingMinAmount}
              selectedTier={project.selected_option_tier as 'good' | 'better' | 'best'}
              onSelectTier={handleSelectTier}
            />
          </div>
        )}

        {/* ── Line Items ── */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-800 shadow-soft bg-white dark:bg-navy-900 transition-colors scrollbar-thin">
          <div className="min-w-[850px] divide-y divide-slate-100 dark:divide-navy-800/50">
            <div className="bg-slate-900 dark:bg-navy-950 px-5 py-3.5 grid grid-cols-12 gap-2">
              <div className="col-span-5 text-xs font-bold text-slate-300 dark:text-slate-400 uppercase tracking-wider">Description</div>
              <div className="col-span-2 text-xs font-bold text-slate-300 dark:text-slate-400 uppercase tracking-wider">Category</div>
              <div className="col-span-1 text-xs font-bold text-slate-300 dark:text-slate-400 uppercase tracking-wider text-center">Qty</div>
              <div className="col-span-1 text-xs font-bold text-slate-300 dark:text-slate-400 uppercase tracking-wider text-center">Unit</div>
              <div className="col-span-1 text-xs font-bold text-slate-300 dark:text-slate-400 uppercase tracking-wider text-right">Unit Price</div>
              <div className="col-span-2 text-xs font-bold text-slate-300 dark:text-slate-400 uppercase tracking-wider text-right">Total</div>
            </div>

            {visibleItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">No line items in this proposal</div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-navy-800/30">
                {visibleItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center ${i % 2 === 0 ? 'bg-white dark:bg-navy-900' : 'bg-slate-50/20 dark:bg-navy-950/10'}`}
                  >
                    <div className="col-span-5 text-sm text-slate-800 dark:text-slate-200 font-medium">{item.description || '—'}</div>
                    <div className="col-span-2">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getCategoryClass(item.category)}`}>
                        {item.category}
                      </span>
                    </div>
                    <div className="col-span-1 text-sm text-slate-600 dark:text-slate-400 text-center">{item.quantity}</div>
                    <div className="col-span-1 text-sm text-slate-500 dark:text-slate-500 text-center">{item.unit}</div>
                    <div className="col-span-1 text-sm text-slate-700 dark:text-slate-300 text-right">${item.unit_price.toFixed(2)}</div>
                    <div className="col-span-2 text-sm font-bold text-slate-900 dark:text-white text-right">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Totals ── */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between py-2 px-4 bg-slate-100 dark:bg-navy-950/40 rounded-xl transition-colors">
              <span className="text-sm text-slate-600 dark:text-slate-400">Subtotal</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.marginAmount > 0 && (
              <div className="flex justify-between py-2 px-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-100 dark:border-navy-800 transition-colors">
                <span className="text-sm text-slate-500 dark:text-slate-400">Overhead &amp; Profit</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatCurrency(totals.marginAmount)}</span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex justify-between py-2 px-4 bg-slate-100 dark:bg-navy-950/40 rounded-xl transition-colors">
                <span className="text-sm text-slate-500 dark:text-slate-400">Tax</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatCurrency(totals.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between py-3.5 px-4 bg-navy-900 dark:bg-navy-800 border border-navy-800 dark:border-navy-700 rounded-xl shadow-sm transition-colors">
              <span className="text-sm font-bold text-white uppercase tracking-wider">TOTAL VALUE</span>
              <span className="text-lg font-bold text-copper">{formatCurrency(totals.total)}</span>
            </div>
            {totals.total >= financingMinAmount && (
              <div className="p-4 bg-gradient-to-br from-amber-500/5 to-copper/5 dark:from-navy-950 dark:to-navy-900/60 rounded-xl border border-copper/15 dark:border-navy-800 flex flex-col gap-2.5 animate-fade-in mt-2 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-sora text-copper uppercase tracking-wider">
                    💳 Low-Rate Financing Option
                  </span>
                  <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                    {financingRate}% APR
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-inter text-slate-500 dark:text-slate-400">Estimated payment:</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white font-sora">
                    {formatMonthly(calcFinancing({ principal: totals.total, annualInterestRate: financingRate, termMonths: financingTerm }).monthlyPayment)}
                  </span>
                </div>

                {/* Term Selection Toggle */}
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-navy-850 pt-2.5 mt-1">
                  <span className="text-[10px] text-slate-400 font-inter font-medium">Choose duration term:</span>
                  <div className="flex gap-1 bg-slate-100 dark:bg-navy-950 p-0.5 rounded-lg border border-slate-200/50 dark:border-navy-800">
                    {[36, 60, 120, 180, 240].filter(t => t <= financingMonths).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFinancingTerm(t)}
                        className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                          financingTerm === t
                            ? 'bg-white dark:bg-navy-800 text-slate-800 dark:text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-650'
                        }`}
                      >
                        {t} mo
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Notes ── */}
        {project.notes && (
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-6 transition-colors">
            <h3 className="text-sm font-bold font-sora text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">Notes &amp; Scope of Work</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{project.notes}</p>
          </div>
        )}

        {/* ── Signature Block ── PLACED BEFORE action buttons ── */}
        {!isApproved && !submitted && (
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-6 transition-colors">
            <h3 className="text-sm font-bold font-sora text-slate-800 dark:text-white mb-1 uppercase tracking-wider">Signatures</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">By signing, you acknowledge and agree to the terms of this proposal.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Client Signature */}
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                  Client Signature
                  {action === 'approve' && (
                    <span className="ml-1.5 text-red-550 dark:text-red-400 font-semibold">*required</span>
                  )}
                </div>
                <SignaturePad
                  onSign={(url) => { setSignatureDataUrl(url); setSignatureError(false); }}
                  onClear={() => setSignatureDataUrl(null)}
                  signed={!!signatureDataUrl}
                />
                {signatureError && (
                  <p className="text-xs text-red-505 mt-1.5 font-medium animate-pulse">Please sign before approving.</p>
                )}
                <div className="mt-2 border-t border-slate-100 dark:border-navy-800 pt-2.5">
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">Signature &amp; Date: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              {/* Authorized By */}
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">Authorized By</div>
                <div
                  className="rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-850 bg-slate-50 dark:bg-navy-950/40 flex items-center justify-center transition-colors"
                  style={{ height: 96 }}
                >
                  <div className="text-center p-4">
                    <div className="text-sm font-bold text-slate-600 dark:text-slate-350 font-sora truncate max-w-[250px]">{project.company_name || 'Company Representative'}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider font-bold">Contractor Representative</div>
                  </div>
                </div>
                <div className="mt-2 border-t border-slate-100 dark:border-navy-800 pt-2.5">
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">{project.company_name || 'Authorized Representative'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Signature Block (approved state) ── */}
        {(isApproved || submitted) && (
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-6 transition-colors">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Client Signature</div>
                {project.signature_data ? (
                  <div className="border border-slate-150 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 rounded-xl p-2 flex items-center justify-center animate-fade-in" style={{ height: 96 }}>
                    <img src={project.signature_data} alt="Client Signature" className="max-h-full dark:invert transition-colors" />
                  </div>
                ) : (
                  <div className="border-b border-slate-300 dark:border-navy-800 mb-2 pb-6" />
                )}
                <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-2">
                  Signature &amp; Date: {project.client_approved_at ? new Date(project.client_approved_at).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Authorized By</div>
                <div className="border-b-2 border-slate-200 dark:border-navy-800 mb-2 pb-6 flex items-end justify-center" style={{ height: 96 }}>
                  <span className="text-slate-500 dark:text-slate-400 font-sora font-semibold text-sm italic mb-2">
                    {project.company_name || 'Authorized Representative'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-2">{project.company_name || 'Company Representative'}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Action Buttons ── (AFTER signature) */}
        {!submitted && !isApproved && (
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-6 space-y-4 transition-colors">
            <h3 className="text-sm font-bold font-sora text-slate-800 dark:text-white uppercase tracking-wider">Your Response</h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                id="approve-bid-btn"
                onClick={() => setAction(action === 'approve' ? null : 'approve')}
                className={`py-3.5 rounded-xl text-sm font-bold transition-all border flex items-center justify-center gap-2 ${
                  action === 'approve'
                    ? 'bg-emerald-650 border-emerald-600 hover:bg-emerald-705 text-white shadow-sm'
                    : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
                }`}
              >
                Approve Proposal
              </button>
              <button
                id="request-changes-btn"
                onClick={() => setAction(action === 'changes' ? null : 'changes')}
                className={`py-3.5 rounded-xl text-sm font-bold transition-all border flex items-center justify-center gap-2 ${
                  action === 'changes'
                    ? 'bg-amber-500 border-amber-500 hover:bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                }`}
              >
                Request Changes
              </button>
            </div>

            {action && (
              <div className="space-y-3 animate-fade-in">
                {action === 'approve' && !signatureDataUrl && (
                  <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl px-4 py-3">
                    <span className="text-amber-500 mt-0.5">⚠️</span>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Please scroll up and sign the proposal in the "Signatures" section before confirming approval.
                    </p>
                  </div>
                )}
                {action === 'approve' && signatureDataUrl && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/65 rounded-xl px-4 py-3">
                    <span className="text-emerald-500">✅</span>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold animate-fade-in">Signature captured. You are ready to approve.</p>
                  </div>
                )}
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  placeholder={
                    action === 'approve'
                      ? 'Optional: Add a note or reference number for the contractor...'
                      : 'Describe the modifications or questions you have... (required)'
                  }
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:border-copper focus:ring-1 focus:ring-copper/40 resize-none transition-all"
                />
                <button
                  id="submit-response-btn"
                  onClick={action === 'approve' ? handleApprove : handleRequestChanges}
                  disabled={submitting}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-50 ${
                    action === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {submitting
                    ? 'Submitting…'
                    : action === 'approve'
                    ? 'Confirm Approval'
                    : 'Submit Changes Request'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="bg-navy-900 dark:bg-navy-950 border border-navy-800 dark:border-navy-900 rounded-2xl px-6 py-4 text-center transition-colors">
          <div className="text-slate-400 dark:text-slate-500 text-xs font-semibold">
            {project.company_name} · Powered by ZenBid · {new Date().getFullYear()}
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
