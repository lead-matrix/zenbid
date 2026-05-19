import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, Briefcase, CheckCircle, Target, Plus, ArrowRight } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { formatCurrency } from '../lib/calculations';
import type { StatusType } from '../types';

const STATUS_COLORS: Record<StatusType, string> = {
  lead: '#94A3B8',
  bidding: '#1C2B5C',
  sent: '#C07840',
  approved: '#10B981',
  won: '#059669',
  lost: '#F43F5E',
};

const TRADE_COLORS = ['#1C2B5C','#C07840','#10B981','#F59E0B','#F43F5E','#8B5CF6','#06B6D4','#64748B'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, loading } = useProjects();

  const kpis = useMemo(() => {
    const pipeline = projects.reduce((s, p) => s + (p.total_value || 0), 0);
    const won = projects.filter(p => p.status === 'won').length;
    const active = projects.filter(p => ['bidding','sent','approved'].includes(p.status)).length;
    const winRate = projects.length > 0 ? Math.round((won / projects.length) * 100) : 0;
    return { pipeline, won, active, winRate };
  }, [projects]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count, fill: STATUS_COLORS[status as StatusType] }));
  }, [projects]);

  const tradeData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.trade] = (counts[p.trade] || 0) + 1; });
    return Object.entries(counts).map(([trade, value]) => ({ trade, value }));
  }, [projects]);

  const recentProjects = projects.slice(0, 5);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-copper-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Your bidding pipeline at a glance</p>
        </div>
        <button
          id="dashboard-new-bid"
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 px-5 py-2.5 bg-copper hover:bg-copper-600 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-copper-200/50"
        >
          <Plus className="w-4 h-4" />
          New Bid
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
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
          label="Active Bids"
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

      {/* Charts */}
      <div className="grid grid-cols-5 gap-5 mb-8">
        {/* Bar chart */}
        <div className="col-span-3 bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Projects by Status</h2>
          <p className="text-xs text-slate-400 mb-5">Distribution across pipeline stages</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #F1F5F9', fontSize: '12px' }}
                cursor={{ fill: '#F8FAFC' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="col-span-2 bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Projects by Trade</h2>
          <p className="text-xs text-slate-400 mb-4">Your trade mix</p>
          {tradeData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={tradeData} dataKey="value" nameKey="trade" cx="50%" cy="45%" outerRadius={70} innerRadius={35}>
                  {tradeData.map((_, i) => (
                    <Cell key={i} fill={TRADE_COLORS[i % TRADE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <h2 className="text-sm font-semibold text-slate-800">Recent Projects</h2>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 text-xs text-copper font-semibold hover:text-copper-600 transition-colors"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm font-medium">No projects yet</p>
            <p className="text-slate-400 text-xs mt-1">Create your first bid to get started</p>
            <button
              onClick={() => navigate('/projects')}
              className="mt-4 px-5 py-2 bg-copper text-white rounded-xl text-sm font-semibold hover:bg-copper-600 transition-colors shadow-md shadow-copper-200/50"
            >
              Create First Bid
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentProjects.map(project => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="flex items-center px-6 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{project.name}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">{project.client_name || 'No client'}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${getStatusClass(project.status)}`}>
                    {project.status}
                  </span>
                  <span className="text-sm font-bold text-slate-900 min-w-24 text-right">
                    {formatCurrency(project.total_value || 0)}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
    navy: 'bg-navy-50 text-navy-600',
    copper: 'bg-copper-50 text-copper-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
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
