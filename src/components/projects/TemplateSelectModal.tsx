import { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';
import { Search, Layers, X, FileText, CheckCircle } from 'lucide-react';
import type { TradeType, CategoryType } from '../../types';
import { TRADE_EMOJIS, CATEGORY_COLORS } from '../../types';
import { toast } from 'sonner';

interface TemplateSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyItems: (items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    category: CategoryType;
    markup: number;
  }>) => void;
  projectTrade?: TradeType;
}

interface TemplateWithItems {
  id: string;
  name: string;
  description: string;
  trade: TradeType;
  is_global: boolean;
  template_items?: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    category: CategoryType;
    markup: number;
  }>;
}

export default function TemplateSelectModal({
  isOpen,
  onClose,
  onApplyItems,
  projectTrade,
}: TemplateSelectModalProps) {
  const [templates, setTemplates] = useState<TemplateWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<TradeType | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithItems | null>(null);

  useEffect(() => {
    if (projectTrade) {
      setSelectedTrade(projectTrade);
    }
  }, [projectTrade]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      // Fetch templates
      const { data: templatesData, error: tError } = await supabase
        .from('templates')
        .select('*')
        .order('name');

      if (tError) throw tError;

      // Fetch template items
      const { data: itemsData, error: iError } = await supabase
        .from('template_items')
        .select('*')
        .order('sort_order');

      if (iError) throw iError;

      // Map template items to their parent templates
      const mappedTemplates: TemplateWithItems[] = (templatesData || []).map(t => ({
        ...t,
        template_items: (itemsData || []).filter(item => item.template_id === t.id)
      }));

      setTemplates(mappedTemplates);
      
      // Auto-select first template if available
      if (mappedTemplates.length > 0) {
        setSelectedTemplate(mappedTemplates[0]);
      }
    } catch (err: any) {
      console.error('[TemplateSelectModal] Error fetching templates:', err);
      toast.error('Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!selectedTemplate || !selectedTemplate.template_items || selectedTemplate.template_items.length === 0) {
      toast.warning('Selected template has no items.');
      return;
    }

    onApplyItems(selectedTemplate.template_items);
    toast.success(`Successfully loaded "${selectedTemplate.name}" template items!`);
    onClose();
  };

  if (!isOpen) return null;

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrade = selectedTrade === 'all' || t.trade === selectedTrade;
    return matchesSearch && matchesTrade;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-premium overflow-hidden transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-navy-850 bg-slate-50 dark:bg-navy-900/50">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-sora text-slate-800 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-copper" />
              Contracting Trade Templates
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-inter mt-0.5">Quickly import pre-configured assemblies of line items and materials</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-navy-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-6 py-3.5 border-b border-slate-100 dark:border-navy-850/80 bg-white dark:bg-navy-900">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-navy-800 rounded-xl text-xs bg-slate-50/50 dark:bg-navy-950 text-slate-800 dark:text-white focus:border-copper focus:ring-1 focus:ring-copper/30 transition-all font-inter"
            />
          </div>
          <div className="md:col-span-6 flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {(['all', 'electrical', 'roofing', 'hvac', 'painting', 'plumbing', 'drain', 'general'] as const).map(tr => (
              <button
                key={tr}
                onClick={() => setSelectedTrade(tr)}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border capitalize transition-all whitespace-nowrap ${
                  selectedTrade === tr
                    ? 'bg-copper border-transparent text-white shadow-sm'
                    : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-750 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tr === 'all' ? '🌐 All' : `${TRADE_EMOJIS[tr as TradeType] || '📋'} ${tr}`}
              </button>
            ))}
          </div>
        </div>

        {/* Workspace body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-navy-850 bg-slate-50 dark:bg-navy-950/20">
          
          {/* Templates lists (Left) */}
          <div className="md:col-span-5 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2">
                <div className="w-6 h-6 border-2 border-copper border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-inter">Loading libraries...</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-400 dark:text-slate-500 font-inter">No templates found for selection.</p>
              </div>
            ) : (
              filteredTemplates.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 hover:scale-[1.01] ${
                    selectedTemplate?.id === tmpl.id
                      ? 'bg-white dark:bg-navy-800 border-copper shadow-soft'
                      : 'bg-white dark:bg-navy-900 border-slate-150 dark:border-navy-850 hover:bg-slate-50 dark:hover:bg-navy-850/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold font-sora px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-950 text-slate-500 dark:text-slate-400 capitalize">
                      {TRADE_EMOJIS[tmpl.trade]} {tmpl.trade}
                    </span>
                    {tmpl.is_global && (
                      <span className="text-[9px] font-bold text-copper dark:text-amber-500 bg-copper-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Global
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold font-sora text-slate-800 dark:text-white">{tmpl.name}</h3>
                  <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-inter mt-1 line-clamp-2 leading-relaxed">{tmpl.description}</p>
                </button>
              ))
            )}
          </div>

          {/* Template Details / Items Preview (Right) */}
          <div className="md:col-span-7 flex flex-col min-h-0 bg-white dark:bg-navy-900">
            {selectedTemplate ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Details Header */}
                <div className="p-5 border-b border-slate-100 dark:border-navy-850">
                  <h3 className="text-sm sm:text-base font-extrabold font-sora text-slate-800 dark:text-white flex items-center gap-2">
                    {TRADE_EMOJIS[selectedTemplate.trade]}
                    {selectedTemplate.name}
                  </h3>
                  <p className="text-xs text-slate-450 dark:text-slate-400 font-inter mt-1.5 leading-relaxed">{selectedTemplate.description}</p>
                </div>

                {/* Items list */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  <h4 className="text-[11px] font-bold font-sora text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Assembly Items ({selectedTemplate.template_items?.length || 0})
                  </h4>
                  {selectedTemplate.template_items && selectedTemplate.template_items.length > 0 ? (
                    selectedTemplate.template_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950/60 rounded-xl border border-slate-100 dark:border-navy-850"
                      >
                        <div className="min-w-0 pr-4">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 font-inter truncate">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded-md uppercase ${CATEGORY_COLORS[item.category]}`}>
                              {item.category}
                            </span>
                            <span className="text-[10px] text-slate-400 font-inter">
                              {item.quantity} {item.unit} @ ${item.unit_price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-extrabold font-sora text-slate-900 dark:text-slate-100">
                            ${(item.quantity * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <span className="text-[9.5px] text-emerald-500 dark:text-emerald-400 font-medium font-inter">
                            +{item.markup}% markup
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 font-inter py-6">No items configured in this template.</p>
                  )}
                </div>

                {/* Apply footer bar */}
                <div className="p-4 border-t border-slate-100 dark:border-navy-850 flex items-center justify-end bg-slate-50/50 dark:bg-navy-950/20">
                  <button
                    onClick={handleApply}
                    className="flex items-center gap-1.5 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Apply Assembly Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <FileText className="w-12 h-12 text-slate-350 dark:text-slate-700 mb-2" />
                <span className="text-xs font-inter">Select a template to view details</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
