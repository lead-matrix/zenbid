import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, ArrowRight, Filter } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import AddProjectModal from '../components/projects/AddProjectModal';
import { formatCurrency } from '../lib/calculations';
import { TRADE_EMOJIS } from '../types';
import type { StatusType } from '../types';

const STATUS_TABS: { value: StatusType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'lead', label: 'Lead' },
  { value: 'bidding', label: 'Bidding' },
  { value: 'sent', label: 'Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export default function Projects() {
  const navigate = useNavigate();
  const { projects, loading, createProject, deleteProject } = useProjects();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusType | 'all'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = projects.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project? This action cannot be undone.')) return;
    setDeletingId(id);
    await deleteProject(id);
    setDeletingId(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 text-sm mt-0.5">{projects.length} total bids</p>
        </div>
        <button
          id="projects-new-bid"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-copper hover:bg-copper-600 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-copper-200/50"
        >
          <Plus className="w-4 h-4" />
          New Bid
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="projects-search"
            type="text"
            placeholder="Search by name or client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-copper-500/20 focus:border-copper-400 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === tab.value
                  ? 'bg-copper text-white shadow-sm shadow-copper-200/40'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-copper-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Filter className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">
              {search || statusFilter !== 'all' ? 'No projects match your filters' : 'No projects yet'}
            </p>
            {!search && statusFilter === 'all' && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 px-5 py-2 bg-copper text-white rounded-xl text-sm font-semibold hover:bg-copper-600 transition-colors shadow-md shadow-copper-200/50"
              >
                Create First Project
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50">
              <div className="col-span-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</div>
              <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</div>
              <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trade</div>
              <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Value</div>
              <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</div>
              <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50">
              {filtered.map(project => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/80 cursor-pointer transition-colors items-center"
                >
                  <div className="col-span-3 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{project.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <div className="text-sm text-slate-700 truncate">{project.client_name || '—'}</div>
                    <div className="text-xs text-slate-400 truncate">{project.client_email || ''}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm">
                      {TRADE_EMOJIS[project.trade]} <span className="capitalize text-slate-700">{project.trade}</span>
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(project.total_value || 0)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${getStatusClass(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <button
                      onClick={e => handleDelete(e, project.id)}
                      disabled={deletingId === project.id}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <AddProjectModal
          onClose={() => setShowModal(false)}
          onCreate={createProject}
        />
      )}
    </div>
  );
}

function getStatusClass(status: string) {
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
