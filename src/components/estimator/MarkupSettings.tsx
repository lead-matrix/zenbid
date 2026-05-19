import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Project } from '../../types';

interface Props {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
}

export default function MarkupSettings({ project, onUpdate }: Props) {
  const [open, setOpen] = useState(false);

  const handleChange = (field: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      onUpdate({ [field]: num });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <button
        id="markup-settings-toggle"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-slate-700">Markup & Tax Settings</span>
          <span className="px-2 py-0.5 bg-copper-50 text-copper rounded text-xs font-semibold">
            L:{project.labor_markup}% · M:{project.material_markup}% · E:{project.equipment_markup}% · T:{project.tax_rate}%
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 grid grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          <MarkupField
            label="Labor Markup"
            value={project.labor_markup}
            field="labor_markup"
            color="blue"
            onChange={handleChange}
          />
          <MarkupField
            label="Material Markup"
            value={project.material_markup}
            field="material_markup"
            color="emerald"
            onChange={handleChange}
          />
          <MarkupField
            label="Equipment Markup"
            value={project.equipment_markup}
            field="equipment_markup"
            color="amber"
            onChange={handleChange}
          />
          <MarkupField
            label="Tax Rate"
            value={project.tax_rate}
            field="tax_rate"
            color="violet"
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  );
}

function MarkupField({
  label,
  value,
  field,
  color,
  onChange,
}: {
  label: string;
  value: number;
  field: string;
  color: 'blue' | 'emerald' | 'amber' | 'violet';
  onChange: (field: string, value: string) => void;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={e => onChange(field, e.target.value)}
          min="0"
          max="100"
          step="0.5"
          className={`w-full pr-7 pl-3 py-2.5 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-copper-200 transition-all ${colorMap[color]}`}
        />
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${color === 'blue' ? 'text-blue-600' : color === 'emerald' ? 'text-emerald-600' : color === 'amber' ? 'text-amber-600' : 'text-violet-600'}`}>%</span>
      </div>
    </div>
  );
}
