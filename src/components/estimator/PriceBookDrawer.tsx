import { useState, useMemo } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { usePriceBook } from '../../hooks/usePriceBook';
import type { PriceBookItem, CategoryType, TradeType } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectTrade: TradeType;
  onAddItem: (item: Partial<import('../../types').ProjectItem>) => void;
}

const CATEGORIES: { value: CategoryType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'material', label: 'Material' },
  { value: 'labor', label: 'Labor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

export default function PriceBookDrawer({ isOpen, onClose, projectTrade, onAddItem }: Props) {
  const { items, addItem } = usePriceBook();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryType | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PriceBookItem>>({
    name: '', category: 'material', default_unit_price: 0, unit: 'ea', trade: projectTrade, default_markup: 15,
  });

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchSearch && matchCategory;
    }).sort((a, b) => {
      // Show current trade first
      if (a.trade === projectTrade && b.trade !== projectTrade) return -1;
      if (b.trade === projectTrade && a.trade !== projectTrade) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, search, categoryFilter, projectTrade]);

  const handleUseItem = (item: PriceBookItem) => {
    onAddItem({
      description: item.name,
      quantity: 1,
      unit: item.unit,
      unit_price: item.default_unit_price,
      category: item.category,
      markup: item.default_markup,
      from_price_book: true,
    });
    toast.success(`Added: ${item.name}`);
  };

  const handleAddCustom = async () => {
    if (!newItem.name) { toast.error('Name required'); return; }
    await addItem(newItem);
    setNewItem({ name: '', category: 'material', default_unit_price: 0, unit: 'ea', trade: projectTrade, default_markup: 15 });
    setShowAddForm(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Price Book</h3>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} items available</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-1.5 bg-copper-50 text-copper rounded-lg hover:bg-copper-100 transition-colors"
              title="Add custom item"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Add custom item form */}
        {showAddForm && (
          <div className="px-5 py-4 border-b border-slate-100 bg-copper-50/50 space-y-3">
            <p className="text-xs font-semibold text-copper-700">Add Custom Item</p>
            <input
              type="text"
              placeholder="Item name"
              value={newItem.name}
              onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-copper-200 focus:border-copper-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newItem.default_unit_price}
                  onChange={e => setNewItem(p => ({ ...p, default_unit_price: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-5 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-copper-200"
                />
              </div>
              <select
                value={newItem.unit}
                onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
                className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-copper-200"
              >
                {['ea','hr','ft','lf','sq','sqft','gal','lb','cy','day','visit','job'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newItem.category}
                onChange={e => setNewItem(p => ({ ...p, category: e.target.value as CategoryType }))}
                className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-copper-200"
              >
                {['material','labor','equipment','other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={handleAddCustom}
                className="py-2 bg-copper text-white rounded-lg text-xs font-semibold hover:bg-copper-600 transition-colors"
              >
                Save Item
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-copper-200"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-5 py-2 border-b border-slate-100 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === cat.value
                  ? 'bg-copper text-white shadow-sm shadow-copper-100'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No items found</div>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                onClick={() => handleUseItem(item)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-copper-50/50 group transition-all text-left"
              >
                <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${getCategoryDot(item.category)}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 truncate">{item.name}</span>
                    {item.is_global && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">Global</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 capitalize">{item.category} · {item.unit}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-bold text-slate-900">${item.default_unit_price.toFixed(2)}</div>
                  <div className="text-xs text-slate-400">/{item.unit}</div>
                </div>
                <div className="text-copper-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-4 h-4" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function getCategoryDot(cat: CategoryType): string {
  const map: Record<CategoryType, string> = {
    material: 'bg-emerald-400',
    labor: 'bg-blue-400',
    equipment: 'bg-amber-400',
    other: 'bg-slate-400',
  };
  return map[cat];
}
