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
}

const CATEGORIES: CategoryType[] = ['material', 'labor', 'equipment', 'other'];
const UNITS = ['ea', 'hr', 'ft', 'lf', 'sq', 'sqft', 'gal', 'lb', 'cy', 'day', 'visit', 'job'];

export default function LineItemsTable({ items, onAdd, onUpdate, onDelete, onReorder, onOpenPriceBook }: Props) {
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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      {/* Table header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">Line Items</h2>
        <div className="flex items-center gap-2">
          <button
            id="open-price-book"
            onClick={onOpenPriceBook}
            className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm"
          >
            📚 Price Book
          </button>
          <button
            id="add-line-item"
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-copper text-white rounded-lg text-xs font-semibold hover:bg-copper-600 transition-all shadow-sm shadow-copper-100"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-12 gap-2 px-5 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="col-span-1" />
        <div className="col-span-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</div>
        <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</div>
        <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</div>
        <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</div>
        <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit Price</div>
        <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Total</div>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-slate-400 text-sm">No line items yet.</p>
          <p className="text-slate-300 text-xs mt-1">Click "Add Item" or browse the Price Book</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-slate-50">
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

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 text-xs text-copper font-semibold hover:text-copper-600 transition-colors"
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
      className="grid grid-cols-12 gap-2 px-5 py-2.5 items-center hover:bg-slate-50/60 group transition-colors"
    >
      {/* Drag handle */}
      <div
        className="col-span-1 flex items-center cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
      </div>

      {/* Description */}
      <div className="col-span-4">
        <input
          type="text"
          value={item.description}
          onChange={e => onUpdate(item.id, { description: e.target.value })}
          placeholder="Item description..."
          className="w-full px-2 py-1.5 text-sm text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-copper-300 focus:bg-white rounded-lg transition-all focus:ring-1 focus:ring-copper-200"
        />
      </div>

      {/* Category */}
      <div className="col-span-2">
        <select
          value={item.category}
          onChange={e => onUpdate(item.id, { category: e.target.value as CategoryType })}
          className={`w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-transparent focus:border-copper-300 focus:ring-1 focus:ring-copper-200 transition-all cursor-pointer ${CATEGORY_COLORS[item.category]}`}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c} className="bg-white text-slate-800 font-normal">
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
          className="w-full px-2 py-1.5 text-sm text-center text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-copper-300 focus:bg-white rounded-lg transition-all focus:ring-1 focus:ring-copper-200"
        />
      </div>

      {/* Unit */}
      <div className="col-span-1">
        <select
          value={item.unit}
          onChange={e => onUpdate(item.id, { unit: e.target.value })}
          className="w-full px-1 py-1.5 text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-copper-300 focus:bg-white rounded-lg transition-all cursor-pointer"
        >
          {UNITS.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {/* Unit Price */}
      <div className="col-span-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input
            type="number"
            value={item.unit_price}
            onChange={e => onUpdate(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
            className="w-full pl-5 pr-2 py-1.5 text-sm text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-copper-300 focus:bg-white rounded-lg transition-all focus:ring-1 focus:ring-copper-200"
          />
        </div>
      </div>

      {/* Total */}
      <div className="col-span-1 flex items-center justify-end gap-1.5">
        <span className="text-sm font-semibold text-slate-900 text-right">{formatCurrency(lineTotal)}</span>
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
