/**
 * Client-side PDF/print generator for PeakEstimator.
 * Zero server dependencies — uses browser native print dialog.
 */
import type { Project, ProjectItem, TotalsResult } from '../types';
import { formatCurrency } from './calculations';
import { TRADE_EMOJIS } from '../types';

export function generateAndPrint(
  project: Project,
  items: ProjectItem[],
  totals: TotalsResult
): void {
  const html = buildHTML(project, items, totals);
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  // Slight delay so styles render before print dialog
  setTimeout(() => {
    printWindow.print();
  }, 600);
}

function fmt(n: number): string {
  return formatCurrency(n);
}

function buildHTML(project: Project, items: ProjectItem[], totals: TotalsResult): string {
  const tradeEmoji = TRADE_EMOJIS[project.trade] ?? '📋';
  const today      = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const itemRows = items.map(it => `
    <tr>
      <td>${escHtml(it.description || 'Unnamed Item')}</td>
      <td class="cap">${escHtml(it.category)}</td>
      <td class="num">${it.quantity} ${escHtml(it.unit)}</td>
      <td class="num">${fmt(it.unit_price ?? 0)}</td>
      <td class="num">${fmt(it.total ?? 0)}</td>
    </tr>`).join('');

  const hasBreakdown = totals.matSub > 0 || totals.laborSub > 0 || totals.eqSub > 0 || totals.otherSub > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Estimate — ${escHtml(project.name)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: #1a202c;
    background: #fff;
    padding: 40px 48px;
    max-width: 860px;
    margin: 0 auto;
  }
  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #1C2B5C; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-name { font-size: 20px; font-weight: 900; color: #1C2B5C; letter-spacing: -0.5px; }
  .brand-name span { color: #C07840; }
  .brand-tagline { font-size: 9px; color: #888; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
  .proposal-meta { text-align: right; }
  .proposal-meta h1 { font-size: 22px; font-weight: 900; color: #1C2B5C; }
  .proposal-meta p { font-size: 11px; color: #666; margin-top: 2px; }
  /* ── Info grid ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
  .info-box { background: #f7f9fc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
  .info-box h4 { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #C07840; margin-bottom: 6px; }
  .info-box p { font-size: 12px; color: #374151; line-height: 1.6; }
  .info-box strong { color: #111827; }
  /* ── Items table ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #1C2B5C; color: white; }
  thead th { padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
  thead th.num { text-align: right; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 9px 12px; font-size: 12px; color: #374151; }
  tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody td.cap { text-transform: capitalize; color: #6b7280; }
  /* ── Totals ── */
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 28px; }
  .totals-box { width: 280px; background: #f7f9fc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 12px; color: #374151; }
  .totals-row:not(:last-child) { border-bottom: 1px solid #e2e8f0; }
  .totals-row.subtotal { font-weight: 600; }
  .totals-total { display: flex; justify-content: space-between; padding: 12px 16px; background: #1C2B5C; color: white; font-size: 15px; font-weight: 900; }
  /* ── Notes ── */
  .notes { background: #fffbf5; border: 1px solid #f0e4d0; border-radius: 10px; padding: 14px 16px; margin-bottom: 28px; }
  .notes h4 { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #C07840; margin-bottom: 6px; }
  .notes p { font-size: 12px; color: #374151; line-height: 1.7; white-space: pre-wrap; }
  /* ── Signature ── */
  .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
  .sig-box { border-top: 2px solid #1C2B5C; padding-top: 8px; }
  .sig-box p { font-size: 10px; color: #9ca3af; margin-top: 28px; }
  /* ── Footer ── */
  .footer { border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; }
  .footer p { font-size: 10px; color: #9ca3af; }
  .footer .watermark { font-size: 9px; color: #C07840; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; opacity: 0.6; }
  /* ── Copper accent bar ── */
  .copper-bar { height: 4px; background: linear-gradient(90deg, #C07840, #D2914C); border-radius: 2px; margin-bottom: 28px; }
  @media print {
    body { padding: 20px 24px; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="brand">
    <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="12" fill="#1C2B5C"/>
      <polygon points="32,8 6,56 58,56" fill="none" stroke="#C07840" stroke-width="2.5" stroke-linejoin="round"/>
      <polyline points="18,50 26,28 32,40 38,28 46,50" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="36" y1="16" x2="52" y2="30" stroke="#C07840" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="52" cy="30" r="3" fill="#C07840"/>
    </svg>
    <div>
      <div class="brand-name">Peak<span>Estimator</span></div>
      <div class="brand-tagline">Precision Bidding · Global Reach</div>
    </div>
  </div>
  <div class="proposal-meta">
    <h1>${tradeEmoji} ${escHtml(project.name)}</h1>
    <p>Proposal Date: ${today}</p>
    ${project.valid_until ? `<p>Valid Until: ${new Date(project.valid_until).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>` : ''}
  </div>
</div>

<div class="copper-bar"></div>

<div class="info-grid">
  <div class="info-box">
    <h4>Prepared For</h4>
    <p><strong>${escHtml(project.client_name || 'Client')}</strong></p>
    ${project.client_email ? `<p>${escHtml(project.client_email)}</p>` : ''}
    ${project.client_phone ? `<p>${escHtml(project.client_phone)}</p>` : ''}
    ${project.project_address ? `<p>${escHtml(project.project_address)}</p>` : ''}
  </div>
  <div class="info-box">
    <h4>Prepared By</h4>
    <p><strong>${escHtml(project.company_name || 'Your Company')}</strong></p>
    ${project.company_email ? `<p>${escHtml(project.company_email)}</p>` : ''}
    ${project.company_phone ? `<p>${escHtml(project.company_phone)}</p>` : ''}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th>Category</th>
      <th class="num">Qty / Unit</th>
      <th class="num">Unit Price</th>
      <th class="num">Total</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px;">No line items added.</td></tr>'}
  </tbody>
</table>

<div class="totals-wrap">
  <div class="totals-box">
    ${hasBreakdown ? `
      ${totals.matSub > 0   ? `<div class="totals-row"><span>Materials</span><span>${fmt(totals.matSub)}</span></div>` : ''}
      ${totals.laborSub > 0 ? `<div class="totals-row"><span>Labor</span><span>${fmt(totals.laborSub)}</span></div>` : ''}
      ${totals.eqSub > 0    ? `<div class="totals-row"><span>Equipment</span><span>${fmt(totals.eqSub)}</span></div>` : ''}
      ${totals.otherSub > 0 ? `<div class="totals-row"><span>Other</span><span>${fmt(totals.otherSub)}</span></div>` : ''}
    ` : ''}
    <div class="totals-row subtotal"><span>Subtotal</span><span>${fmt(totals.subtotal)}</span></div>
    ${totals.marginAmount > 0 ? `<div class="totals-row"><span>Overhead &amp; Profit</span><span>${fmt(totals.marginAmount)}</span></div>` : ''}
    ${totals.taxAmount > 0    ? `<div class="totals-row"><span>Tax</span><span>${fmt(totals.taxAmount)}</span></div>` : ''}
    <div class="totals-total"><span>TOTAL</span><span>${fmt(totals.total)}</span></div>
  </div>
</div>

${project.notes ? `
<div class="notes">
  <h4>Notes / Scope of Work</h4>
  <p>${escHtml(project.notes)}</p>
</div>` : ''}

<div class="sig-section">
  <div class="sig-box">
    <p>Client Signature &amp; Date</p>
  </div>
  <div class="sig-box">
    <p>Contractor Signature &amp; Date</p>
  </div>
</div>

<div class="footer">
  <p>Generated by PeakEstimator · lmtrx.us · ${today}</p>
  <span class="watermark">Precision Bidding · Global Reach</span>
</div>

</body>
</html>`;
}

function escHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
