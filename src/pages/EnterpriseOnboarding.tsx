import { useState, useEffect } from 'react';
import {
  CheckCircle2, Circle, ChevronDown, AlertCircle,
  Building2, Zap, Mail, Globe, CreditCard, Users, Smartphone,
  Star, FileText, Shield, Landmark, Download, Send, Lock,
  UploadCloud, ExternalLink, Copy, Check, Clock, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../api/supabase';

// ─── Types ──────────────────────────────────────────────────────
interface AccessItem {
  id: string;
  label: string;
  description: string;
  howToGet?: string;
  required: boolean;
  type: 'file' | 'text' | 'dns' | 'oauth' | 'info' | 'email';
  placeholder?: string;
}

interface OnboardingSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  plans: ('pro' | 'enterprise' | 'white_glove')[];
  items: AccessItem[];
  durationEstimate: string;
}

// ─── Onboarding data ──────────────────────────────────────────
const SECTIONS: OnboardingSection[] = [
  {
    id: 'identity',
    title: 'Company Identity & Brand',
    icon: Building2,
    color: 'text-copper',
    plans: ['pro', 'enterprise', 'white_glove'],
    durationEstimate: '10 min',
    items: [
      { id: 'company_name', label: 'Legal Company Name', description: 'As it appears on your license and contracts. Used on proposal headers, emails, and client-facing documents.', required: true, type: 'text', placeholder: 'e.g. Apex Roofing & Contracting LLC' },
      { id: 'company_email', label: 'Business Email Address', description: 'Proposals and follow-up emails are sent from this address (or our branded sender on your behalf).', required: true, type: 'email', placeholder: 'ops@yourcompany.com' },
      { id: 'company_phone', label: 'Company Phone Number', description: 'Shown on proposals and client portal footer.', required: true, type: 'text', placeholder: '(555) 000-0000' },
      { id: 'trade_license', label: 'License / Contractor Number', description: 'Displayed on PDF proposals for credibility and legal compliance. E.g. "License #EC-88234".', required: false, type: 'text', placeholder: 'e.g. License #EC-88234' },
      { id: 'logo', label: 'Company Logo', description: 'PNG, SVG, or JPG — minimum 400×400px, transparent background preferred. Paste a URL or describe your logo.', howToGet: 'Export from Canva, your designer, or your website assets.', required: true, type: 'file', placeholder: 'Paste logo URL or describe (e.g. "sending via email")' },
      { id: 'brand_colors', label: 'Brand Color Codes', description: 'Primary and secondary hex codes for your client portal and proposal theme.', howToGet: 'Pull from your website CSS or ask your designer.', required: false, type: 'text', placeholder: 'e.g. #C87941 (primary), #1A2B4A (secondary)' },
      { id: 'terms_text', label: 'Proposal Terms & Conditions', description: 'The legal text shown below the digital signature block. Paste your own or confirm you\'ll use our default.', required: false, type: 'text', placeholder: 'Paste custom T&C or type "use default"' },
    ],
  },
  {
    id: 'ai',
    title: 'AI Scope Assistant Setup',
    icon: Zap,
    color: 'text-violet-400',
    plans: ['pro', 'enterprise', 'white_glove'],
    durationEstimate: '5 min',
    items: [
      { id: 'trade_types', label: 'Your Trade Specialties', description: 'List all trades you estimate for. The AI tailors scope suggestions to your trade.', required: true, type: 'text', placeholder: 'e.g. Electrical, Roofing, HVAC, General Contracting' },
      { id: 'scope_samples', label: '3–5 Sample Scope Descriptions', description: 'Paste examples of how you currently describe jobs. The AI learns your language and style.', howToGet: 'Pull from past proposals or emails to clients.', required: false, type: 'text', placeholder: 'Paste sample job descriptions here...' },
      { id: 'ai_consent', label: 'AI Usage Authorization', description: 'You authorize PeakEstimator to process your job descriptions through our AI system to generate scope suggestions. No data is sold or shared.', required: true, type: 'info', placeholder: 'Type "I authorize" to confirm' },
    ],
  },
  {
    id: 'email',
    title: 'Email & Follow-Up Automation',
    icon: Mail,
    color: 'text-blue-400',
    plans: ['pro', 'enterprise', 'white_glove'],
    durationEstimate: '15 min',
    items: [
      { id: 'sender_preference', label: 'Email Sender Preference', description: 'Choose: (A) Use our shared sender — proposals@peakestimator.com, or (B) Send from your own domain.', required: true, type: 'text', placeholder: 'Type A or B' },
      { id: 'custom_domain_email', label: 'Custom Sending Domain (if option B)', description: 'We add SPF + DKIM DNS records to your domain so emails arrive in inbox, not spam.', howToGet: 'Log into your domain registrar and be ready to add TXT/CNAME records.', required: false, type: 'dns', placeholder: 'e.g. mail.yourcompany.com' },
      { id: 'unsubscribe_address', label: 'Unsubscribe / Reply-To Address', description: 'Where client replies and unsubscribes are routed.', required: true, type: 'email', placeholder: 'e.g. info@yourcompany.com' },
      { id: 'email_consent', label: 'Email Sending Authorization', description: 'You authorize PeakEstimator to send proposal delivery, follow-up, and approval notification emails on your behalf to your clients.', required: true, type: 'info', placeholder: 'Type "I authorize" to confirm' },
    ],
  },
  {
    id: 'portal',
    title: 'Custom Client Portal Domain',
    icon: Globe,
    color: 'text-emerald-400',
    plans: ['enterprise', 'white_glove'],
    durationEstimate: '20 min',
    items: [
      { id: 'subdomain', label: 'Your Subdomain Choice', description: 'The URL your clients visit to review and sign proposals. Format: proposals.yourcompany.com', howToGet: 'Pick your preferred subdomain — you\'ll add a CNAME record in your DNS panel.', required: true, type: 'text', placeholder: 'e.g. proposals.yourcompany.com' },
      { id: 'cname_setup', label: 'CNAME DNS Record Confirmation', description: 'Add CNAME → portals.peakestimator.app in your DNS panel. Confirm once done.', howToGet: 'GoDaddy / Cloudflare / Namecheap → DNS settings → Add CNAME.', required: true, type: 'dns', placeholder: 'Type "done" or describe your DNS provider' },
      { id: 'portal_tagline', label: 'Portal Tagline', description: 'Short line shown under your logo on the portal. E.g. "Licensed & Insured since 2008."', required: false, type: 'text', placeholder: 'e.g. Professional Electrical Services — Licensed & Insured' },
    ],
  },
  {
    id: 'payments',
    title: 'Stripe Payment Collection',
    icon: CreditCard,
    color: 'text-amber-400',
    plans: ['enterprise', 'white_glove'],
    durationEstimate: '20 min',
    items: [
      { id: 'stripe_account', label: 'Stripe Account Status', description: 'You need a Stripe account (free). Funds deposit directly to your bank — PeakEstimator never touches your money.', howToGet: 'Go to stripe.com → Create account → Complete business verification (5–10 min).', required: true, type: 'oauth', placeholder: 'Type "created" or paste your Stripe account ID' },
      { id: 'stripe_publishable', label: 'Stripe Publishable Key', description: 'Found in Stripe Dashboard → Developers → API Keys. Starts with pk_live_...', howToGet: 'Stripe Dashboard → Developers → API Keys → Publishable key.', required: true, type: 'text', placeholder: 'pk_live_...' },
      { id: 'stripe_restricted', label: 'Stripe Restricted API Key', description: 'Create a restricted key with: Payment Links (write), Checkout Sessions (write), Customers (read/write).', howToGet: 'Stripe Dashboard → Developers → API Keys → Create restricted key.', required: true, type: 'text', placeholder: 'rk_live_...' },
      { id: 'deposit_amounts', label: 'Default Deposit Percentages', description: 'What % deposit do you collect upfront? E.g. "30% on signing, 40% at rough-in, 30% on completion."', required: true, type: 'text', placeholder: 'e.g. 30% upfront, 70% on completion' },
    ],
  },
  {
    id: 'team',
    title: 'Team & Multi-User Setup',
    icon: Users,
    color: 'text-rose-400',
    plans: ['enterprise', 'white_glove'],
    durationEstimate: '10 min',
    items: [
      { id: 'team_emails', label: 'Team Member Emails & Roles', description: 'List all staff who need access. Roles: Admin, Estimator, Viewer, Sales Manager.', required: true, type: 'email', placeholder: 'e.g. john@co.com (Estimator), sarah@co.com (Admin)' },
      { id: 'team_consent', label: 'Team Invitation Authorization', description: 'You authorize PeakEstimator to send invitation emails to the team members you listed.', required: true, type: 'info', placeholder: 'Type "I authorize" to confirm' },
    ],
  },
  {
    id: 'sms',
    title: 'SMS & WhatsApp Delivery',
    icon: Smartphone,
    color: 'text-teal-400',
    plans: ['white_glove'],
    durationEstimate: '15 min',
    items: [
      { id: 'twilio_account', label: 'Twilio Account or Phone Number', description: 'For sending proposals and follow-ups via SMS/WhatsApp. We can provision a number for you.', howToGet: 'Go to twilio.com → Create account → Get a phone number.', required: false, type: 'oauth', placeholder: 'Paste Twilio number or type "provision for me"' },
      { id: 'sms_consent', label: 'SMS Sending Authorization', description: 'You authorize PeakEstimator to send SMS/WhatsApp messages to your clients on your behalf.', required: true, type: 'info', placeholder: 'Type "I authorize" to confirm' },
    ],
  },
  {
    id: 'concierge',
    title: 'Custom Requirements & Special Requests',
    icon: Star,
    color: 'text-amber-400',
    plans: ['pro', 'enterprise', 'white_glove'],
    durationEstimate: '5 min',
    items: [
      { id: 'custom_requirements', label: 'Custom Features or Integrations Needed', description: 'Anything not covered above — custom reporting, QuickBooks sync, specific workflows, white-label requirements, etc.', required: false, type: 'text', placeholder: 'Describe any custom requirements, integrations, or special setup needs...' },
      { id: 'go_live_date', label: 'Target Go-Live Date', description: 'When do you need to be fully operational? Helps us prioritize your setup queue.', required: false, type: 'text', placeholder: 'e.g. June 15, 2026 or "ASAP"' },
      { id: 'priority_feature', label: 'Most Important Feature for Day 1', description: 'What\'s the #1 thing you need working on launch day?', required: false, type: 'text', placeholder: 'e.g. "PDF proposals with digital signatures"' },
    ],
  },
];

const PLAN_META = {
  pro:          { label: 'Pro',          price: '$97/mo',    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
  enterprise:   { label: 'Enterprise',   price: '$297/mo',   color: 'text-copper',     bg: 'bg-copper/10 border-copper/30' },
  white_glove:  { label: 'White Glove',  price: 'Custom',    color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
};

// ─── Component ──────────────────────────────────────────────────
export default function EnterpriseOnboarding() {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise' | 'white_glove'>('enterprise');
  const [expanded, setExpanded]         = useState<string[]>(['identity']);
  const [responses, setResponses]       = useState<Record<string, string>>({});
  const [completed, setCompleted]       = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [saving, setSaving]             = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [userId, setUserId]             = useState<string | null>(null);

  // Load existing responses on mount
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from('onboarding_responses')
        .select('*')
        .eq('user_id', user.id);

      if (data && data.length > 0) {
        const resMap: Record<string, string> = {};
        const doneSet = new Set<string>();
        data.forEach((r: any) => {
          resMap[r.item_id] = r.response_text || '';
          if (r.is_completed) doneSet.add(r.item_id);
        });
        setResponses(resMap);
        setCompleted(doneSet);
      }
    };
    load();
  }, []);

  const visibleSections  = SECTIONS.filter(s => s.plans.includes(selectedPlan));
  const allRequiredItems = visibleSections.flatMap(s => s.items.filter(i => i.required));
  const completedRequired = allRequiredItems.filter(i => completed.has(i.id)).length;
  const progressPct       = allRequiredItems.length > 0
    ? Math.round((completedRequired / allRequiredItems.length) * 100) : 0;

  const toggle  = (id: string) => setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveItem = async (section: OnboardingSection, item: AccessItem, text: string, isDone: boolean) => {
    if (!userId) return;
    setSaving(item.id);
    try {
      await supabase.from('onboarding_responses').upsert({
        user_id:      userId,
        section_id:   section.id,
        item_id:      item.id,
        item_label:   item.label,
        response_text: text,
        is_completed: isDone,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'user_id,item_id' });
    } catch (e) {
      console.error('save error', e);
    } finally {
      setSaving(null);
    }
  };

  const handleResponseChange = (item: AccessItem, section: OnboardingSection, value: string) => {
    setResponses(prev => ({ ...prev, [item.id]: value }));
  };

  const handleMarkDone = async (section: OnboardingSection, item: AccessItem) => {
    const text = responses[item.id] || '';
    const isDone = !completed.has(item.id);
    setCompleted(prev => {
      const next = new Set(prev);
      isDone ? next.add(item.id) : next.delete(item.id);
      return next;
    });
    await saveItem(section, item, text, isDone);
  };

  const handleBlurSave = async (section: OnboardingSection, item: AccessItem) => {
    const text = responses[item.id] || '';
    if (!text) return;
    await saveItem(section, item, text, completed.has(item.id));
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied!');
  };

  const handleSubmitRequest = async () => {
    if (!userId) { toast.error('Please log in first.'); return; }
    setSubmitting(true);
    try {
      // Save all filled responses one final time
      const allItems = SECTIONS.flatMap(s => s.items);
      const upserts = allItems
        .filter(item => responses[item.id])
        .map(item => {
          const section = SECTIONS.find(s => s.items.find(i => i.id === item.id))!;
          return {
            user_id:      userId,
            section_id:   section.id,
            item_id:      item.id,
            item_label:   item.label,
            response_text: responses[item.id],
            is_completed: completed.has(item.id),
            updated_at:   new Date().toISOString(),
          };
        });

      if (upserts.length > 0) {
        await supabase.from('onboarding_responses').upsert(upserts, { onConflict: 'user_id,item_id' });
      }

      // Mark profile as concierge requested
      await supabase.from('profiles').update({
        concierge_requested: true,
        onboarding_completed: completedRequired === allRequiredItems.length,
        concierge_details: {
          submitted_at: new Date().toISOString(),
          plan: selectedPlan,
          completed_required: completedRequired,
          total_required: allRequiredItems.length,
        }
      }).eq('id', userId);

      setSubmitted(true);
      toast.success('Onboarding request submitted! Your success manager will reach out within 1 business day.');
    } catch (err: any) {
      toast.error('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const typeConfig: Record<string, { icon: React.ComponentType<any>; badge: string; color: string }> = {
    file:  { icon: UploadCloud,  badge: 'File / URL',    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    text:  { icon: FileText,     badge: 'Text / Info',   color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
    dns:   { icon: Globe,        badge: 'DNS Change',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    oauth: { icon: ExternalLink, badge: 'OAuth / API',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    info:  { icon: Shield,       badge: 'Authorization', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    email: { icon: Mail,         badge: 'Email Address', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-navy-900 to-slate-900 text-white font-inter">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-copper to-amber-500 flex items-center justify-center shadow-lg shadow-copper/30">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/90">PeakEstimator</p>
              <p className="text-[10px] text-white/40">Enterprise Onboarding & Setup Guide</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-copper transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-xs font-bold text-copper">{progressPct}% complete</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Plan selector */}
        <div>
          <h1 className="font-sora font-extrabold text-2xl text-white mb-2">Setup Your PeakEstimator Workspace</h1>
          <p className="text-white/50 text-sm mb-6">Fill in your details below. Your progress saves automatically — come back anytime.</p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(PLAN_META) as Array<keyof typeof PLAN_META>).map(plan => {
              const m = PLAN_META[plan];
              return (
                <button
                  key={plan}
                  onClick={() => setSelectedPlan(plan)}
                  className={`px-5 py-2.5 rounded-xl border text-xs font-bold transition-all ${selectedPlan === plan ? m.bg + ' ' + m.color : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                >
                  {m.label} <span className="opacity-60 ml-1">{m.price}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress summary */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-black text-copper">{completedRequired}</div>
            <div className="text-[10px] text-white/40 uppercase font-bold">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-white">{allRequiredItems.length}</div>
            <div className="text-[10px] text-white/40 uppercase font-bold">Required</div>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-copper to-amber-400 transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-white/40 mt-1.5">
              {progressPct === 100 ? '✓ All required items complete — ready to submit!' : `${allRequiredItems.length - completedRequired} required items remaining`}
            </p>
          </div>
        </div>

        {/* Sections */}
        {visibleSections.map(section => {
          const SectionIcon = section.icon;
          const isExpanded  = expanded.includes(section.id);
          const sectionItems = section.items;
          const sectionDone  = sectionItems.filter(i => completed.has(i.id)).length;
          const sectionTotal = sectionItems.length;

          return (
            <div key={section.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* Section header */}
              <button
                className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition-colors text-left"
                onClick={() => toggle(section.id)}
              >
                <div className={`w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0`}>
                  <SectionIcon className={`w-4 h-4 ${section.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{section.title}</span>
                    <span className="text-[9px] font-bold bg-white/10 text-white/40 px-2 py-0.5 rounded uppercase">{section.durationEstimate}</span>
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">{sectionDone}/{sectionTotal} items addressed</div>
                </div>
                <div className="flex items-center gap-3">
                  {sectionDone === sectionTotal && sectionTotal > 0 && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Done</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Items */}
              {isExpanded && (
                <div className="border-t border-white/10 divide-y divide-white/5">
                  {sectionItems.map(item => {
                    const tc        = typeConfig[item.type];
                    const TypeIcon  = tc.icon;
                    const isDone    = completed.has(item.id);
                    const isSaving  = saving === item.id;
                    const response  = responses[item.id] || '';

                    return (
                      <div key={item.id} className={`p-5 transition-colors ${isDone ? 'bg-emerald-950/20' : ''}`}>
                        <div className="flex items-start gap-4">
                          {/* Done toggle */}
                          <button
                            onClick={() => handleMarkDone(section, item)}
                            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 hover:border-emerald-400'}`}
                          >
                            {isDone && <Check className="w-3 h-3 text-white" />}
                          </button>

                          <div className="flex-1 space-y-3">
                            {/* Label row */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`font-bold text-sm ${isDone ? 'text-white/60 line-through' : 'text-white'}`}>{item.label}</span>
                              {item.required
                                ? <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded uppercase">Required</span>
                                : <span className="text-[9px] font-black text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase">Optional</span>
                              }
                              <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border ${tc.color}`}>
                                <TypeIcon className="w-2.5 h-2.5" />{tc.badge}
                              </span>
                              {isSaving && <span className="text-[9px] text-white/30 italic">saving…</span>}
                            </div>

                            <p className="text-xs text-white/50 leading-relaxed">{item.description}</p>

                            {item.howToGet && (
                              <div className="flex items-start gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                                <AlertCircle className="w-3.5 h-3.5 text-copper flex-shrink-0 mt-0.5" />
                                <p className="text-[11px] text-copper/80 leading-relaxed">
                                  <span className="font-bold text-copper">How to get it: </span>{item.howToGet}
                                </p>
                              </div>
                            )}

                            {/* Response input */}
                            {!isDone && (
                              <textarea
                                rows={item.type === 'text' && item.id.includes('sample') ? 4 : 2}
                                value={response}
                                onChange={e => handleResponseChange(item, section, e.target.value)}
                                onBlur={() => handleBlurSave(section, item)}
                                placeholder={item.placeholder || 'Enter your response…'}
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-copper transition-all resize-none"
                              />
                            )}

                            {isDone && response && (
                              <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-xs text-emerald-300/70 italic">
                                "{response.length > 120 ? response.slice(0, 120) + '…' : response}"
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Submit */}
        <div className="bg-gradient-to-r from-copper/10 to-amber-500/5 border border-copper/30 rounded-2xl p-6">
          {submitted ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-sora font-bold text-white text-lg">Onboarding Request Submitted!</h3>
              <p className="text-white/50 text-sm">Your success manager will reach out within 1 business day. You can return here anytime to update your responses.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-sm">Ready to submit?</h3>
                <p className="text-white/40 text-xs mt-1">
                  {completedRequired < allRequiredItems.length
                    ? `${allRequiredItems.length - completedRequired} required item(s) still need your input — but you can submit now and update later.`
                    : 'All required items are complete. Submit to notify your success manager.'}
                </p>
              </div>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className="flex-shrink-0 px-6 py-3 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md disabled:opacity-60"
              >
                {submitting ? (
                  <><Clock className="w-4 h-4 animate-spin" /> Submitting…</>
                ) : (
                  <><Send className="w-4 h-4" /> Submit Onboarding Request</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Security note */}
        <div className="bg-violet-950/30 border border-violet-500/20 rounded-2xl p-5">
          <h3 className="font-bold text-white text-xs flex items-center gap-2 mb-2"><Lock className="w-3.5 h-3.5 text-violet-400" /> Security Note</h3>
          <p className="text-[11px] text-white/40 leading-relaxed">All responses are encrypted at rest. API keys entered here are stored in our Supabase Vault — never in plain text. We never store your Stripe secret key — only restricted keys. Your data is never sold or shared with third parties.</p>
        </div>

      </div>
    </div>
  );
}
