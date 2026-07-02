import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Building2, CheckCircle, ChevronRight, Clock,
  DollarSign, FileText, Gauge, Layers, LineChart, Mail, Phone,
  Search, Shield, Target, Users, Workflow, Zap, User, MapPin,
  Wrench, Database, Calculator, Calendar, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../api/supabase';

type AuditStep = 0 | 1 | 2 | 3;

type AuditForm = {
  company_name: string;
  owner_name: string;
  email: string;
  phone: string;
  team_size: string;
  annual_revenue_range: string;
  service_area: string;
  trade_type: string;
  estimates_per_month: number;
  average_project_size: number;
  average_close_rate: number;
  average_response_time_hours: number;
  follow_up_process: string;
  estimator_count: number;
  office_staff_count: number;
  lost_leads_per_month: number;
  delayed_estimates_per_month: number;
  inconsistent_pricing_issues: string;
  missed_follow_ups_per_month: number;
  callback_delay_hours: number;
  manual_processes: string;
  estimating_time_hours: number;
  current_crm: string;
  estimating_software: string;
  scheduling_tools: string;
  invoicing_tools: string;
  spreadsheet_usage: string;
  manual_workflows: string;
};

const initialForm: AuditForm = {
  company_name: '',
  owner_name: '',
  email: '',
  phone: '',
  team_size: '2-5',
  annual_revenue_range: '$500k-$1M',
  service_area: '',
  trade_type: 'general',
  estimates_per_month: 40,
  average_project_size: 8500,
  average_close_rate: 28,
  average_response_time_hours: 24,
  follow_up_process: 'manual',
  estimator_count: 1,
  office_staff_count: 1,
  lost_leads_per_month: 6,
  delayed_estimates_per_month: 8,
  inconsistent_pricing_issues: 'sometimes',
  missed_follow_ups_per_month: 10,
  callback_delay_hours: 8,
  manual_processes: 'spreadsheets, texts, phone calls',
  estimating_time_hours: 3,
  current_crm: '',
  estimating_software: '',
  scheduling_tools: '',
  invoicing_tools: '',
  spreadsheet_usage: 'daily',
  manual_workflows: '',
};

function PeakLogo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="#0F172A"/>
      <polygon points="32,8 6,56 58,56" fill="none" stroke="#C58B5C" strokeWidth="2.5" strokeLinejoin="round"/>
      <polyline points="18,50 26,28 32,40 38,28 46,50" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="36" y1="16" x2="52" y2="30" stroke="#C58B5C" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="52" cy="30" r="3" fill="#C58B5C"/>
    </svg>
  );
}

function calculateAudit(form: AuditForm) {
  const monthlyEstimateValue = form.estimates_per_month * form.average_project_size;
  const currentWonRevenue = monthlyEstimateValue * (form.average_close_rate / 100);
  const recoveredFollowUpRevenue = form.missed_follow_ups_per_month * form.average_project_size * 0.18;
  const recoveredLostLeadRevenue = form.lost_leads_per_month * form.average_project_size * 0.22;
  const closeRateLiftRevenue = monthlyEstimateValue * 0.07;
  const annualRecoverableRevenue = Math.round((recoveredFollowUpRevenue + recoveredLostLeadRevenue + closeRateLiftRevenue) * 12);

  const responsePenalty = Math.min(35, form.average_response_time_hours * 1.15);
  const followUpPenalty = form.follow_up_process === 'automated' ? 4 : form.follow_up_process === 'structured' ? 12 : 28;
  const estimatingPenalty = Math.min(25, form.estimating_time_hours * 4);
  const leakagePenalty = Math.min(25, form.lost_leads_per_month + form.missed_follow_ups_per_month);

  const efficiencyScore = Math.max(14, Math.round(100 - responsePenalty - estimatingPenalty));
  const followUpScore = Math.max(8, Math.round(100 - followUpPenalty - form.missed_follow_ups_per_month * 2));
  const scalabilityScore = Math.max(10, Math.round(100 - leakagePenalty - (form.spreadsheet_usage === 'daily' ? 18 : 6)));
  const maturityScore = Math.round((efficiencyScore + followUpScore + scalabilityScore) / 3);
  const leadScore = Math.min(100, Math.round((annualRecoverableRevenue / 5000) + (100 - maturityScore) * 0.45 + form.estimates_per_month * 0.4));
  const urgencyScore = Math.min(100, Math.round(form.lost_leads_per_month * 5 + form.missed_follow_ups_per_month * 4 + form.average_response_time_hours * 0.7));
  const growthPotentialScore = Math.min(100, Math.round((monthlyEstimateValue / 10000) + (100 - form.average_close_rate) * 0.6));

  return {
    currentWonRevenue: Math.round(currentWonRevenue),
    annualRecoverableRevenue,
    efficiencyScore,
    followUpScore,
    scalabilityScore,
    maturityScore,
    leadScore,
    urgencyScore,
    growthPotentialScore,
    estimatedDealValue: annualRecoverableRevenue > 400000 ? 10000 : annualRecoverableRevenue > 175000 ? 5000 : 1500,
    qualificationStatus: leadScore >= 75 ? 'Qualified' : leadScore >= 50 ? 'Nurture' : 'Research',
  };
}

export default function LandingPage() {
  const [form, setForm] = useState<AuditForm>(initialForm);
  const [step, setStep] = useState<AuditStep>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const result = useMemo(() => calculateAudit(form), [form]);

  const update = <K extends keyof AuditForm>(key: K, value: AuditForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const submitAudit = async () => {
    if (!form.company_name || !form.owner_name || !form.email) {
      toast.error('Company, owner, and email are required for the Revenue Audit.');
      setStep(0);
      return;
    }

    setSubmitting(true);
    try {
      const auditId = crypto.randomUUID();
      const { error } = await supabase
        .from('revenue_audits')
        .insert({
          id: auditId,
          ...form,
          estimated_lost_revenue: result.annualRecoverableRevenue,
          projected_revenue_recovery: result.annualRecoverableRevenue,
          qualification_status: result.qualificationStatus,
          source: 'landing_page',
        });

      if (error) throw error;

      await Promise.all([
        supabase.from('audit_scores').insert({
          revenue_audit_id: auditId,
          efficiency_score: result.efficiencyScore,
          follow_up_score: result.followUpScore,
          scalability_score: result.scalabilityScore,
          operational_maturity_score: result.maturityScore,
          lead_score: result.leadScore,
          urgency_score: result.urgencyScore,
          growth_potential_score: result.growthPotentialScore,
          estimated_deal_value: result.estimatedDealValue,
        }),
        supabase.from('lead_pipeline').insert({
          revenue_audit_id: auditId,
          stage: 'New Audit',
          projected_revenue_value: result.annualRecoverableRevenue,
          qualification_status: result.qualificationStatus,
        }),
        supabase.from('contacts').insert({
          revenue_audit_id: auditId,
          company_name: form.company_name,
          full_name: form.owner_name,
          email: form.email,
          phone: form.phone,
          contact_type: 'revenue_audit_lead',
        }),
      ]);

      setSubmitted(true);
      toast.success('Revenue Audit generated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit Revenue Audit';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const numberInput = (key: keyof AuditForm, label: string, prefix = '', suffix = '') => (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 focus-within:border-copper">
        {prefix && <span className="text-xs font-bold text-slate-400">{prefix}</span>}
        <input
          type="number"
          value={Number(form[key])}
          onChange={event => update(key as any, Number(event.target.value) as any)}
          className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold text-white outline-none"
        />
        {suffix && <span className="text-xs font-bold text-slate-400">{suffix}</span>}
      </div>
    </label>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-copper/20 selection:text-copper-100 font-inter">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#020617]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <PeakLogo />
            <div>
              <div className="font-sora text-sm font-black tracking-tight">Peak<span className="text-copper">Estimator</span></div>
              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">Revenue Infrastructure</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-400 transition hover:text-white">
              Sign In
            </Link>
            <a href="#revenue-audit" className="inline-flex items-center gap-2 rounded-xl bg-copper px-4 py-2 text-sm font-black text-white shadow-lg shadow-copper/20 transition hover:bg-copper-hover">
              Get Revenue Audit <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(197,139,92,0.15),transparent_40%),linear-gradient(180deg,#020617,#0F172A)]" />
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
          <div className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:py-20">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-copper/25 bg-copper/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-copper">
                <LineChart className="h-3.5 w-3.5" />
                Contractor Revenue Infrastructure
              </div>
              <h1 className="font-sora text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl xl:text-6xl">
                The Revenue Operating System Built for Contractors.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg font-medium">
                From lead to signed job in one platform: pipeline, estimating, proposal analytics, follow-up automation, CRM, and margin intelligence built to recover lost revenue and make contractors more money.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#revenue-audit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-copper px-7 py-4 text-base font-black text-white shadow-xl shadow-copper/20 transition hover:bg-copper-hover">
                  Get Revenue Audit <ArrowRight className="h-5 w-5" />
                </a>
                <a href="#leaks" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-7 py-4 text-base font-black text-white transition hover:border-copper/40 hover:bg-copper/10">
                  See Your Revenue Leakage
                </a>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3 max-w-xl">
                {[
                  ['+18%', 'Close-rate lift'],
                  ['72%', 'Faster follow-up'],
                  ['$214K', 'Typical recovery'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur">
                    <div className="font-sora text-xl font-black text-copper">{value}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 shadow-2xl backdrop-blur">
              <div className="rounded-xl border border-white/5 bg-[#020617] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-copper">Live Revenue Command</div>
                    <div className="mt-1 text-lg font-black">Contractor Growth Dashboard</div>
                  </div>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-300">Live</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Pipeline', value: '$842,500', Icon: DollarSign, color: 'text-emerald-300' },
                    { label: 'Close Rate', value: '41%', Icon: Target, color: 'text-copper' },
                    { label: 'Estimate Speed', value: '42 min', Icon: Clock, color: 'text-amber-300' },
                    { label: 'Follow-ups', value: '128', Icon: Workflow, color: 'text-violet-300' },
                  ].map(({ label, value, Icon, color }) => (
                    <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
                        <Icon className={`h-4 w-4 ${color}`} />
                      </div>
                      <div className="font-sora text-2xl font-black">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-black">Active Pipeline</span>
                      <span className="text-[10px] text-slate-400">6 stages</span>
                    </div>
                    {['New Audit', 'Qualified', 'Demo Scheduled', 'Proposal Sent'].map((stage, index) => (
                      <div key={stage} className="mb-2 rounded-lg border border-white/5 bg-[#0F172A] p-2 last:mb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{stage}</span>
                          <span className="text-[10px] font-black text-copper">{[12, 8, 5, 3][index]}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-copper" style={{ width: `${[88, 64, 42, 26][index]}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="text-xs font-black">Revenue Intelligence Engine</div>
                    <div className="mt-3 rounded-lg bg-copper/10 p-3 border border-copper/10">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-copper">Recoverable Revenue</div>
                      <div className="mt-1 font-sora text-3xl font-black">+$214K</div>
                      <div className="mt-1 text-[10px] text-slate-400 leading-normal">Based on missed follow-ups, delayed estimates, and pricing leakage.</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {['Proposal viewed 4x', 'Follow-up sequence armed', 'Margin warning detected'].map(item => (
                        <div key={item} className="flex items-center gap-2 text-[11px] text-slate-300">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-300" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="leaks" className="border-b border-white/5 bg-[#0F172A] px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-copper">Revenue Leak Messaging</div>
              <h2 className="font-sora text-3xl font-black tracking-tight sm:text-4xl">Most contractors lose more money from operational inefficiency than competitors.</h2>
              <p className="mt-4 text-sm leading-6 text-slate-400">Slow estimates, missed follow-ups, inconsistent pricing, callback delays, and disconnected tools quietly drain revenue before a job ever reaches the signed stage.</p>
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {[
                { title: 'Slow estimates', body: 'The faster contractor often controls the buying conversation.', Icon: Clock },
                { title: 'Missed follow-ups', body: 'Unworked proposals turn into invisible lost revenue.', Icon: Mail },
                { title: 'Inconsistent pricing', body: 'Margin leakage compounds across every estimator.', Icon: Gauge },
                { title: 'Manual workflows', body: 'Office teams become the bottleneck as lead volume grows.', Icon: Workflow },
                { title: 'Low close rates', body: 'Generic proposals fail to justify premium pricing.', Icon: Target },
                { title: 'Disorganized operations', body: 'Leads leak between inboxes, texts, spreadsheets, and calendars.', Icon: Layers },
              ].map(({ title, body, Icon }) => (
                <div key={title} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <Icon className="mb-4 h-5 w-5 text-copper" />
                  <h3 className="font-sora text-sm font-black">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="revenue-audit" className="bg-[#020617] px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <div className="sticky top-24 rounded-2xl border border-copper/20 bg-copper/5 p-5">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-copper">
                  <Search className="h-3.5 w-3.5" />
                  Revenue Audit System
                </div>
                <h2 className="font-sora text-3xl font-black">Analyze My Operations</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">Answer a few operational questions. PeakEstimator calculates estimated lost revenue, efficiency gaps, follow-up risk, maturity score, and projected revenue recovery.</p>
                <div className="mt-5 rounded-xl border border-white/5 bg-[#0F172A] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Estimated Recoverable Revenue</div>
                  <div className="mt-1 font-sora text-4xl font-black text-emerald-400">+${result.annualRecoverableRevenue.toLocaleString()}<span className="text-lg text-slate-400">/year</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      ['Efficiency', result.efficiencyScore],
                      ['Follow-up', result.followUpScore],
                      ['Scalability', result.scalabilityScore],
                      ['Maturity', result.maturityScore],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-lg bg-white/[0.04] p-2 border border-white/5">
                        <div className="text-[9px] font-bold uppercase text-slate-500">{label}</div>
                        <div className="mt-1 text-lg font-black text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 shadow-2xl">
              {submitted ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
                  <Shield className="mx-auto h-10 w-10 text-emerald-400 animate-pulse" />
                  <h3 className="mt-4 font-sora text-2xl font-black">Revenue Audit Complete</h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
                    Your projected recoverable revenue is <strong className="text-emerald-400">+${result.annualRecoverableRevenue.toLocaleString()}/year</strong>. Our team now has your operational profile, lead score, urgency score, and revenue opportunity analysis.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      ['Lead Score', result.leadScore],
                      ['Urgency', result.urgencyScore],
                      ['Growth Potential', result.growthPotentialScore],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-xl border border-white/5 bg-[#0F172A] p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
                        <div className="mt-1 font-sora text-3xl font-black text-copper">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    {['Business', 'Metrics', 'Leakage', 'Tech Stack'].map((label, index) => (
                      <button
                        key={label}
                        onClick={() => setStep(index as AuditStep)}
                        className={`flex-1 rounded-xl border px-2 py-2 text-[10px] font-black uppercase tracking-wide transition ${
                          step === index ? 'border-copper bg-copper/10 text-copper-200' : 'border-white/10 bg-white/[0.02] text-slate-500'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0F172A] p-5">
                    {step === 0 && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Company Name" value={form.company_name} onChange={value => update('company_name', value)} icon={Building2} />
                        <TextInput label="Owner Name" value={form.owner_name} onChange={value => update('owner_name', value)} icon={User} />
                        <TextInput label="Email" value={form.email} onChange={value => update('email', value)} icon={Mail} />
                        <TextInput label="Phone" value={form.phone} onChange={value => update('phone', value)} icon={Phone} />
                        <SelectInput label="Team Size" value={form.team_size} onChange={value => update('team_size', value)} options={['1', '2-5', '6-15', '16-50', '50+']} />
                        <SelectInput label="Annual Revenue" value={form.annual_revenue_range} onChange={value => update('annual_revenue_range', value)} options={['<$500k', '$500k-$1M', '$1M-$3M', '$3M-$10M', '$10M+']} />
                        <TextInput label="Service Area" value={form.service_area} onChange={value => update('service_area', value)} icon={MapPin} />
                        <SelectInput label="Trade Type" value={form.trade_type} onChange={value => update('trade_type', value)} options={['general', 'roofing', 'hvac', 'electrical', 'plumbing', 'painting', 'remodeling', 'landscaping']} />
                      </div>
                    )}

                    {step === 1 && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {numberInput('estimates_per_month', 'Estimates per month')}
                        {numberInput('average_project_size', 'Average project size', '$')}
                        {numberInput('average_close_rate', 'Average close rate', '', '%')}
                        {numberInput('average_response_time_hours', 'Average response time', '', 'hrs')}
                        <SelectInput label="Follow-up Process" value={form.follow_up_process} onChange={value => update('follow_up_process', value)} options={['none', 'manual', 'structured', 'automated']} />
                        {numberInput('estimator_count', 'Number of estimators')}
                        {numberInput('office_staff_count', 'Office staff count')}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {numberInput('lost_leads_per_month', 'Lost leads per month')}
                        {numberInput('delayed_estimates_per_month', 'Delayed estimates per month')}
                        <SelectInput label="Pricing Issues" value={form.inconsistent_pricing_issues} onChange={value => update('inconsistent_pricing_issues', value)} options={['rarely', 'sometimes', 'often', 'constant']} />
                        {numberInput('missed_follow_ups_per_month', 'Missed follow-ups per month')}
                        {numberInput('callback_delay_hours', 'Callback delays', '', 'hrs')}
                        {numberInput('estimating_time_hours', 'Estimating time per project', '', 'hrs')}
                        <TextInput label="Manual Processes" value={form.manual_processes} onChange={value => update('manual_processes', value)} icon={Wrench} full />
                      </div>
                    )}

                    {step === 3 && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Current CRM" value={form.current_crm} onChange={value => update('current_crm', value)} icon={Database} />
                        <TextInput label="Estimating Software" value={form.estimating_software} onChange={value => update('estimating_software', value)} icon={Calculator} />
                        <TextInput label="Scheduling Tools" value={form.scheduling_tools} onChange={value => update('scheduling_tools', value)} icon={Calendar} />
                        <TextInput label="Invoicing Tools" value={form.invoicing_tools} onChange={value => update('invoicing_tools', value)} icon={FileSpreadsheet} />
                        <SelectInput label="Spreadsheet Usage" value={form.spreadsheet_usage} onChange={value => update('spreadsheet_usage', value)} options={['never', 'monthly', 'weekly', 'daily']} />
                        <TextInput label="Manual Workflows" value={form.manual_workflows} onChange={value => update('manual_workflows', value)} icon={Workflow} full />
                      </div>
                    )}

                    <div className="mt-6 flex items-center justify-between gap-3">
                      <button
                        onClick={() => setStep(Math.max(0, step - 1) as AuditStep)}
                        disabled={step === 0}
                        className="rounded-xl border border-white/5 px-4 py-3 text-xs font-black text-slate-400 disabled:opacity-40 hover:bg-white/[0.02] transition-colors"
                      >
                        Previous
                      </button>
                      {step < 3 ? (
                        <button
                          onClick={() => setStep(Math.min(3, step + 1) as AuditStep)}
                          className="inline-flex items-center gap-2 rounded-xl bg-copper px-5 py-3 text-xs font-black text-white hover:bg-copper-hover transition-colors"
                        >
                          Continue <ChevronRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={submitAudit}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors"
                        >
                          {submitting ? 'Analyzing...' : 'See My Revenue Leakage'} <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-white/5 bg-[#0F172A] px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { title: 'CRM and Pipeline', body: 'Contacts, companies, activities, tasks, reminders, and deal stages.', Icon: Users },
                { title: 'SmartScope', body: 'Scope suggestions, margin signals, and proposal structure without cheap AI positioning.', Icon: FileText },
                { title: 'Intelligent Workflow System', body: 'Automated follow-up, demo scheduling, onboarding, and proposal reminders.', Icon: Workflow },
                { title: 'Revenue Intelligence Engine', body: 'Close rate, revenue recovery, CAC, LTV, churn, and pipeline velocity.', Icon: BarChart3 },
              ].map(({ title, body, Icon }) => (
                <div key={title} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <Icon className="mb-4 h-5 w-5 text-copper" />
                  <h3 className="font-sora text-sm font-black">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-[#020617] py-12 text-center text-sm text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <PeakLogo size={24} />
            <span className="font-sora text-sm font-black tracking-tight text-white">Peak<span className="text-copper">Estimator</span></span>
          </div>
          <div className="flex gap-6 font-medium text-slate-400">
            <Link to="/support" className="transition hover:text-white">Support</Link>
            <a href="#" className="transition hover:text-white">Terms</a>
            <a href="#" className="transition hover:text-white">Privacy</a>
          </div>
          <p className="text-xs">&copy; {new Date().getFullYear()} PeakEstimator. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  icon: Icon = Building2,
  full = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ElementType;
  full?: boolean;
}) {
  return (
    <label className={full ? 'sm:col-span-2' : ''}>
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 focus-within:border-copper">
        <Icon className="h-4 w-4 text-slate-500" />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
          placeholder={label}
        />
      </div>
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label>
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-3 py-3 text-sm font-bold text-white outline-none focus:border-copper"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
