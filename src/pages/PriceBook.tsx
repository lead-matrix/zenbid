import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Check, X } from 'lucide-react';
import { usePriceBook } from '../hooks/usePriceBook';
import type { PriceBookItem, CategoryType, TradeType } from '../types';
import { TRADE_EMOJIS, CATEGORY_COLORS } from '../types';
import { toast } from 'sonner';

const TRADES = ['all','electrical','roofing','hvac','painting','plumbing','drain','general','other'] as const;
const CATEGORIES = ['all','material','labor','equipment','other'] as const;

type TradeFilter = typeof TRADES[number];
type CategoryFilter = typeof CATEGORIES[number];

const BLANK_ITEM: Partial<PriceBookItem> = {
  name: '', description: '', trade: 'general', category: 'material',
  default_unit_price: 0, unit: 'ea', default_markup: 15, tags: '',
};

export default function PriceBook() {
  const { items, loading, addItem, updateItem, deleteItem, globalCount, customCount } = usePriceBook();
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PriceBookItem>>(BLANK_ITEM);

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(search.toLowerCase());
      const matchTrade = tradeFilter === 'all' || item.trade === tradeFilter;
      const matchCat = categoryFilter === 'all' || item.category === categoryFilter;
      return matchSearch && matchTrade && matchCat;
    });
  }, [items, search, tradeFilter, categoryFilter]);

  const handleSave = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    if (editingId) {
      await updateItem(editingId, formData);
      setEditingId(null);
    } else {
      await addItem(formData);
      setShowForm(false);
    }
    setFormData(BLANK_ITEM);
  };

  const handleEdit = (item: PriceBookItem) => {
    setEditingId(item.id);
    setFormData({ ...item });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this price book item?')) return;
    await deleteItem(id);
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowForm(false);
    setFormData(BLANK_ITEM);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Price Book</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {globalCount} standard rates + {customCount} custom item{customCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          id="add-price-book-item"
          onClick={() => { setShowForm(true); setEditingId(null); setFormData(BLANK_ITEM); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-copper hover:bg-copper-600 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-copper-200/50"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-copper-50/60 border border-copper-100/50 rounded-2xl p-5 mb-5 animate-scale-in">
          <h3 className="text-sm font-bold text-copper-800 mb-4">New Price Book Item</h3>
          <ItemForm data={formData} onChange={setFormData} onSave={handleSave} onCancel={handleCancel} />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search price book..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-copper-500/20 focus:border-copper-400 transition-all shadow-sm"
          />
        </div>

        <select
          value={tradeFilter}
          onChange={e => setTradeFilter(e.target.value as TradeFilter)}
          className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-copper-500/20 shadow-sm"
        >
          <option value="all">All Trades</option>
          {TRADES.filter(t => t !== 'all').map(t => (
            <option key={t} value={t}>
              {TRADE_EMOJIS[t as TradeType]} {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                categoryFilter === c ? 'bg-copper text-white shadow-sm shadow-copper-200/40' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="col-span-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</div>
          <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trade</div>
          <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</div>
          <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</div>
          <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Price</div>
          <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Markup</div>
          <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-copper-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm">No items found</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(item => (
              editingId === item.id ? (
                <div key={item.id} className="px-5 py-4 bg-copper-50/20 border-y border-copper-100/30">
                  <ItemForm data={formData} onChange={setFormData} onSave={handleSave} onCancel={handleCancel} />
                </div>
              ) : (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-3 px-5 py-3.5 hover:bg-slate-50/60 items-center group transition-colors"
                >
                  <div className="col-span-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 truncate">{item.name}</span>
                      {item.is_global && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs font-medium">Global</span>
                      )}
                    </div>
                    {item.description && (
                      <div className="text-xs text-slate-400 truncate mt-0.5">{item.description}</div>
                    )}
                  </div>
                  <div className="col-span-2 text-sm text-slate-600 capitalize">
                    {item.trade ? `${TRADE_EMOJIS[item.trade as TradeType]} ${item.trade}` : '—'}
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold capitalize ${CATEGORY_COLORS[item.category]}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="col-span-1 text-sm text-slate-500">{item.unit}</div>
                  <div className="col-span-1 text-sm font-semibold text-slate-900 text-right">
                    ${item.default_unit_price.toFixed(2)}
                  </div>
                  <div className="col-span-1 text-sm text-slate-500 text-right">{item.default_markup}%</div>
                  <div className="col-span-1 flex items-center justify-end gap-1.5">
                    {!item.is_global && (
                      <>
                        <button
                          onClick={() => handleEdit(item)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-copper hover:bg-copper-50 rounded-lg transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemForm({
  data,
  onChange,
  onSave,
  onCancel,
}: {
  data: Partial<PriceBookItem>;
  onChange: (d: Partial<PriceBookItem>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const input = 'px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-copper-500/20 focus:border-copper-400 transition-all';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label>
          <input
            type="text"
            value={data.name || ''}
            onChange={e => onChange({ ...data, name: e.target.value })}
            placeholder="Item name"
            className={input}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Trade</label>
          <select
            value={data.trade || 'general'}
            onChange={e => onChange({ ...data, trade: e.target.value as TradeType })}
            className={input}
          >
            {['electrical','roofing','hvac','painting','plumbing','drain','general','other'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
          <select
            value={data.category || 'material'}
            onChange={e => onChange({ ...data, category: e.target.value as CategoryType })}
            className={input}
          >
            {['material','labor','equipment','other'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Unit Price</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
            <input
              type="number"
              value={data.default_unit_price || 0}
              onChange={e => onChange({ ...data, default_unit_price: parseFloat(e.target.value) || 0 })}
              className={`${input} pl-5`}
              min="0"
              step="0.01"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Unit</label>
          <select
            value={data.unit || 'ea'}
            onChange={e => onChange({ ...data, unit: e.target.value })}
            className={input}
          >
            {['ea','hr','ft','lf','sq','sqft','gal','lb','cy','day','visit','job'].map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Default Markup</label>
          <div className="relative">
            <input
              type="number"
              value={data.default_markup || 15}
              onChange={e => onChange({ ...data, default_markup: parseFloat(e.target.value) || 0 })}
              className={`${input} pr-6`}
              min="0"
              max="100"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-4 py-2 bg-copper text-white rounded-lg text-sm font-semibold hover:bg-copper-600 transition-all shadow-md shadow-copper-200/50"
        >
          <Check className="w-3.5 h-3.5" /> Save Item
        </button>
      </div>
    </div>
  );
}
