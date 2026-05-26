/**
 * ProposalAnalyticsPanel.tsx
 * Shows the contractor a summary of client engagement on a shared proposal.
 * Data comes from the proposal_analytics table populated by proposalAnalytics.ts
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../api/supabase';
import { Eye, Clock, MousePointerClick, Smartphone, Monitor, Tablet, RefreshCw } from 'lucide-react';

interface AnalyticsRow {
  id: string;
  project_id: string;
  event_type: 'viewed' | 'section_viewed' | 'tier_hovered' | 'time_spent' | 'link_opened';
  metadata: Record<string, any>;
  session_id?: string;
  device_type?: 'mobile' | 'desktop' | 'tablet';
  created_at: string;
}

interface Props {
  projectId: string;
}

function DeviceIcon({ type }: { type?: string }) {
  if (type === 'mobile') return <Smartphone className="w-3.5 h-3.5" />;
  if (type === 'tablet') return <Tablet className="w-3.5 h-3.5" />;
  return <Monitor className="w-3.5 h-3.5" />;
}

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ProposalAnalyticsPanel({ projectId }: Props) {
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('proposal_analytics')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!error && data) setRows(data as AnalyticsRow[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Live updates via realtime
    const channel = supabase
      .channel(`analytics:${projectId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'proposal_analytics',
        filter: `project_id=eq.${projectId}`,
      }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  if (loading) {
    return (
      <div className="py-8 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-copper border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Derived stats ───────────────────────────────────────────────────────
  const viewEvents       = rows.filter(r => r.event_type === 'viewed');
  const timeEvents       = rows.filter(r => r.event_type === 'time_spent');
  const tierHoverEvents  = rows.filter(r => r.event_type === 'tier_hovered');
  const sectionEvents    = rows.filter(r => r.event_type === 'section_viewed');

  const uniqueSessions   = new Set(rows.map(r => r.session_id).filter(Boolean)).size;
  const totalTimeSpent   = timeEvents.reduce((sum, r) => sum + (r.metadata?.seconds ?? 0), 0);
  const avgTimeSpent     = timeEvents.length > 0 ? Math.round(totalTimeSpent / timeEvents.length) : 0;
  const lastOpened       = viewEvents[0]?.created_at;

  // Device breakdown
  const deviceCounts = rows.reduce((acc, r) => {
    const d = r.device_type || 'desktop';
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalDeviceEvents = Object.values(deviceCounts).reduce((a, b) => a + b, 0);

  // Tier hover counts
  const tierCounts = tierHoverEvents.reduce((acc, r) => {
    const t = r.metadata?.tier || 'unknown';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Section views
  const sectionCounts = sectionEvents.reduce((acc, r) => {
    const s = r.metadata?.section || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topSections = Object.entries(sectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hasData = rows.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Client Engagement
        </p>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-copper transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!hasData ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No views yet</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Share the proposal link — activity will appear here in real time.
          </p>
        </div>
      ) : (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <Eye className="w-4 h-4 text-copper" />, label: 'Opens', value: viewEvents.length },
              { icon: <Eye className="w-4 h-4 text-blue-400" />, label: 'Sessions', value: uniqueSessions },
              { icon: <Clock className="w-4 h-4 text-emerald-500" />, label: 'Avg Time', value: avgTimeSpent > 0 ? fmtTime(avgTimeSpent) : '—' },
              { icon: <MousePointerClick className="w-4 h-4 text-violet-400" />, label: 'Tier Hovers', value: tierHoverEvents.length },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-50 dark:bg-navy-800 rounded-xl p-3 flex items-start gap-2">
                <div className="mt-0.5">{stat.icon}</div>
                <div>
                  <div className="text-lg font-bold font-sora text-slate-900 dark:text-white leading-none">
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Last opened ── */}
          {lastOpened && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Last opened: <span className="font-medium text-slate-600 dark:text-slate-300">{timeAgo(lastOpened)}</span>
            </p>
          )}

          {/* ── Device breakdown ── */}
          {totalDeviceEvents > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Device Split</p>
              <div className="flex items-center gap-3 flex-wrap">
                {(['desktop', 'mobile', 'tablet'] as const).map(d => {
                  const count = deviceCounts[d] || 0;
                  const pct = totalDeviceEvents > 0 ? Math.round((count / totalDeviceEvents) * 100) : 0;
                  return (
                    <div key={d} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <DeviceIcon type={d} />
                      <span className="capitalize">{d}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Tier interest ── */}
          {Object.keys(tierCounts).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Package Interest (Tier Hovers)
              </p>
              <div className="space-y-1.5">
                {(['best', 'better', 'good'] as const).map(tier => {
                  const count = tierCounts[tier] || 0;
                  const max = Math.max(...Object.values(tierCounts), 1);
                  const pct = Math.round((count / max) * 100);
                  const colors: Record<string, string> = {
                    best: 'bg-copper',
                    better: 'bg-blue-400',
                    good: 'bg-slate-400',
                  };
                  return (
                    <div key={tier} className="flex items-center gap-2">
                      <span className="text-xs w-12 capitalize text-slate-600 dark:text-slate-300">{tier}</span>
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${colors[tier]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-5 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Top sections ── */}
          {topSections.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Most-Viewed Sections
              </p>
              <div className="flex flex-wrap gap-2">
                {topSections.map(([section, count]) => (
                  <span
                    key={section}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-navy-800 rounded-lg text-xs text-slate-600 dark:text-slate-300"
                  >
                    {section}
                    <span className="font-bold text-copper ml-0.5">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent activity feed ── */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Recent Activity
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {rows.slice(0, 20).map(row => {
                const label =
                  row.event_type === 'viewed' ? '👁 Proposal opened' :
                  row.event_type === 'time_spent' ? `⏱ Spent ${fmtTime(row.metadata?.seconds ?? 0)} reading` :
                  row.event_type === 'tier_hovered' ? `🔍 Hovered on ${row.metadata?.tier ?? ''} tier` :
                  row.event_type === 'section_viewed' ? `📖 Viewed "${row.metadata?.section ?? ''}"` :
                  row.event_type === 'link_opened' ? `🔗 Opened a link` :
                  row.event_type;
                return (
                  <div key={row.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{label}</span>
                    <div className="flex items-center gap-1.5 text-slate-400 flex-shrink-0 ml-2">
                      <DeviceIcon type={row.device_type} />
                      <span>{timeAgo(row.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
