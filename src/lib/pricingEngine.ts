/**
 * pricingEngine.ts
 * ─────────────────────────────────────────────────────────────────
 * The SINGLE source of truth for all monetary calculations in
 * PeakEstimator. Every surface that shows a dollar value — the
 * Estimator workspace, the PDF exporter, the Client Portal, and the
 * Good / Better / Best comparison matrix — must derive numbers from
 * this module. Never duplicate math elsewhere.
 * ─────────────────────────────────────────────────────────────────
 */

import type { ProjectItem, TotalsResult } from '../types';

// ─── Item-level helpers ────────────────────────────────────────────

/** Base cost before any markup */
export function itemBaseCost(item: Pick<ProjectItem, 'quantity' | 'unit_price'>): number {
  return round2(item.quantity * item.unit_price);
}

/**
 * Item total after per-item markup is applied.
 * item.markup is expressed as a percentage (e.g. 20 = 20 %).
 */
export function itemTotal(item: Pick<ProjectItem, 'quantity' | 'unit_price' | 'markup'>): number {
  const base = itemBaseCost(item);
  return round2(base * (1 + (item.markup ?? 0) / 100));
}

// ─── Project-level calculations ────────────────────────────────────

export interface MarkupRates {
  laborMarkup: number;      // %
  materialMarkup: number;   // %
  equipmentMarkup: number;  // %
  taxRate: number;          // %
  defaultMarkup?: number;   // % – fallback for "other" category items
}

/**
 * Full project totals — backward-compatible with the original
 * `calcTotals` signature so existing call-sites keep working.
 */
export function calcTotals(
  items: ProjectItem[],
  laborMarkup: number,
  materialMarkup: number,
  equipmentMarkup: number,
  taxRate: number
): TotalsResult {
  const baseItems = items.filter(i => !i.option_tier || i.option_tier === 'base');
  return calcTierTotals(baseItems, { laborMarkup, materialMarkup, equipmentMarkup, taxRate });
}

/**
 * Calculates totals for an arbitrary subset of items (used for
 * Good / Better / Best tier comparisons).
 */
export function calcTierTotals(items: ProjectItem[], rates: MarkupRates): TotalsResult {
  const laborSub = sumCategory(items, 'labor');
  const matSub   = sumCategory(items, 'material');
  const eqSub    = sumCategory(items, 'equipment');
  const subtotal = round2(laborSub + matSub + eqSub + sumCategory(items, 'other'));
  const otherSub = round2(subtotal - laborSub - matSub - eqSub);

  const defaultMark = rates.defaultMarkup ?? 15;

  const marginAmount = round2(
    (laborSub * rates.laborMarkup      / 100) +
    (matSub   * rates.materialMarkup   / 100) +
    (eqSub    * rates.equipmentMarkup  / 100) +
    (otherSub * defaultMark            / 100)
  );

  const taxAmount = round2((subtotal + marginAmount) * (rates.taxRate / 100));
  const total     = round2(subtotal + marginAmount + taxAmount);

  return { subtotal, laborSub, matSub, eqSub, otherSub, marginAmount, taxAmount, total };
}

// ─── Multi-option tier helpers ─────────────────────────────────────

export type OptionTier = 'good' | 'better' | 'best';

export interface TierBreakdown {
  tier: OptionTier;
  /** Items that belong to this tier (base + tier-specific) */
  items: ProjectItem[];
  totals: TotalsResult;
}

/**
 * Builds a full Good / Better / Best breakdown from a mixed item list.
 * "base" items are included in every tier; tier-specific items are
 * additive on top of base.
 */
export function buildTierBreakdowns(
  allItems: ProjectItem[],
  rates: MarkupRates
): TierBreakdown[] {
  const tiers: OptionTier[] = ['good', 'better', 'best'];
  const baseItems = allItems.filter(i => !i.option_tier || i.option_tier === 'base');

  return tiers.map(tier => {
    const tierItems = allItems.filter(i => i.option_tier === tier);
    const combined  = [...baseItems, ...tierItems];
    return { tier, items: combined, totals: calcTierTotals(combined, rates) };
  });
}

// ─── Upsell helpers ────────────────────────────────────────────────

/**
 * Calculates the incremental total for a set of selected upsell items.
 */
export function calcUpsellTotal(
  upsellItems: ProjectItem[],
  rates: MarkupRates
): number {
  const t = calcTierTotals(upsellItems, rates);
  return t.total;
}

// ─── Financing helpers ─────────────────────────────────────────────

export interface FinancingParams {
  principal: number;         // Total amount financed (dollars)
  annualInterestRate: number; // e.g. 9.99 for 9.99 %
  termMonths: number;         // e.g. 60 for 5-year plan
}

export interface FinancingResult {
  monthlyPayment: number;
  totalRepayment: number;
  totalInterest: number;
  apr: number; // same as annualInterestRate for simple amortisation
}

/**
 * Standard amortised loan monthly payment calculation.
 * Returns 0 / 0 when interest rate is 0 (simple division).
 */
export function calcFinancing(params: FinancingParams): FinancingResult {
  const { principal, annualInterestRate, termMonths } = params;

  if (principal <= 0 || termMonths <= 0) {
    return { monthlyPayment: 0, totalRepayment: 0, totalInterest: 0, apr: annualInterestRate };
  }

  if (annualInterestRate === 0) {
    const monthlyPayment = round2(principal / termMonths);
    return { monthlyPayment, totalRepayment: principal, totalInterest: 0, apr: 0 };
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const monthlyPayment = round2(
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  );

  const totalRepayment = round2(monthlyPayment * termMonths);
  const totalInterest  = round2(totalRepayment - principal);

  return { monthlyPayment, totalRepayment, totalInterest, apr: annualInterestRate };
}

// ─── Formatting ────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value}%`;
}

export function formatMonthly(value: number): string {
  return `${formatCurrency(value)}/mo`;
}

// ─── Internal ──────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumCategory(items: ProjectItem[], category: ProjectItem['category']): number {
  return round2(
    items
      .filter(i => i.category === category)
      .reduce((s, i) => s + itemBaseCost(i), 0)
  );
}
