import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Briefcase, CheckCircle, Target, Plus, ArrowRight,
  Activity, Heart, Info, Sparkles, Check, X, ChevronRight,
  Zap, Star
} from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../providers/AuthProvider';
import { useEventBus } from '../hooks/useEventBus';
import { supabase } from '../api/supabase';
import { formatCurrency } from '../lib/calculations';
import WelcomeModal from '../components/layout/WelcomeModal';
import type { StatusType, ActivityEvent } from '../types';

const STATUS_COLORS: Record<StatusType, string> = {
  lead: '#94A3B8',
  bidding: '#475569',
  sent: '#C58B5C',
  approved: '#10B981',
  won: '#059669',
  lost: '#EF4444',
};

const TRADE_COLORS = ['#C58B5C', '#1E293B', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#64748B'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, loading: projectsLoading, fetchProjects } = useProjects();
  const { profile, updateProfile } = useAuth();
  const { triggerEvent } = useEventBus();

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  // Track profile-loaded state to prevent flashing before data arrives
  const [profileChecked, setProfileChecked] = useState(false);

  // Celebration state for the "magical part" (live bid approvals)
  const [showCelebration, setShowCelebration] = useState(false);
  const [approvedProposal, setApprovedProposal] = useState<any | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const orgId = profile?.organization_id;
      let query = supabase
        .from('activity_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (orgId) {
        query = query.eq('organization_id', orgId);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        setEvents(data as ActivityEvent[]);
      }
    } catch (e) {
      console.error('Error fetching activity events:', e);
    } finally {
      setTimelineLoading(false);
    }
  }, [profile]);

  // 1. Fetch Timeline Events & Projects realtime
  useEffect(() => {
    if (!profile) return;

    fetchEvents();

    const orgId = profile.organization_id;
    const userId = profile.id;

    // Org-scoped realtime for live events timeline
    const channelName = `activity_events:${orgId ?? userId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_events',
        filter: orgId
          ? `organization_id=eq.${orgId}`
          : `user_id=eq.${userId}`,
      }, () => {
        fetchEvents();
      })
      .subscribe();

    // Subscribe to projects for realtime dashboard updates and the "magical" approval screen flash
    const projectsChannel = supabase
      .channel(`realtime_projects:${orgId ?? userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: orgId
          ? `organization_id=eq.${orgId}`
          : `user_id=eq.${userId}`,
      }, (payload) => {
        // Refetch projects list to update KPIs and Recent Bids table instantly
        fetchProjects();

        // Check for client approval event (magical part!)
        if (payload.eventType === 'UPDATE') {
          const oldRecord = payload.old as any;
          const newRecord = payload.new as any;
          
          // Trigger when status becomes 'approved'
          if (newRecord.status === 'approved' && (!oldRecord || oldRecord.status !== 'approved')) {
            setApprovedProposal(newRecord);
            setShowCelebration(true);
            
            // Play a cash register / chime sound
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav'); // cash register / chime sound
              audio.volume = 0.5;
              audio.play();
            } catch (err) {
              console.warn('Audio play failed:', err);
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(projectsChannel);
    };
  }, [profile, fetchEvents, fetchProjects]);

  // 2. Welcome modal: show only if onboarding NOT completed AND NOT dismissed
  //    Check both Supabase profile AND localStorage to prevent any flash/repetition
  useEffect(() => {
    if (!profile) return;
    setProfileChecked(true);

    const userId = profile.id;
    const localCompleted = localStorage.getItem(`peak_onboarding_completed_${userId}`) === 'true';
    const localDismissed = localStorage.getItem(`peak_onboarding_dismissed_${userId}`) === 'true';

    const isCompleted = profile.onboarding_completed || localCompleted;
    const isDismissed = (profile.onboarding_dismissed ?? false) || localDismissed;

    if (!isCompleted && !isDismissed) {
      // Small delay so the page renders first — avoids janky overlap
      const t = setTimeout(() => setShowWelcomeModal(true), 600);
      return () => clearTimeout(t);
    }
  }, [profile]);

  // 3. Guided Tour: only after profile loaded, welcome modal closed, not already dismissed
  useEffect(() => {
    if (!profile || showWelcomeModal || !profileChecked) return;

    const userId = profile.id;
    const localTourDismissed = localStorage.getItem(`peak_helper_dismissed_dashboard_tour_${userId}`) === 'true';
    const dbTourDismissed = profile.has_dismissed_helpers?.includes('dashboard_tour');

    if (!localTourDismissed && !dbTourDismissed) {
      const timer = setTimeout(() => setTourStep(1), 1200);
      return () => clearTimeout(timer);
    }
  }, [profile, showWelcomeModal, profileChecked]);

  // Log a seed event when timeline is empty (first login demonstration)
  useEffect(() => {
    if (!projectsLoading && events.length === 0 && profile) {
      triggerEvent({
        entityType: 'onboarding',
        actionType: 'started',
        title: 'Contractor Operations Initialized',
        description: 'First login complete. Setup checklists and concierge pipeline are live.',
        metadata: { source: 'System Auto-Gen' }
      }).then(() => fetchEvents());
    }
  }, [projectsLoading, events.length, profile]);

  // Dismiss helper: write to BOTH localStorage and Supabase
  const dismissHelper = async (helperId: string) => {
    if (!profile) return;
    const userId = profile.id;

    // 1. Local storage (instant, survives refresh)
    localStorage.setItem(`peak_helper_dismissed_${helperId}_${userId}`, 'true');

    // 2. Supabase (persists across devices)
    const current = profile.has_dismissed_helpers || [];
    if (!current.includes(helperId)) {
      const updated = [...current, helperId];
      await updateProfile({ has_dismissed_helpers: updated });
    }
  };

  const finishTour = async () => {
    setTourStep(null);
    await dismissHelper('dashboard_tour');
    triggerEvent({
      entityType: 'onboarding',
      actionType: 'completed',
      title: 'Guided Operations Tour Completed',
      description: 'You are now ready to operate PeakEstimator at full velocity.',
      sendNotification: true,
      notificationType: 'success'
    });
  };

  const handleWelcomeClose = () => {
    setShowWelcomeModal(false);
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const pipeline = projects.reduce((s, p) => s + (p.total_value || 0), 0);
    const won = projects.filter(p => ['won', 'approved'].includes(p.status)).length;
    const active = projects.filter(p => ['lead', 'bidding', 'sent'].includes(p.status)).length;
    const winRate = projects.length > 0 ? Math.round((won / projects.length) * 100) : 0;
    return { pipeline, won, active, winRate };
  }, [projects]);

  // Status and trade mix charts
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ 
      status, 
      count, 
      fill: STATUS_COLORS[status as StatusType] || '#94A3B8'
    }));
  }, [projects]);

  const tradeData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.trade] = (counts[p.trade] || 0) + 1; });
    return Object.entries(counts).map(([trade, value]) => ({ trade, value }));
  }, [projects]);

  // 3. Calculate Account Success Health Score dynamically
  const healthMetrics = useMemo(() => {
    if (!profile) return { score: 0, steps: [] };

    const steps = [
      { id: 'profile', name: 'Complete profile configuration', completed: !!profile.company_name, pts: 30 },
      { id: 'revenue_pipeline', name: 'Create active revenue opportunities', completed: projects.length > 0, pts: 25 },
      { id: 'markup', name: 'Configure default markup settings', completed: profile.default_labor_markup > 0, pts: 15 },
      { id: 'success_hub', name: 'Connect Concierge Integration request', completed: !!profile.concierge_requested, pts: 15 },
      { id: 'logo', name: 'Upload professional company branding logo', completed: !!profile.company_logo, pts: 15 },
    ];

    const score = steps.reduce((sum, s) => sum + (s.completed ? s.pts : 0), 0);
    return { score, steps };
  }, [profile, projects]);

  const recentProjects = projects.slice(0, 5);

  if (projectsLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-copper border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check localStorage first (instant, no flashing) then fall back to DB state
  const isHelperDismissed = (id: string) => {
    if (!profile) return true; // Hide while loading — prevents flash
    const localKey = `peak_helper_dismissed_${id}_${profile.id}`;
    if (localStorage.getItem(localKey) === 'true') return true;
    return profile.has_dismissed_helpers?.includes(id) ?? false;
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in font-inter select-none relative">
      {/* Welcome Onboarding Modal — shows once for new users, never repeats */}
      {showWelcomeModal && <WelcomeModal onClose={handleWelcomeClose} />}
      {/* ── Spotlight / Guided Tour Render ───────────────────── */}
      {tourStep !== null && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-premium p-6 rounded-2xl max-w-md w-full animate-scale-in relative">
            <button 
              onClick={finishTour}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 border border-transparent hover:border-slate-200 dark:hover:border-navy-750"
              title="Close Tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-copper animate-bounce" />
              <span className="text-xs font-bold text-copper uppercase tracking-wider">Spotlight Tour ({tourStep}/3)</span>
            </div>

            {tourStep === 1 && (
              <div>
                <h3 className="text-lg font-bold font-sora text-slate-900 dark:text-white mb-2">The Executive Command Center</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-6">
                  Welcome to PeakEstimator, optimized for contractor operations. Track your entire project lifecycle, configure markups, and request bespoke custom integrations from your single dashboard.
                </p>
                <div className="flex items-center justify-between">
                  <button onClick={finishTour} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium">Skip Tour</button>
                  <button onClick={() => setTourStep(2)} className="px-4 py-2 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1">
                    Next Highlight <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {tourStep === 2 && (
              <div>
                <h3 className="text-lg font-bold font-sora text-slate-900 dark:text-white mb-2">Dynamic Smart Health Score</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-6">
                  Maintain your operational readiness score out of 100. By completing setup, connecting workflow tools, and building active revenue opportunities, you increase close-rate visibility and operating discipline.
                </p>
                <div className="flex items-center justify-between">
                  <button onClick={() => setTourStep(1)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium">Back</button>
                  <button onClick={() => setTourStep(3)} className="px-4 py-2 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1">
                    Next Highlight <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {tourStep === 3 && (
              <div>
                <h3 className="text-lg font-bold font-sora text-slate-900 dark:text-white mb-2">Universal Activity Timeline</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-6">
                  A centralized event bus logs every single action: client approvals, custom integrations requested, SLA support replies, and price list edits. Enjoy complete audit control over your team operations.
                </p>
                <div className="flex items-center justify-between">
                  <button onClick={() => setTourStep(2)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium">Back</button>
                  <button onClick={finishTour} className="px-5 py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1">
                    Begin Operations <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Title Banner Helper ───────────────────────────── */}
      {!isHelperDismissed('dashboard_welcome') && (
        <div className="bg-gradient-to-r from-navy-950 to-navy-900 border border-navy-800 rounded-2xl p-5 mb-6 relative overflow-hidden transition-all duration-200">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient opacity-10 pointer-events-none" />
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-copper-950/45 border border-copper-900/40 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-copper" />
            </div>
            <div className="flex-1 pr-6">
              <h4 className="text-sm font-bold text-white font-sora">Peak Contractor Operations Engine</h4>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-2xl">
                Welcome to your contractor revenue infrastructure workspace. Use the setup checklist below to configure pricing controls, proposal systems, follow-up workflows, and revenue intelligence.
              </p>
            </div>
            <button
              onClick={() => dismissHelper('dashboard_welcome')}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-sora font-extrabold text-slate-900 dark:text-white">Revenue Command Center</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Pipeline, margin, proposal, and follow-up intelligence in one operating system</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => navigate('/success')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-navy-950 dark:hover:bg-navy-900 border border-slate-200 dark:border-navy-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all"
          >
            <Star className="w-4 h-4 text-copper" />
            Concierge Setup
          </button>
          <button
            id="dashboard-new-bid"
            onClick={() => navigate('/projects')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-4 h-4" />
            New Opportunity
          </button>
        </div>
      </div>

      {/* Primary Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Grid: KPIs, Charts, Bids (Columns 1-7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Pipeline"
              value={formatCurrency(kpis.pipeline)}
              icon={TrendingUp}
              color="navy"
              sub={`${projects.length} total projects`}
            />
            <KpiCard
              label="Projects Won"
              value={kpis.won.toString()}
              icon={CheckCircle}
              color="emerald"
              sub="Closed deals"
            />
            <KpiCard
              label="Active Revenue"
              value={kpis.active.toString()}
              icon={Briefcase}
              color="amber"
              sub="In progress"
            />
            <KpiCard
              label="Win Rate"
              value={`${kpis.winRate}%`}
              icon={Target}
              color="violet"
              sub="Of all submitted"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Status Chart */}
            <div className="md:col-span-3 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-sora font-bold text-slate-900 dark:text-white mb-1">Projects by Status</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Distribution across pipeline stages</p>
              </div>
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-navy-800" />
                    <XAxis 
                      dataKey="status" 
                      tick={{ fontSize: 11, fill: '#64748B' }} 
                      axisLine={false} 
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#64748B' }} 
                      axisLine={false} 
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(197, 139, 92, 0.04)' }}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: '1px solid var(--tooltip-border, #E2E8F0)',
                        background: 'var(--tooltip-bg, #FFFFFF)',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                      }}
                      itemStyle={{ color: 'var(--tooltip-text, #111827)' }}
                      labelClassName="font-semibold text-slate-800 dark:text-slate-100"
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trade mix Chart */}
            <div className="md:col-span-2 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-sora font-bold text-slate-900 dark:text-white mb-1">Trade Mix</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-inter">Core segments</p>
              </div>
              {tradeData.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-slate-500 dark:text-slate-400 text-xs">
                  No trade data
                </div>
              ) : (
                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={tradeData} 
                        dataKey="value" 
                        nameKey="trade" 
                        cx="50%" 
                        cy="45%" 
                        outerRadius={65} 
                        innerRadius={40} 
                        paddingAngle={3}
                      >
                        {tradeData.map((_, i) => (
                          <Cell key={i} fill={TRADE_COLORS[i % TRADE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend 
                        iconSize={6} 
                        iconType="circle" 
                        wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} 
                        className="text-slate-900 dark:text-white font-inter"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: '1px solid var(--tooltip-border, #E2E8F0)', 
                          background: 'var(--tooltip-bg, #FFFFFF)',
                          fontSize: '11px' 
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Recent Projects Table */}
          <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-app-border dark:border-navy-800">
              <h2 className="text-sm font-sora font-bold text-slate-900 dark:text-white">Recent Revenue Opportunities</h2>
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-1.5 text-xs text-copper font-bold hover:text-copper-hover transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentProjects.length === 0 ? (
              <div className="py-16 text-center px-6">
                <div className="w-12 h-12 bg-slate-50 dark:bg-navy-950 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-app-border dark:border-navy-850">
                  <Briefcase className="w-5 h-5 text-slate-400 dark:text-slate-600" />
                </div>
                <p className="text-slate-900 dark:text-white text-sm font-semibold">No revenue opportunities created yet</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                  Create your first opportunity to activate pipeline visibility, margin intelligence, proposal analytics, and automated follow-up.
                </p>
                <button
                  onClick={() => navigate('/projects')}
                  className="mt-5 px-5 py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl text-sm font-bold transition-all shadow-md"
                >
                  Create First Opportunity
                </button>
              </div>
            ) : (
              <div className="divide-y divide-app-border dark:divide-navy-800 overflow-x-auto scrollbar-thin">
                <div className="min-w-[600px]">
                  {recentProjects.map(project => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-navy-950/60 cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{project.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-navy-950 rounded border border-slate-200 dark:border-navy-850 capitalize font-bold">
                            {project.trade}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{project.client_name || 'No client listed'}</div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getStatusClass(project.status)}`}>
                          {project.status}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white min-w-[100px] text-right">
                          {formatCurrency(project.total_value || 0)}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400 dark:text-navy-700" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Grid: Health Score, Setup, Events (Columns 8-10) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Dashboard Widget: Account Health Score */}
          <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-sora font-bold text-slate-900 dark:text-white">Revenue Readiness Score</h2>
                <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500">
                  <Heart className="w-4 h-4 fill-current animate-pulse" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Operational rating based on revenue setup, follow-up discipline, branding, pricing controls, and workflow integrations.
              </p>

              {/* Progress gauge */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative w-16 h-16 rounded-full border-4 border-slate-100 dark:border-navy-950 flex items-center justify-center flex-shrink-0">
                  <div className="text-base font-extrabold text-slate-900 dark:text-white font-sora">
                    {healthMetrics.score}
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-copper border-t-transparent border-r-transparent animate-spin-slow pointer-events-none opacity-40" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {healthMetrics.score >= 80 ? 'Excellent Status' : healthMetrics.score >= 50 ? 'Medium Status' : 'Attention Required'}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {healthMetrics.score === 100 ? 'All systems nominal' : 'Optimize to secure power utilization'}
                  </p>
                </div>
              </div>

              {/* Setup items checklist */}
              <div className="space-y-3.5">
                {healthMetrics.steps.map(step => (
                  <div key={step.id} className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
                      step.completed 
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' 
                        : 'border-slate-300 dark:border-navy-700 text-slate-400'
                    }`}>
                      {step.completed ? <Check className="w-3 h-3 stroke-[3]" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-navy-700" />}
                    </div>
                    <div className="flex-1">
                      <span className={`text-[11px] font-medium leading-tight ${
                        step.completed ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'
                      }`}>
                        {step.name}
                      </span>
                      <span className="text-[9px] text-copper font-bold block mt-0.5">+{step.pts} Points</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick action direct to client success hub */}
            {healthMetrics.score < 100 && (
              <button 
                onClick={() => navigate('/success')}
                className="mt-6 w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-navy-950 dark:hover:bg-navy-900 border border-slate-200 dark:border-navy-850 hover:border-slate-300 dark:hover:border-navy-750 rounded-xl text-xs font-bold text-copper flex items-center justify-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                Boost Health Rating
              </button>
            )}
          </div>

          {/* Activity Events Timeline Feed */}
          <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-5 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-copper" />
                <h2 className="text-sm font-sora font-bold text-slate-900 dark:text-white">Activity Timeline</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Live Logs</span>
            </div>

            {timelineLoading ? (
              <div className="py-10 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-copper border-t-transparent rounded-full animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center">
                <Info className="w-6 h-6 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">No activity logged yet.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                {events.map((e, index) => (
                  <div key={e.id || index} className="flex gap-3 relative pl-3.5 last:pb-0 pb-1">
                    {/* Timeline line */}
                    {index < events.length - 1 && (
                      <div className="absolute left-[20px] top-6 bottom-0 w-0.5 bg-slate-100 dark:bg-navy-850" />
                    )}

                    {/* Timeline indicator circle */}
                    <div className="absolute left-[13px] top-1.5 w-4 h-4 rounded-full bg-slate-50 dark:bg-navy-950 border-2 border-copper flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-copper" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-slate-800 dark:text-white capitalize truncate">
                          {e.metadata?.title || `${e.entity_type} ${e.action_type}`}
                        </span>
                        <span className="text-[8px] font-semibold text-slate-400 whitespace-nowrap">
                          {new Date(e.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                        {e.metadata?.description || `Operation performed on ${e.entity_type}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ─── LIVE PROPOSAL APPROVAL CELEBRATION MODAL ─── */}
      {showCelebration && approvedProposal && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-md z-[101] flex items-center justify-center p-4 animate-fade-in">
          {/* Confetti particles background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_, i) => {
              const randomLeft = Math.random() * 100;
              const randomDelay = Math.random() * 5;
              const randomDuration = 3 + Math.random() * 4;
              const colors = ['#C58B5C', '#10B981', '#F59E0B', '#3B82F6', '#EC4899'];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];
              return (
                <div
                  key={i}
                  className="absolute w-2.5 h-2.5 rounded-sm opacity-80 animate-bounce"
                  style={{
                    left: `${randomLeft}%`,
                    top: `-10px`,
                    backgroundColor: randomColor,
                    transform: `rotate(${Math.random() * 360}deg)`,
                    animation: `fall ${randomDuration}s linear ${randomDelay}s infinite`,
                  }}
                />
              );
            })}
            <style>{`
              @keyframes fall {
                0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
                100% { transform: translateY(105vh) rotate(360deg); opacity: 0; }
              }
            `}</style>
          </div>

          <div className="bg-white dark:bg-navy-900 border-2 border-emerald-500/30 dark:border-emerald-500/40 shadow-[0_0_50px_rgba(16,185,129,0.25)] p-8 rounded-3xl max-w-lg w-full animate-scale-in text-center relative overflow-hidden">
            {/* Green glowing background */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-20 h-20 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>

            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Live Deal Closed!
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold font-sora text-slate-900 dark:text-white mb-2 leading-tight">
              Revenue Opportunity Won
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              Your client <strong className="text-slate-800 dark:text-white">{approvedProposal.client_name}</strong> just signed and moved revenue into the won column:
            </p>

            {/* Quote details card */}
            <div className="bg-slate-50 dark:bg-navy-950 border border-slate-200/50 dark:border-navy-800 rounded-2xl p-5 mb-8 text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-navy-850 pb-2.5">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Project Name</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{approvedProposal.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-navy-850 pb-2.5">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Investment Value</span>
                <span className="text-lg font-extrabold text-copper font-sora">
                  {formatCurrency(approvedProposal.total_value || 0)}
                </span>
              </div>
              {approvedProposal.selected_option_tier && (
                <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-navy-850 pb-2.5">
                  <span className="text-xs text-slate-450 font-bold uppercase tracking-wider">Selected Package</span>
                  <span className="text-xs font-black uppercase tracking-wider bg-copper-100/50 dark:bg-copper-950/40 text-copper border border-copper-200/20 px-2.5 py-0.5 rounded-md">
                    ⭐ {approvedProposal.selected_option_tier}
                  </span>
                </div>
              )}
              {approvedProposal.signature_data && (
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-2">Signature Captured</span>
                  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-xl p-2.5 flex items-center justify-center" style={{ height: 64 }}>
                    <img src={approvedProposal.signature_data} alt="Client Signature" className="max-h-full dark:invert transition-colors" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowCelebration(false);
                  navigate(`/projects/${approvedProposal.id}`);
                }}
                className="flex-1 py-3 px-5 bg-copper hover:bg-copper-hover text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0"
              >
                Open Workspace <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowCelebration(false)}
                className="flex-1 py-3 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-750 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all border border-slate-200 dark:border-navy-750"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, color, sub
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'navy' | 'copper' | 'emerald' | 'amber' | 'violet';
  sub: string;
}) {
  const colorMap = {
    navy: 'bg-slate-100 dark:bg-navy-950 text-navy dark:text-slate-200 border border-slate-200 dark:border-navy-850',
    copper: 'bg-copper-100/50 dark:bg-copper-950/30 text-copper dark:text-copper-300 border border-copper-200/30 dark:border-copper-900/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30',
    amber: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30',
    violet: 'bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30',
  };

  return (
    <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl p-5 transition-all hover:border-slate-300 dark:hover:border-navy-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-sora font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">{value}</div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">{sub}</div>
    </div>
  );
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    lead: 'status-lead',
    bidding: 'status-bidding',
    sent: 'status-sent',
    approved: 'status-approved',
    won: 'status-won',
    lost: 'status-lost',
  };
  return map[status] || 'status-lead';
}
