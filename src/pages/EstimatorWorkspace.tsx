import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, ChevronDown, Lock, FileText, CheckCircle2, Shield, History, DollarSign, Calendar, Users, BarChart2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../providers/AuthProvider';
import { useProject } from '../hooks/useProjects';
import { useProjectItems } from '../hooks/useProjectItems';
import { calcTotals } from '../lib/calculations';
import { generateAndPrint } from '../lib/pdfGenerator';
import LineItemsTable from '../components/estimator/LineItemsTable';
import TotalsSidebar from '../components/estimator/TotalsSidebar';
import PriceBookDrawer from '../components/estimator/PriceBookDrawer';
import MarkupSettings from '../components/estimator/MarkupSettings';
import AIScopeAssistant from '../components/estimator/AIScopeAssistant';
import MultiOptionTiers from '../components/estimator/MultiOptionTiers';
import TemplateSelectModal from '../components/projects/TemplateSelectModal';
import type { Project, StatusType, ProjectItem } from '../types';
import { TRADE_EMOJIS } from '../types';
import { supabase } from '../api/supabase';
import { apiClient } from '../api/apiClient';
import JobCostingModal from '../components/estimator/JobCostingModal';
import SchedulePanel from '../components/estimator/SchedulePanel';
import DepositPanel from '../components/estimator/DepositPanel';
import SubcontractorPanel from '../components/estimator/SubcontractorPanel';
import ProposalAnalyticsPanel from '../components/estimator/ProposalAnalyticsPanel';
import { trackEvent, initTimeTracking } from '../lib/proposalAnalytics';

const STATUSES: StatusType[] = ['lead', 'bidding', 'sent', 'approved', 'won', 'lost'];

const STATUS_LABEL_COLORS: Record<StatusType, string> = {
  lead: 'status-lead',
  bidding: 'status-bidding',
  sent: 'status-sent',
  approved: 'status-approved',
  won: 'status-won',
  lost: 'status-lost',
};

export default function EstimatorWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { project, loading: projLoading, updateProject } = useProject(id);
  const { items, loading: itemsLoading, addItem, updateItem, deleteItem, reorderItems } = useProjectItems(id);

  const [priceBookOpen, setPriceBookOpen] = useState(false);
  const [showJobCosting, setShowJobCosting] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedule' | 'deposit' | 'subs' | 'analytics' | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [notes, setNotes] = useState('');
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync notes from project
  useEffect(() => {
    if (project) setNotes(project.notes || '');
  }, [project?.id]);

  const [proposalVersions, setProposalVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [lockingVersion, setLockingVersion] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);

  // Dynamic pricing
  const [systemPricing, setSystemPricing] = useState({
    enterpriseSetup: 499,
    annualLicense: 8000
  });

  useEffect(() => {
    supabase.from('system_settings').select('*').single().then(({ data }) => {
      if (data) {
        setSystemPricing({
          enterpriseSetup: data.pricing_enterprise_setup ?? 499,
          annualLicense: data.pricing_annual_license ?? 8000
        });
      }
    });
  }, []);

  const fetchVersions = async () => {
    if (!project) return;
    setLoadingVersions(true);
    try {
      const { data, error } = await supabase
        .from('proposal_versions')
        .select('*')
        .eq('project_id', project.id)
        .order('version_number', { ascending: false });
      if (error) throw error;
      setProposalVersions(data || []);
    } catch (err: any) {
      console.error('Error fetching proposal versions:', err.message);
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    if (project && (project.status === 'approved' || project.status === 'won')) {
      fetchVersions();
    }
  }, [project?.id, project?.status]);

  const handleLockVersion = async () => {
    if (!project) return;
    setLockingVersion(true);
    try {
      const nextVerNum = proposalVersions.length > 0
        ? Math.max(...proposalVersions.map((v: any) => v.version_number)) + 1
        : 1;

      const { error } = await apiClient.lockProposalVersion({
        projectId: project.id,
        versionNumber: nextVerNum,
        itemsSnapshot: items,
        totalsSnapshot: {
          subtotal: totals.subtotal,
          marginAmount: totals.marginAmount,
          taxAmount: totals.taxAmount,
          total: totals.total,
        },
        notesSnapshot: notes,
      });

      if (error) throw new Error(error);
      toast.success(`Proposal version v${nextVerNum} successfully locked and sealed.`);
      fetchVersions();
    } catch (err: any) {
      toast.error(`Failed to lock version: ${err.message}`);
    } finally {
      setLockingVersion(false);
    }
  };

  const [financingDefaults, setFinancingDefaults] = useState({
    apr: 9.99,
    term: 60,
    minAmount: 1000,
  });

  useEffect(() => {
    if (project?.user_id) {
      const stored = localStorage.getItem(`financing_defaults_${project.user_id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setFinancingDefaults({
            apr: parsed.apr ?? 9.99,
            term: parsed.term ?? 60,
            minAmount: parsed.minAmount ?? 1000,
          });
        } catch (e) {
          console.error('Failed to load financing defaults from localStorage', e);
        }
      }
    }
  }, [project?.user_id]);

  // Calculate totals
  const totals = project ? calcTotals(
    items,
    project.labor_markup,
    project.material_markup,
    project.equipment_markup,
    project.tax_rate
  ) : { subtotal: 0, laborSub: 0, matSub: 0, eqSub: 0, otherSub: 0, marginAmount: 0, taxAmount: 0, total: 0 };

  // Save totals to DB after calculation changes (debounced)
  useEffect(() => {
    if (!project) return;
    if (totalsTimerRef.current) clearTimeout(totalsTimerRef.current);
    totalsTimerRef.current = setTimeout(() => {
      updateProject({
        subtotal: totals.subtotal,
        margin_amount: totals.marginAmount,
        tax_amount: totals.taxAmount,
        total_value: totals.total,
      });
    }, 1000);
    return () => { if (totalsTimerRef.current) clearTimeout(totalsTimerRef.current); };
  }, [totals.total, totals.subtotal, totals.marginAmount, totals.taxAmount]);

  // Debounced notes save
  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      updateProject({ notes: value });
    }, 800);
  };

  // Markup changes – immediate save with debounce
  const handleMarkupUpdate = useCallback((updates: Partial<Project>) => {
    updateProject(updates);
  }, [updateProject]);

  const handleAddItem = useCallback(async () => {
    await addItem();
  }, [addItem]);

  const handleAddFromPriceBook = useCallback(async (itemData: Partial<ProjectItem>) => {
    await addItem(itemData);
  }, [addItem]);

  const handleStatusChange = async (status: StatusType) => {
    await updateProject({ status });
    toast.success(`Status updated to ${status}`);
  };

  const handleAIItemsGenerated = async (generatedItems: any[], summary: string) => {
    for (const item of generatedItems) {
      await addItem({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        category: item.category,
        markup: item.markup,
      });
    }
    if (summary) {
      handleNotesChange(notes ? `${notes}\n\nAI Scope Summary:\n${summary}` : `AI Scope Summary:\n${summary}`);
    }
  };

  const handleApplyTemplateItems = async (templateItems: any[]) => {
    for (const item of templateItems) {
      await addItem({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        category: item.category,
        markup: item.markup,
      });
    }
  };

  const handleCopyLink = () => {
    if (!project) return;
    const url = `${window.location.origin}/approve/${project.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Client link copied to clipboard!');
  };

  const handleExportPDF = () => {
    if (!project) return;
    setExportingPDF(true);
    try {
      // Always inject latest contractor branding from profile into the project snapshot
      const brandedProject = {
        ...project,
        company_name:  profile?.company_name  || project.company_name,
        company_email: profile?.company_email || project.company_email,
        company_phone: profile?.company_phone || project.company_phone,
        company_logo:  profile?.company_logo  || project.company_logo,
      };
      generateAndPrint(brandedProject, items, totals);
      toast.success('Print dialog opening…');
    } catch {
      toast.error('Could not open print dialog. Please allow pop-ups.');
    } finally {
      setTimeout(() => setExportingPDF(false), 1500);
    }
  };

  if (projLoading || itemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-navy-950">
        <div className="w-8 h-8 border-4 border-copper border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-navy-950">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 font-inter">Project not found</p>
          <button onClick={() => navigate('/projects')} className="mt-3 text-copper hover:text-copper-hover text-sm font-semibold transition-all font-sora">
            ← Back to projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-navy-950 animate-fade-in transition-colors duration-200">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white dark:bg-navy-900 border-b border-slate-100 dark:border-navy-800/80 shadow-soft">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <button
            onClick={() => navigate('/projects')}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-navy-800 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{TRADE_EMOJIS[project.trade as import('../types').TradeType]}</span>
              <h1 className="text-base font-bold text-slate-900 dark:text-white truncate font-sora">{project.name}</h1>
            </div>
            {project.client_name && (
              <p className="text-xs text-slate-400 dark:text-slate-500 pl-7 font-inter">Client: {project.client_name}</p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Status dropdown */}
            <div className="relative group">
              <button
                id="status-dropdown"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${STATUS_LABEL_COLORS[project.status as import('../types').StatusType]}`}
              >
                <span className="capitalize">{project.status}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-navy-900 rounded-xl shadow-premium border border-slate-100 dark:border-navy-800 py-1 w-36 hidden group-hover:block z-50">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold capitalize hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors ${project.status === s ? 'text-copper dark:text-copper bg-copper-50/50 dark:bg-copper-950/30' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => updateProject({ is_multi_option: !project.is_multi_option })}
              className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm ${
                project.is_multi_option
                  ? 'bg-copper text-white border-transparent'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
            >
              👑 {project.is_multi_option ? 'Multi-Option: Active' : 'Enable Multi-Option'}
            </button>

            <button
              id="share-btn"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-all shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>

            <button
              id="export-pdf-topbar"
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-copper/10 disabled:opacity-60"
            >
              {exportingPDF ? 'Generating...' : '📄 Export PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content — single col on mobile, 3-col on desktop */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {/* Line items */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {(project.status === 'approved' || project.status === 'won') && (
            <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-100 dark:border-navy-800/80 shadow-premium p-6 overflow-hidden relative animate-fade-in transition-colors duration-200">
              {/* Premium Gradient Header */}
              <div className="-mx-6 -mt-6 mb-6 p-5 bg-gradient-to-r from-slate-900 via-navy-900 to-copper/20 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                    <Shield className="w-5 h-5 text-copper-light" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold font-sora tracking-wide uppercase">Post-Approval Hub</h2>
                    <p className="text-[10px] text-slate-300 font-inter mt-0.5">Secure Transaction Compliance & Sealed Version Log</p>
                  </div>
                </div>
                <div className="flex items-center self-start sm:self-auto gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Proposal Signed & Active</span>
                </div>
              </div>

              {/* Two Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Card: Client E-Signature Certificate */}
                <div className="bg-slate-50 dark:bg-navy-950/40 border border-slate-100 dark:border-navy-800/50 rounded-2xl p-5 flex flex-col justify-between transition-colors">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white font-sora mb-3 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Client Signature Certificate
                    </h3>
                    <div className="bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl p-4 h-24 flex items-center justify-center relative overflow-hidden group shadow-inner transition-colors">
                      {project.signature_data ? (
                        <img src={project.signature_data} alt="Client Signature" className="max-h-full dark:invert transition-colors" />
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium italic">No digital signature captured</span>
                      )}
                      <div className="absolute bottom-1 right-2 text-[8px] text-slate-400 dark:text-slate-500 font-mono tracking-tighter">
                        PeakEstimator Verified
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2 text-[11px]">
                    <div className="flex justify-between border-b border-slate-100 dark:border-navy-800/80 pb-1.5 transition-colors">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">Signatory Name</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{project.client_name || 'Client'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-navy-800/80 pb-1.5 transition-colors">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">Signatory Email</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[150px]">{project.client_email || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">Approved Timestamp</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">
                        {project.client_approved_at ? new Date(project.client_approved_at).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Card: Sealed Version History */}
                <div className="bg-slate-50 dark:bg-navy-950/40 border border-slate-100 dark:border-navy-800/50 rounded-2xl p-5 flex flex-col justify-between transition-colors">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white font-sora uppercase tracking-wider flex items-center gap-2">
                        <History className="w-4 h-4 text-copper" />
                        Sealed Version Log
                      </h3>
                      <button
                        onClick={handleLockVersion}
                        disabled={lockingVersion}
                        className="px-2.5 py-1 bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-60 flex items-center gap-1 shadow-sm"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        {lockingVersion ? 'Sealing...' : 'Seal Snapshot'}
                      </button>
                    </div>

                    <div className="max-h-[120px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {loadingVersions ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-4 h-4 border-2 border-copper border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : proposalVersions.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-[10px] text-slate-400 font-medium italic">No locked snapshots found for this estimate.</p>
                        </div>
                      ) : (
                        proposalVersions.map((v: any) => (
                          <div key={v.id} className="bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl p-2.5 flex items-center justify-between shadow-xs transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-copper/10 text-copper flex items-center justify-center text-[10px] font-bold">
                                v{v.version_number}
                              </div>
                              <div>
                                <div className="text-[10px] font-bold text-slate-800 dark:text-white">Snapshot Sealed</div>
                                <div className="text-[8px] text-slate-400 dark:text-slate-500 font-medium">
                                  {new Date(v.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-bold text-copper font-sora">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v.totals_snapshot?.total || 0)}
                              </div>
                              <div className="text-[8px] text-slate-400 dark:text-slate-500 font-medium">
                                {v.items_snapshot?.length || 0} items
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-navy-800/80 text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 leading-relaxed transition-colors">
                    <Lock className="w-3.5 h-3.5 text-copper flex-shrink-0" />
                    Each snapshot permanently seals the item list and pricing as an immutable audit record.
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-navy-800/80 flex flex-wrap items-center justify-between gap-3 transition-colors">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Agreement Document:</span>
                  <button
                    onClick={() => setAgreementModalOpen(true)}
                    className="text-[10px] font-bold text-copper hover:underline uppercase tracking-wider flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    View Licensing Agreement
                  </button>
                </div>
              </div>
            </div>
          )}

          <LineItemsTable
            items={items}
            onAdd={handleAddItem}
            onUpdate={updateItem}
            onDelete={deleteItem}
            onReorder={reorderItems}
            onOpenPriceBook={() => setPriceBookOpen(true)}
            onOpenTemplates={() => setTemplateModalOpen(true)}
          />

          <AIScopeAssistant
            projectId={project.id}
            trade={project.trade}
            onItemsGenerated={handleAIItemsGenerated}
          />

          {project.is_multi_option && (
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-800/80 shadow-card p-6">
              <MultiOptionTiers
                items={items}
                laborMarkup={project.labor_markup}
                materialMarkup={project.material_markup}
                equipmentMarkup={project.equipment_markup}
                taxRate={project.tax_rate}
                financingRate={financingDefaults.apr}
                financingMonths={financingDefaults.term}
                financingMinAmount={financingDefaults.minAmount}
                selectedTier={project.selected_option_tier as 'good' | 'better' | 'best'}
                onSelectTier={(tier) => updateProject({ selected_option_tier: tier })}
              />
            </div>
          )}

          <MarkupSettings
            project={project}
            onUpdate={handleMarkupUpdate}
          />

          {/* ── New Feature Panels ───────────────────────────── */}
          <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-100 dark:border-navy-800/80 shadow-premium p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex-1">Project Tools</p>
              <button onClick={() => setActiveTab(activeTab === 'schedule' ? null : 'schedule')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeTab === 'schedule' ? 'bg-copper text-white border-transparent' : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300'}`}>
                <Calendar className="w-3.5 h-3.5" /> Schedule
              </button>
              <button onClick={() => setActiveTab(activeTab === 'deposit' ? null : 'deposit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeTab === 'deposit' ? 'bg-copper text-white border-transparent' : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300'}`}>
                <DollarSign className="w-3.5 h-3.5" /> Deposits
              </button>
              <button onClick={() => setActiveTab(activeTab === 'subs' ? null : 'subs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeTab === 'subs' ? 'bg-copper text-white border-transparent' : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300'}`}>
                <Users className="w-3.5 h-3.5" /> Subcontractors
              </button>
              <button onClick={() => setShowJobCosting(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">
                <TrendingUp className="w-3.5 h-3.5" /> Job Costing
              </button>
              <button onClick={() => setActiveTab(activeTab === 'analytics' ? null : 'analytics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeTab === 'analytics' ? 'bg-copper text-white border-transparent' : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300'}`}>
                <BarChart2 className="w-3.5 h-3.5" /> Analytics
              </button>
            </div>
            {activeTab === 'schedule' && <SchedulePanel projectId={project.id} />}
            {activeTab === 'deposit' && <DepositPanel project={project} />}
            {activeTab === 'subs' && <SubcontractorPanel projectId={project.id} projectName={project.name} />}
            {activeTab === 'analytics' && <ProposalAnalyticsPanel projectId={project.id} />}
          </div>
        </div>

        {/* Totals sidebar — stacks below on mobile, sticky column on desktop */}
        <div className="col-span-1">
          <div className="lg:sticky lg:top-[88px]">
            <TotalsSidebar
              totals={totals}
              notes={notes}
              onNotesChange={handleNotesChange}
              onExportPDF={handleExportPDF}
              onCopyLink={handleCopyLink}
              exportingPDF={exportingPDF}
              financingRate={financingDefaults.apr}
              financingMonths={financingDefaults.term}
              financingMinAmount={financingDefaults.minAmount}
            />
          </div>
        </div>
      </div>

      {/* Price Book Drawer */}
      <PriceBookDrawer
        isOpen={priceBookOpen}
        onClose={() => setPriceBookOpen(false)}
        projectTrade={project.trade}
        onAddItem={handleAddFromPriceBook}
      />

      {/* Contracting Templates Selector Modal */}
      <TemplateSelectModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onApplyItems={handleApplyTemplateItems}
        projectTrade={project.trade}
      />

      {/* Job Costing Modal */}
      {showJobCosting && project && (
        <JobCostingModal
          project={project}
          items={items}
          onClose={() => setShowJobCosting(false)}
          onSaved={() => {}}
        />
      )}

      {/* Licensing Agreement Modal */}
      {agreementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-100 dark:border-navy-800 shadow-premium max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-navy-800/80 flex items-center justify-between bg-slate-50 dark:bg-navy-950">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-copper" />
                <h3 className="text-sm font-bold font-sora text-slate-900 dark:text-white uppercase tracking-wider">
                  PeakEstimator License & Terms
                </h3>
              </div>
              <button
                onClick={() => setAgreementModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 text-sm font-bold transition-all"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 font-inter text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[60vh] divide-y divide-slate-100 dark:divide-navy-800">
              <div className="pb-4">
                <h4 className="font-bold text-slate-800 dark:text-white mb-2">1. Software License & Partnership Objective</h4>
                <p>
                  PeakEstimator Pro provides a dedicated mobile estimating suite to increase bidder responsiveness and conversion. The speed of quoting directly determines job win rates. PeakEstimator Pro equips partners with tools for interactive, instant client digital approvals, removing standard proposal delay overheads.
                </p>
              </div>
              <div className="py-4">
                <h4 className="font-bold text-slate-800 dark:text-white mb-2">2. Implementation Onboarding & Support</h4>
                <p>
                  Initial setup & onboarding fee (${systemPricing.enterpriseSetup} one-time) guarantees complete company database importing, private server environment configuration, and training calls. All pricing formulas, vendor spreadsheets, and margins remain the private properties of the partner.
                </p>
              </div>
              <div className="py-4">
                <h4 className="font-bold text-slate-800 dark:text-white mb-2">3. Subscription Licensing terms</h4>
                <p>
                  After the initial 30-day onboarding phase, upon confirming ROI and platform value, the account transitions to the standard PeakEstimator Pro annual license of ${systemPricing.annualLicense.toLocaleString()} USD billed annually.
                </p>
              </div>
              <div className="py-4">
                <h4 className="font-bold text-slate-800 dark:text-white mb-2">4. Digital Signatures & Regulatory Compliance</h4>
                <p>
                  All digital signature events are timestamped, encrypted, and recorded in compliance with state-level electronic transaction laws. Certified transaction records are stored permanently on PeakEstimator servers.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-navy-800/80 flex justify-end bg-slate-50 dark:bg-navy-950">
              <button
                onClick={() => setAgreementModalOpen(false)}
                className="px-5 py-2 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all"
              >
                Close Agreement Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
