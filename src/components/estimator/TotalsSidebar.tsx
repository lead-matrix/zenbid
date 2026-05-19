import { formatCurrency } from '../../lib/calculations';
import type { TotalsResult } from '../../types';

interface Props {
  totals: TotalsResult;
  notes: string;
  onNotesChange: (notes: string) => void;
  onExportPDF: () => void;
  onCopyLink: () => void;
  exportingPDF: boolean;
}

export default function TotalsSidebar({
  totals,
  notes,
  onNotesChange,
  onExportPDF,
  onCopyLink,
  exportingPDF,
}: Props) {
  const { subtotal, laborSub, matSub, eqSub, otherSub, marginAmount, taxAmount, total } = totals;

  return (
    <div className="space-y-4">
      {/* Totals Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-700">Estimate Summary</h3>
        </div>

        <div className="p-5 space-y-3">
          {/* Breakdown by category */}
          {matSub > 0 && (
            <div className="flex justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Materials
              </span>
              <span className="font-medium text-slate-700">{formatCurrency(matSub)}</span>
            </div>
          )}
          {laborSub > 0 && (
            <div className="flex justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                Labor
              </span>
              <span className="font-medium text-slate-700">{formatCurrency(laborSub)}</span>
            </div>
          )}
          {eqSub > 0 && (
            <div className="flex justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Equipment
              </span>
              <span className="font-medium text-slate-700">{formatCurrency(eqSub)}</span>
            </div>
          )}
          {otherSub > 0 && (
            <div className="flex justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                Other
              </span>
              <span className="font-medium text-slate-700">{formatCurrency(otherSub)}</span>
            </div>
          )}

          {(matSub > 0 || laborSub > 0 || eqSub > 0 || otherSub > 0) && (
            <div className="border-t border-slate-100 pt-3" />
          )}

          {/* Subtotal */}
          <div className="flex justify-between">
            <span className="text-sm text-slate-600 font-medium">Subtotal</span>
            <span className="text-sm font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
          </div>

          {/* Overhead & Profit */}
          {marginAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Overhead & Profit</span>
              <span className="text-sm font-medium text-slate-700">{formatCurrency(marginAmount)}</span>
            </div>
          )}

          {/* Tax */}
          {taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Tax</span>
              <span className="text-sm font-medium text-slate-700">{formatCurrency(taxAmount)}</span>
            </div>
          )}

          {/* Total */}
          <div className="mt-2 pt-3 border-t-2 border-copper-100">
            <div className="bg-navy rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm font-bold text-white">TOTAL</span>
              <span className="text-lg font-bold text-white">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          id="export-pdf-btn"
          onClick={onExportPDF}
          disabled={exportingPDF}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-copper hover:bg-copper-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-copper-200 disabled:opacity-60"
        >
          {exportingPDF ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating PDF...
            </span>
          ) : (
            '📄 Download PDF'
          )}
        </button>

        <button
          id="copy-client-link-btn"
          onClick={onCopyLink}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          🔗 Copy Client Link
        </button>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <label className="block text-xs font-semibold text-slate-600 mb-2">Notes / Scope of Work</label>
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          rows={5}
          placeholder="Add project notes, scope details, or terms..."
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-copper-200 focus:border-copper-400 transition-all resize-none"
        />
        <p className="text-xs text-slate-400 mt-1.5">Auto-saved as you type</p>
      </div>
    </div>
  );
}
