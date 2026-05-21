import { useState } from 'react';
import { formatCurrency } from '../../lib/calculations';
import { calcFinancing, formatMonthly } from '../../lib/pricingEngine';
import type { TotalsResult } from '../../types';

interface Props {
  totals: TotalsResult;
  notes: string;
  onNotesChange: (notes: string) => void;
  onExportPDF: () => void;
  onCopyLink: () => void;
  exportingPDF: boolean;
  financingRate?: number;
  financingMonths?: number;
  financingMinAmount?: number;
}

export default function TotalsSidebar({
  totals,
  notes,
  onNotesChange,
  onExportPDF,
  onCopyLink,
  exportingPDF,
  financingRate = 9.99,
  financingMonths = 60,
  financingMinAmount = 1000,
}: Props) {
  const { subtotal, laborSub, matSub, eqSub, otherSub, marginAmount, taxAmount, total } = totals;
  const [financingTerm, setFinancingTerm] = useState<number>(financingMonths);

  // Compute monthly payment options
  const financing = calcFinancing({
    principal: total,
    annualInterestRate: financingRate,
    termMonths: financingTerm,
  });

  return (
    <div className="space-y-6 transition-all duration-200">
      {/* Totals Card */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-800/80 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 font-sora">Estimate Summary</h3>
        </div>

        <div className="p-5 space-y-3.5">
          {/* Breakdown by category */}
          {matSub > 0 && (
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-inter">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Materials
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(matSub)}</span>
            </div>
          )}
          {laborSub > 0 && (
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-inter">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse" />
                Labor
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(laborSub)}</span>
            </div>
          )}
          {eqSub > 0 && (
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-inter">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                Equipment
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(eqSub)}</span>
            </div>
          )}
          {otherSub > 0 && (
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-inter">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                Other
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(otherSub)}</span>
            </div>
          )}

          {(matSub > 0 || laborSub > 0 || eqSub > 0 || otherSub > 0) && (
            <div className="border-t border-slate-100 dark:border-navy-800 pt-3" />
          )}

          {/* Subtotal */}
          <div className="flex justify-between font-inter">
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Subtotal</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(subtotal)}</span>
          </div>

          {/* Overhead & Profit */}
          {marginAmount > 0 && (
            <div className="flex justify-between font-inter">
              <span className="text-sm text-slate-500 dark:text-slate-400">Overhead & Profit</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(marginAmount)}</span>
            </div>
          )}

          {/* Tax */}
          {taxAmount > 0 && (
            <div className="flex justify-between font-inter">
              <span className="text-sm text-slate-500 dark:text-slate-400">Tax</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(taxAmount)}</span>
            </div>
          )}

          {/* Total */}
          <div className="mt-2 pt-3 border-t-2 border-copper-100 dark:border-navy-800">
            <div className="bg-navy dark:bg-navy-950/80 rounded-xl px-4 py-3.5 flex justify-between items-center border border-navy-800 dark:border-navy-800/60 shadow-premium">
              <span className="text-xs font-bold text-white font-sora tracking-widest uppercase">TOTAL</span>
              <span className="text-xl font-bold text-white font-sora">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Interactive Financing CTA Card (For Estimates > Min Amount) */}
          {total >= financingMinAmount && (
            <div className="mt-3 p-4 bg-gradient-to-br from-amber-500/5 to-copper/5 dark:from-navy-950 dark:to-navy-900/60 rounded-xl border border-copper/15 dark:border-navy-800 flex flex-col gap-2.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-sora text-copper uppercase tracking-wider">
                  💳 Low-Rate Financing Option
                </span>
                <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  {financingRate}% APR
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-inter text-slate-500 dark:text-slate-400">Estimated payment:</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white font-sora">
                  {formatMonthly(financing.monthlyPayment)}
                </span>
              </div>

              {/* Term Selection Toggle */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-navy-850 pt-2.5 mt-1">
                <span className="text-[10px] text-slate-400 font-inter">Choose duration term:</span>
                <div className="flex gap-1 bg-slate-100 dark:bg-navy-950 p-0.5 rounded-lg border border-slate-200/50 dark:border-navy-800">
                  {[36, 60, 120, 180, 240].filter(t => t <= financingMonths).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFinancingTerm(t)}
                      className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                        financingTerm === t
                          ? 'bg-white dark:bg-navy-800 text-slate-800 dark:text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-655'
                      }`}
                    >
                      {t} mo
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 font-inter">
        <button
          id="export-pdf-btn"
          onClick={onExportPDF}
          disabled={exportingPDF}
          className="w-full flex items-center justify-center gap-2 py-3 bg-copper hover:bg-copper-hover text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-copper/10 disabled:opacity-60"
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
          className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700 rounded-xl text-sm font-bold transition-all shadow-sm"
        >
          🔗 Copy Client Link
        </button>
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-800/80 shadow-card p-5">
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 font-sora">Notes / Scope of Work</label>
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          rows={5}
          placeholder="Add project notes, scope details, or terms..."
          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-copper/40 focus:border-copper transition-all resize-none font-inter"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 font-inter">Auto-saved as you type</p>
      </div>
    </div>
  );
}
