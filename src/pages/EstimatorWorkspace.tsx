import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '../hooks/useProjects';
import { useProjectItems } from '../hooks/useProjectItems';
import { calcTotals } from '../lib/calculations';
import LineItemsTable from '../components/estimator/LineItemsTable';
import TotalsSidebar from '../components/estimator/TotalsSidebar';
import PriceBookDrawer from '../components/estimator/PriceBookDrawer';
import MarkupSettings from '../components/estimator/MarkupSettings';
import type { Project, StatusType, ProjectItem } from '../types';
import { TRADE_EMOJIS } from '../types';
import { supabase } from '../api/supabase';

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
  const { project, loading: projLoading, updateProject } = useProject(id);
  const { items, loading: itemsLoading, addItem, updateItem, deleteItem, reorderItems } = useProjectItems(id);

  const [priceBookOpen, setPriceBookOpen] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [notes, setNotes] = useState('');
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync notes from project
  useEffect(() => {
    if (project) setNotes(project.notes || '');
  }, [project?.id]);

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

  const handleCopyLink = () => {
    if (!project) return;
    const url = `${window.location.origin}/approve/${project.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Client link copied to clipboard!');
  };

  const handleExportPDF = async () => {
    if (!project) return;
    setExportingPDF(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ projectId: project.id }),
      });

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      // Edge function returns HTML with auto-print — open in a new tab
      const html = await response.text();
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        toast.error('Pop-up blocked. Please allow pop-ups for this site.');
      } else {
        toast.success('Print dialog opening…');
        // Cleanup URL after print window loads
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch {
      toast.error('PDF generation failed. Check edge function deployment.');
    } finally {
      setExportingPDF(false);
    }
  };

  if (projLoading || itemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-slate-500">Project not found</p>
          <button onClick={() => navigate('/projects')} className="mt-3 text-indigo-600 text-sm font-medium">
            ← Back to projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 animate-fade-in">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <button
            onClick={() => navigate('/projects')}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{TRADE_EMOJIS[project.trade]}</span>
              <h1 className="text-base font-bold text-slate-900 truncate">{project.name}</h1>
            </div>
            {project.client_name && (
              <p className="text-xs text-slate-400 pl-7">Client: {project.client_name}</p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Status dropdown */}
            <div className="relative group">
              <button
                id="status-dropdown"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${STATUS_LABEL_COLORS[project.status]}`}
              >
                <span className="capitalize">{project.status}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1 w-36 hidden group-hover:block z-50">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold capitalize hover:bg-slate-50 transition-colors ${project.status === s ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              id="share-btn"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>

            <button
              id="export-pdf-topbar"
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-200 disabled:opacity-60"
            >
              {exportingPDF ? 'Generating...' : '📄 Export PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-3 gap-5 p-6 max-w-7xl w-full mx-auto">
        {/* Left: Line items */}
        <div className="col-span-2 space-y-4">
          <LineItemsTable
            items={items}
            onAdd={handleAddItem}
            onUpdate={updateItem}
            onDelete={deleteItem}
            onReorder={reorderItems}
            onOpenPriceBook={() => setPriceBookOpen(true)}
          />

          <MarkupSettings
            project={project}
            onUpdate={handleMarkupUpdate}
          />
        </div>

        {/* Right: Sticky totals sidebar */}
        <div className="col-span-1">
          <div className="sticky top-[72px]">
            <TotalsSidebar
              totals={totals}
              notes={notes}
              onNotesChange={handleNotesChange}
              onExportPDF={handleExportPDF}
              onCopyLink={handleCopyLink}
              exportingPDF={exportingPDF}
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
    </div>
  );
}
