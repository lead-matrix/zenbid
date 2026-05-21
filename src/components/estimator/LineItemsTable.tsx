import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { ProjectItem, CategoryType } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import { formatCurrency } from '../../lib/calculations';

interface Props {
  items: ProjectItem[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<ProjectItem>) => void;
  onDelete: (id: string) => void;
  onReorder: (items: ProjectItem[]) => void;
  onOpenPriceBook: () => void;
  onOpenTemplates: () => void;
}

const CATEGORIES: CategoryType[] = ['material', 'labor', 'equipment', 'other'];
const UNITS = ['ea', 'hr', 'ft', 'lf', 'sq', 'sqft', 'gal', 'lb', 'cy', 'day', 'visit', 'job'];

export default function LineItemsTable({ items, onAdd, onUpdate, onDelete, onReorder, onOpenPriceBook, onOpenTemplates }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  }, [items, onReorder]);

  return (
    <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-800/80 shadow-card overflow-hidden transition-all duration-200">
      {/* Table header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-900/50">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 font-sora">Line Items</h2>
        <div className="flex items-center gap-2">
          <button
            id="open-templates"
            onClick={onOpenTemplates}
            className="px-3 py-1.5 bg-copper/10 dark:bg-copper/20 hover:bg-copper/25 text-copper dark:text-copper border border-copper/35 rounded-lg text-xs font-bold transition-all shadow-sm font-inter"
          >
            ⚡ Assemblies
          </button>
          <button
            id="open-price-book"
            onClick={onOpenPriceBook}
            className="px-3 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-navy-750 transition-all shadow-sm font-inter"
          >
            📚 Price Book
          </button>
          <button
            id="add-line-item"
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-copper hover:bg-copper-hover text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-copper/10 font-inter"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>
      </div>

      {/* Horizontal scrolling table wrapper */}
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[850px] divide-y divide-slate-100 dark:divide-navy-800/80">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-slate-50/50 dark:bg-navy-900/30">
            <div className="col-span-1" />
            <div className="col-span-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Description</div>
            <div className="col-span-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Category</div>
            <div className="col-span-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Qty</div>
            <div className="col-span-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Unit</div>
            <div className="col-span-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Unit Price</div>
            <div className="col-span-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right pr-6">Total</div>
          </div>

          {items.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-navy-900">
              <p className="text-slate-400 dark:text-slate-500 text-sm font-inter">No line items yet.</p>
              <p className="text-slate-300 dark:text-slate-600 text-xs mt-1 font-inter">Click "Add Item" or browse the Price Book</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="divide-y divide-slate-50 dark:divide-navy-800/50">
                  {items.map(item => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/30">
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 text-xs text-copper font-bold hover:text-copper-hover transition-colors font-sora"
          >
            <Plus className="w-3.5 h-3.5" />
            Add another item
          </button>
        </div>
      )}
    </div>
  );
}

function SortableRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: ProjectItem;
  onUpdate: (id: string, updates: Partial<ProjectItem>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const lineTotal = (item.quantity || 0) * (item.unit_price || 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 gap-2 px-5 py-2.5 items-center hover:bg-slate-50/60 dark:hover:bg-navy-800/40 group transition-colors"
    >
      {/* Drag handle */}
      <div
        className="col-span-1 flex items-center cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-slate-300 dark:text-navy-700 group-hover:text-slate-400 dark:group-hover:text-navy-500 transition-colors" />
      </div>

      {/* Description */}
      <div className="col-span-4">
        <input
          type="text"
          value={item.description}
          onChange={e => onUpdate(item.id, { description: e.target.value })}
          placeholder="Item description..."
          className="w-full px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-navy-700 focus:border-copper dark:focus:border-copper focus:bg-white dark:focus:bg-navy-950 focus:ring-1 focus:ring-copper/40 rounded-lg transition-all font-inter"
        />
      </div>

      {/* Category */}
      <div className="col-span-2">
        <select
          value={item.category}
          onChange={e => onUpdate(item.id, { category: e.target.value as CategoryType })}
          className={`w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-transparent focus:border-copper dark:focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all cursor-pointer font-sora ${CATEGORY_COLORS[item.category]}`}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c} className="bg-white dark:bg-navy-950 text-slate-800 dark:text-slate-200 font-normal">
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Qty */}
      <div className="col-span-1">
        <input
          type="number"
          value={item.quantity}
          onChange={e => onUpdate(item.id, { quantity: parseFloat(e.target.value) || 0 })}
          min="0"
          step="0.01"
          className="w-full px-2 py-1.5 text-sm text-center text-slate-800 dark:text-slate-100 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-navy-700 focus:border-copper dark:focus:border-copper focus:bg-white dark:focus:bg-navy-950 focus:ring-1 focus:ring-copper/40 rounded-lg transition-all font-inter"
        />
      </div>

      {/* Unit */}
      <div className="col-span-1">
        <select
          value={item.unit}
          onChange={e => onUpdate(item.id, { unit: e.target.value })}
          className="w-full px-1 py-1.5 text-xs text-slate-600 dark:text-slate-300 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-navy-700 focus:border-copper dark:focus:border-copper focus:bg-white dark:focus:bg-navy-950 focus:ring-1 focus:ring-copper/40 rounded-lg transition-all cursor-pointer font-inter"
        >
          {UNITS.map(u => (
            <option key={u} value={u} className="bg-white dark:bg-navy-950 text-slate-800 dark:text-slate-200 font-normal">{u}</option>
          ))}
        </select>
      </div>

      {/* Unit Price */}
      <div className="col-span-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-inter">$</span>
          <input
            type="number"
            value={item.unit_price}
            onChange={e => onUpdate(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
            className="w-full pl-5 pr-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-navy-700 focus:border-copper dark:focus:border-copper focus:bg-white dark:focus:bg-navy-950 focus:ring-1 focus:ring-copper/40 rounded-lg transition-all font-inter"
          />
        </div>
      </div>

      {/* Total */}
      <div className="col-span-1 flex items-center justify-end gap-1.5">
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 text-right font-sora pr-2">{formatCurrency(lineTotal)}</span>
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 dark:text-navy-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
