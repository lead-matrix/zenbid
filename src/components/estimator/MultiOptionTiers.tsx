import { useState } from 'react';
import { CheckCircle, Star, Zap, Shield } from 'lucide-react';
import { formatCurrency, formatMonthly, calcFinancing, buildTierBreakdowns } from '../../lib/pricingEngine';
import type { ProjectItem } from '../../types';

interface Props {
  items: ProjectItem[];
  laborMarkup: number;
  materialMarkup: number;
  equipmentMarkup: number;
  taxRate: number;
  /** Annual interest rate for financing preview, e.g. 9.99 */
  financingRate?: number;
  /** Loan term in months for financing preview */
  financingMonths?: number;
  /** Minimum project amount required for financing */
  financingMinAmount?: number;
  /** Currently selected tier saved on the project (from DB) */
  selectedTier?: 'good' | 'better' | 'best' | null;
  onSelectTier: (tier: 'good' | 'better' | 'best') => void;
}

const TIER_META = {
  good: {
    label: 'Good',
    icon: Shield,
    gradient: 'from-slate-500 to-slate-700',
    ring: 'ring-slate-400',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    cta: 'bg-slate-700 hover:bg-slate-800',
    description: 'Essential coverage — gets the job done reliably.',
  },
  better: {
    label: 'Better',
    icon: Star,
    gradient: 'from-copper to-amber-700',
    ring: 'ring-copper',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    cta: 'bg-copper hover:bg-copper-hover',
    description: 'Most popular — enhanced quality & warranty coverage.',
    popular: true,
  },
  best: {
    label: 'Best',
    icon: Zap,
    gradient: 'from-violet-600 to-indigo-700',
    ring: 'ring-violet-500',
    badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    cta: 'bg-violet-600 hover:bg-violet-700',
    description: 'Premium materials, extended warranty & priority service.',
  },
} as const;

type Tier = keyof typeof TIER_META;

export default function MultiOptionTiers({
  items,
  laborMarkup,
  materialMarkup,
  equipmentMarkup,
  taxRate,
  financingRate = 9.99,
  financingMonths = 60,
  financingMinAmount = 1000,
  selectedTier,
  onSelectTier,
}: Props) {
  const [showFinancing, setShowFinancing] = useState(false);

  const rates = { laborMarkup, materialMarkup, equipmentMarkup, taxRate };
  const breakdowns = buildTierBreakdowns(items, rates);

  // Only show tiers that have at least one tier-specific item (or always show all 3)
  const hasTierItems = breakdowns.some(b => b.items.some(i => i.option_tier === b.tier));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white font-sora">
            Choose Your Package
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-inter">
            Select the option that best fits your needs and budget.
          </p>
        </div>
        <button
          onClick={() => setShowFinancing(f => !f)}
          className="text-xs font-semibold text-copper hover:text-copper-hover transition-colors flex items-center gap-1"
        >
          {showFinancing ? 'Show totals' : '💳 Monthly payments'}
        </button>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(TIER_META) as Tier[]).map(tier => {
          const meta = TIER_META[tier];
          const breakdown = breakdowns.find(b => b.tier === tier);
          const total = breakdown?.totals.total ?? 0;
          const monthly = calcFinancing({ principal: total, annualInterestRate: financingRate, termMonths: financingMonths });
          const Icon = meta.icon;
          const isSelected = selectedTier === tier;
          const isPopular = 'popular' in meta && meta.popular;

          return (
            <div
              key={tier}
              className={`relative rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                isSelected
                  ? `${meta.ring} ring-2 shadow-premium border-transparent`
                  : 'border-slate-200 dark:border-navy-800 shadow-card hover:shadow-md'
              }`}
            >
              {/* Popular badge */}
              {isPopular && (
                <div className="absolute top-0 left-0 right-0 bg-copper text-white text-[10px] font-bold text-center py-1 tracking-widest uppercase font-sora">
                  ⭐ Most Popular
                </div>
              )}

              {/* Card header gradient */}
              <div className={`bg-gradient-to-br ${meta.gradient} px-5 ${isPopular ? 'pt-8' : 'pt-5'} pb-5`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-bold text-white/80 uppercase tracking-widest font-sora">
                    {meta.label}
                  </span>
                </div>
                <div className="text-white">
                  {showFinancing && total >= financingMinAmount ? (
                    <div>
                      <span className="text-2xl font-bold font-sora">{formatMonthly(monthly.monthlyPayment)}</span>
                      <span className="text-xs text-white/60 ml-1">{financingMonths}mo @ {financingRate}% APR</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-2xl font-bold font-sora">{formatCurrency(total)}</span>
                      {showFinancing && total > 0 && total < financingMinAmount && (
                        <span className="text-[10px] text-white/60 block mt-0.5 font-medium">Under financing limit</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="bg-white dark:bg-navy-900 p-5 space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-inter">
                  {meta.description}
                </p>

                {/* Tier-specific items */}
                {breakdown && breakdown.items.filter(i => i.option_tier === tier).length > 0 && (
                  <ul className="space-y-1.5">
                    {breakdown.items
                      .filter(i => i.option_tier === tier)
                      .slice(0, 4)
                      .map(item => (
                        <li key={item.id} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span>{item.description}</span>
                        </li>
                      ))}
                  </ul>
                )}

                {/* CTA Button */}
                <button
                  id={`select-tier-${tier}`}
                  onClick={() => onSelectTier(tier)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all ${meta.cta} ${
                    isSelected ? 'opacity-80 cursor-default' : ''
                  }`}
                >
                  {isSelected ? '✓ Selected' : `Choose ${meta.label}`}
                </button>

                {showFinancing && total >= financingMinAmount && (
                  <p className="text-[10px] text-slate-400 text-center leading-tight">
                    Total repayment {formatCurrency(monthly.totalRepayment)}
                    {' '}({formatCurrency(monthly.totalInterest)} interest)
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Financing disclaimer */}
      {showFinancing && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
          Financing subject to credit approval. Rates shown are estimates only.
        </p>
      )}
    </div>
  );
}
