import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useEventBus } from '../hooks/useEventBus';
import { supabase } from '../api/supabase';
import {
  Award, CheckCircle, Clock, Zap, ArrowRight, UploadCloud,
  ChevronRight, Database, Settings2, Briefcase, FileText,
  Mail, MessageSquare, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClientSuccess() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const { triggerEvent } = useEventBus();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Custom integration form states
  const [integrationType, setIntegrationType] = useState('excel_migration');
  const [businessNeed, setBusinessNeed] = useState('');
  const [currentTool, setCurrentTool] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [excelFileUrl, setExcelFileUrl] = useState('');
  const [existingRequests, setExistingRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('integration_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setExistingRequests(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Onboarding status calculations
  const setupSteps = [
    {
      id: 'profile',
      title: 'Company Identity Profile',
      desc: 'Establish company branding name, operational email, and phone references.',
      completed: !!(profile?.company_name && profile?.company_email),
      action: () => navigate('/settings'),
      label: 'Setup Company Profile'
    },
    {
      id: 'markups',
      title: 'Default Labor & Material Markups',
      desc: 'Define standard baseline percentage markup rules to automate profit generation.',
      completed: !!(profile?.default_labor_markup && profile?.default_labor_markup > 0),
      action: () => navigate('/settings'),
      label: 'Configure Standard Markups'
    },
    {
      id: 'pricebook',
      title: 'Initialize Trade Price Book',
      desc: 'Import or register materials, equipment components, and standard labor units.',
      completed: false, // will represent dynamic check or default link
      action: () => navigate('/price-book'),
      label: 'Manage Price Book'
    },
    {
      id: 'estimate',
      title: 'Generate First Estimate',
      desc: 'Assemble details, calculate margins, and compile professional contractor proposals.',
      completed: false,
      action: () => navigate('/projects'),
      label: 'Launch Estimation Workspace'
    }
  ];

  const completedStepsCount = setupSteps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedStepsCount / setupSteps.length) * 100);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessNeed.trim()) {
      toast.error('Please describe your business needs');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // 1. Log in integration_requests
      const { data: reqData, error: reqErr } = await supabase
        .from('integration_requests')
        .insert({
          user_id: user.id,
          business_need: `${integrationType.replace('_', ' ').toUpperCase()}: ${businessNeed}`,
          current_tool: currentTool,
          desired_workflow: expectedOutcome,
          urgency,
          expected_outcome: expectedOutcome,
          attachment_url: excelFileUrl || null,
          status: 'pending review',
          priority: urgency
        })
        .select()
        .single();

      if (reqErr) throw reqErr;

      // 2. Update profile concierge settings
      await updateProfile({
        concierge_requested: true,
        concierge_details: {
          last_requested_at: new Date().toISOString(),
          type: integrationType,
          urgency
        }
      });

      // 3. Dispatch to Activity Event Bus
      await triggerEvent({
        entityType: 'integration',
        entityId: reqData?.id,
        actionType: 'requested',
        title: 'Custom Integration Request Dispatched',
        description: `Bespoke integration for ${integrationType.replace('_', ' ')} submitted. Status: pending review.`,
        sendNotification: true,
        notificationType: 'info',
        sendEmail: true,
        emailType: 'feature_received',
        recipientEmail: user.email || '',
        emailSubject: 'Custom Workflow Integration Request Received'
      });

      toast.success('Bespoke custom integration request registered!');
      
      // Reset form
      setBusinessNeed('');
      setCurrentTool('');
      setExpectedOutcome('');
      setExcelFileUrl('');
      fetchRequests();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to submit concierge request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30';
      case 'planned':
      case 'in progress':
        return 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30';
      case 'rejected':
        return 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30';
      default:
        return 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30';
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in font-inter select-none">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-navy-950 to-navy-900 border border-navy-800 rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(197,139,92,0.15),transparent)] pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-copper-950/45 border border-copper-900/35 rounded-full text-[10px] font-bold text-copper uppercase tracking-wider mb-4">
              <Award className="w-3.5 h-3.5" />
              White-Glove Partner Concierge
            </div>
            <h1 className="text-2xl sm:text-4xl font-sora font-extrabold text-white tracking-tight leading-tight">
              Client Success Concierge Hub
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
              Accelerate your workflow. Complete your standard operating setup, configure dynamic profit margins, or leverage our dedicated engineering team to build custom, white-glove integrations completely tailored to your business model.
            </p>
          </div>
          <div className="bg-navy-900/80 border border-navy-800 p-4.5 rounded-2xl min-w-[200px] text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Operational Progress</span>
            <span className="text-3xl font-sora font-extrabold text-white mt-1 block">{progressPercent}%</span>
            <div className="w-full bg-navy-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-copper h-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[9px] text-slate-500 mt-1 block">
              {completedStepsCount} of {setupSteps.length} lifecycle milestones complete
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Onboarding Wizard Setup Checklist (Columns 1-6) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-6 rounded-2xl">
            <h2 className="text-base font-sora font-bold text-slate-900 dark:text-white mb-1">Contractor Setup Checklist</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Complete these crucial operational milestones to unlock peak automation</p>

            <div className="space-y-4">
              {setupSteps.map((step, idx) => (
                <div 
                  key={step.id} 
                  className={`p-4 rounded-xl border transition-all ${
                    step.completed 
                      ? 'bg-slate-50/50 dark:bg-navy-950/20 border-slate-100 dark:border-navy-900' 
                      : 'bg-white dark:bg-navy-950/45 border-slate-200 dark:border-navy-850 hover:border-slate-300 dark:hover:border-navy-750'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border transition-all mt-0.5 ${
                      step.completed 
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' 
                        : 'bg-slate-50 dark:bg-navy-950 border-slate-300 dark:border-navy-800 text-slate-400'
                    }`}>
                      {step.completed ? (
                        <CheckCircle className="w-4 h-4 fill-current text-emerald-500 bg-white dark:bg-navy rounded-full" />
                      ) : (
                        <span className="text-[10px] font-bold">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-bold font-sora ${step.completed ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                        {step.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {step.desc}
                      </p>
                      
                      {!step.completed && (
                        <button
                          onClick={step.action}
                          className="mt-3.5 inline-flex items-center gap-1 text-[11px] font-bold text-copper hover:text-copper-hover transition-colors"
                        >
                          {step.label} <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Integration Request desk (Columns 7-12) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-copper" />
              <h2 className="text-base font-sora font-bold text-slate-900 dark:text-white">Workflow & Custom Tool Request</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Our moated team constructs tailored software linkages around your legacy systems. Let us adapt PeakEstimator for you.
            </p>

            <form onSubmit={handleSubmitRequest} className="space-y-4 font-inter text-xs">
              
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Integration Archetype</label>
                <select
                  value={integrationType}
                  onChange={(e) => setIntegrationType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white transition-all focus:outline-none"
                >
                  <option value="excel_migration">Excel Trade Price Sheet Data Migration</option>
                  <option value="crm_sync">CRM Sync (Salesforce, HubSpot, JobNimbus)</option>
                  <option value="accounting">Accounting Sync (QuickBooks Online, Xero)</option>
                  <option value="custom_erp">Construction ERP linkage (Procore, Buildertrend)</option>
                  <option value="other_bespoke">Bespoke Enterprise Workflow Automations</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Current Software Tool</label>
                  <input
                    type="text"
                    value={currentTool}
                    onChange={(e) => setCurrentTool(e.target.value)}
                    placeholder="e.g. legacy Excel sheets, JobNimbus"
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white transition-all focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Request Priority</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white transition-all focus:outline-none font-bold"
                  >
                    <option value="low">Low Urgency (Within 2 Weeks)</option>
                    <option value="medium">Medium Urgency (Within 1 Week)</option>
                    <option value="high">High Urgency (Within 72 Hours)</option>
                    <option value="critical">Critical Urgency (Immediate Operation Impact)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Describe Business Need / Workflow Bottlenecks</label>
                <textarea
                  rows={3}
                  value={businessNeed}
                  onChange={(e) => setBusinessNeed(e.target.value)}
                  placeholder="Describe your current bottleneck and which spreadsheets or pipelines need white-glove developer setup."
                  className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white transition-all focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Desired Operational Outcome</label>
                <textarea
                  rows={2}
                  value={expectedOutcome}
                  onChange={(e) => setExpectedOutcome(e.target.value)}
                  placeholder="e.g. Auto-sync newly approved estimates as QuickBooks invoices instantly."
                  className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white transition-all focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Spreadsheets attachment mockup url */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Attach Legacy Database Sheet URL (Excel, CSV, PDF)</label>
                <input
                  type="url"
                  value={excelFileUrl}
                  onChange={(e) => setExcelFileUrl(e.target.value)}
                  placeholder="e.g. Paste Dropbox, OneDrive or Google Drive link containing data lists"
                  className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white transition-all focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 dark:bg-navy-950/45 border border-slate-200 dark:border-navy-850 p-3 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  All bespoke integrations are executed securely under enterprise-grade encryption RLS controls. Standard analysis completed within 24 hours.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-copper hover:bg-copper-hover active:bg-copper-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Submit Custom Request
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Active Integration Requests List */}
          {existingRequests.length > 0 && (
            <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-6 rounded-2xl">
              <h3 className="text-sm font-sora font-bold text-slate-900 dark:text-white mb-4">Request Pipeline Status</h3>
              
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                {existingRequests.map(req => (
                  <div key={req.id} className="p-3 bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-900 rounded-xl flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {req.business_need}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Requested {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadge(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
