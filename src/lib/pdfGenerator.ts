/**
 * pdfGenerator.ts
 * ─────────────────────────────────────────────────────────────────
 * Fully branded PDF/print proposal generator.
 * Every proposal shows the CONTRACTOR'S branding — their logo,
 * company name, colors, and contact info. PeakEstimator branding
 * is hidden from clients by default (only a subtle footer mark).
 * ─────────────────────────────────────────────────────────────────
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
  const printWindow = window.open('', '_blank', 'width=940,height=760');
  if (!printWindow) {
    alert('Please allow pop-ups to export the PDF.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 700);
}

// ─── Helpers ──────────────────────────────────────────────────────

function fmt(n: number): string {
  return formatCurrency(n ?? 0);
}

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtDate(iso: string | null | undefined, fallback = ''): string {
  if (!iso) return fallback;
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return fallback; }
}

// ─── Main HTML builder ─────────────────────────────────────────────

function buildHTML(project: Project, items: ProjectItem[], totals: TotalsResult): string {
  const today = fmtDate(new Date().toISOString());

  // ── Contractor brand ──────────────────────────────────────────
  const companyName   = esc(project.company_name  || 'Your Company');
  const companyEmail  = esc(project.company_email || '');
  const companyPhone  = esc(project.company_phone || '');
  const companyLogo   = project.company_logo || '';   // URL — safe to use in <img src>
  const tradeEmoji    = TRADE_EMOJIS[project.trade] ?? '📋';

  // ── Client info ────────────────────────────────────────────────
  const clientName    = esc(project.client_name    || 'Client');
  const clientEmail   = esc(project.client_email   || '');
  const clientPhone   = esc(project.client_phone   || '');
  const projectAddr   = esc(project.project_address || '');

  // ── Proposal meta ──────────────────────────────────────────────
  const proposalTitle = esc(project.name || 'Proposal');
  const validUntil    = project.valid_until ? fmtDate(project.valid_until) : '';
  const startDate     = project.start_date  ? fmtDate(project.start_date)  : '';
  const signedDate    = project.client_approved_at ? fmtDate(project.client_approved_at) : '';

  // ── Line items ─────────────────────────────────────────────────
  // Only base / non-tiered items by default; if a tier was selected include it
  const activeTier = project.selected_option_tier;
  const visibleItems = project.is_multi_option && activeTier
    ? items.filter(i => !i.option_tier || i.option_tier === 'base' || i.option_tier === activeTier)
    : items.filter(i => !i.option_tier || i.option_tier === 'base');

  const itemRows = visibleItems.map((it, idx) => `
    <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="td-desc">${esc(it.description || 'Item')}</td>
      <td class="td-cat"><span class="badge badge-${esc(it.category)}">${esc(it.category)}</span></td>
      <td class="td-num">${it.quantity ?? 1} ${esc(it.unit || 'ea')}</td>
      <td class="td-num">${fmt(it.unit_price ?? 0)}</td>
      <td class="td-num td-bold">${fmt((it.quantity ?? 1) * (it.unit_price ?? 0))}</td>
    </tr>`).join('');

  // ── Signature image ────────────────────────────────────────────
  const sigImg = project.signature_data
    ? `<img src="${project.signature_data}" alt="Client signature" style="max-height:56px;max-width:220px;display:block;margin-bottom:4px;" />`
    : '<div style="height:44px;border-bottom:1.5px solid #94a3b8;width:220px;margin-bottom:4px;"></div>';

  // ── Logo block ─────────────────────────────────────────────────
  const logoBlock = companyLogo
    ? `<img src="${companyLogo}" alt="${companyName} logo" style="max-height:64px;max-width:180px;object-fit:contain;display:block;" />`
    : `<div class="logo-text">${companyName}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${proposalTitle} — ${companyName}</title>
<style>
/* ── Reset & Base ───────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 12.5px;
  line-height: 1.55;
  color: #1e293b;
  background: #fff;
  padding: 36px 48px 40px;
  max-width: 880px;
  margin: 0 auto;
}

/* ── Header ─────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 22px;
  margin-bottom: 0;
  border-bottom: 3.5px solid #1e293b;
}
.logo-text {
  font-size: 22px;
  font-weight: 900;
  color: #1e293b;
  letter-spacing: -0.5px;
}
.company-sub {
  font-size: 10px;
  color: #64748b;
  margin-top: 3px;
  letter-spacing: 0.3px;
}
.proposal-label {
  text-align: right;
}
.proposal-label .badge-proposal {
  display: inline-block;
  background: #1e293b;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  padding: 3px 10px;
  border-radius: 4px;
  margin-bottom: 6px;
}
.proposal-label h1 {
  font-size: 18px;
  font-weight: 900;
  color: #1e293b;
  line-height: 1.2;
}
.proposal-label .meta-line {
  font-size: 10.5px;
  color: #64748b;
  margin-top: 3px;
}

/* ── Copper accent bar ──────────────────────── */
.accent-bar {
  height: 3.5px;
  background: linear-gradient(90deg, #b36830, #d4954a, #b36830);
  margin: 0 0 24px 0;
}

/* ── Info grid ──────────────────────────────── */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 26px;
}
.info-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
}
.info-box h4 {
  font-size: 8.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #b36830;
  margin-bottom: 7px;
}
.info-box p {
  font-size: 12px;
  color: #374151;
  line-height: 1.55;
}
.info-box .name { font-size: 13.5px; font-weight: 700; color: #111827; }

/* ── Items table ────────────────────────────── */
table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
thead tr { background: #1e293b; }
thead th {
  padding: 10px 12px;
  text-align: left;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #f1f5f9;
}
thead th.th-num { text-align: right; }
.row-even { background: #fff; }
.row-odd  { background: #f8fafc; }
tbody tr { border-bottom: 1px solid #f1f5f9; }
tbody td { padding: 9px 12px; }
.td-desc { font-size: 12px; color: #374151; max-width: 280px; }
.td-num  { text-align: right; font-size: 12px; color: #374151; font-variant-numeric: tabular-nums; white-space: nowrap; }
.td-bold { font-weight: 700; color: #1e293b; }
.badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  text-transform: capitalize;
  padding: 2px 7px;
  border-radius: 100px;
  letter-spacing: 0.3px;
}
.badge-labor    { background: #dbeafe; color: #1d4ed8; }
.badge-material { background: #fef3c7; color: #92400e; }
.badge-equipment{ background: #ede9fe; color: #5b21b6; }
.badge-other    { background: #f1f5f9; color: #475569; }

/* ── Totals ─────────────────────────────────── */
.totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 26px; }
.totals-box {
  width: 290px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}
.totals-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 12px;
  color: #374151;
  border-bottom: 1px solid #f1f5f9;
}
.totals-row.sub { font-weight: 600; color: #1e293b; }
.totals-total {
  display: flex;
  justify-content: space-between;
  padding: 13px 16px;
  background: #1e293b;
  color: #fff;
  font-size: 15px;
  font-weight: 900;
}
.totals-copper { color: #e09855; }

/* ── Notes ──────────────────────────────────── */
.notes-box {
  background: #fffbf5;
  border: 1px solid #f0e4cf;
  border-left: 4px solid #b36830;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 26px;
}
.notes-box h4 { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #b36830; margin-bottom: 6px; }
.notes-box p  { font-size: 12px; color: #374151; white-space: pre-wrap; line-height: 1.65; }

/* ── Terms ──────────────────────────────────── */
.terms-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 26px;
}
.terms-box h4 { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 5px; }
.terms-box p  { font-size: 10.5px; color: #64748b; line-height: 1.6; }

/* ── Approval status ────────────────────────── */
.approved-banner {
  background: #ecfdf5;
  border: 1.5px solid #6ee7b7;
  border-radius: 10px;
  padding: 10px 16px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.approved-banner .check { font-size: 18px; }
.approved-banner strong { font-size: 13px; color: #065f46; }
.approved-banner span   { font-size: 11px; color: #047857; display: block; }

/* ── Signature section ──────────────────────── */
.sig-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 30px;
  page-break-inside: avoid;
}
.sig-box h5 { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 10px; }
.sig-line { border-bottom: 1.5px solid #1e293b; width: 220px; height: 56px; margin-bottom: 4px; }
.sig-name { font-size: 11px; color: #374151; font-weight: 600; }
.sig-date { font-size: 10px; color: #94a3b8; margin-top: 2px; }

/* ── Footer ─────────────────────────────────── */
.footer {
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.footer-left  { font-size: 10px; color: #94a3b8; line-height: 1.5; }
.footer-right { font-size: 9px; color: #cbd5e1; font-style: italic; }
.footer-company { font-weight: 700; color: #64748b; }

/* ── Print ──────────────────────────────────── */
@page { margin: 0.6in 0.5in; }
@media print {
  body { padding: 0; }
}
</style>
</head>
<body>

<!-- ═══════════════ HEADER ════════════════════ -->
<div class="header">
  <div>
    ${logoBlock}
    <div class="company-sub">
      ${companyEmail ? `${companyEmail}` : ''}${companyEmail && companyPhone ? ' &nbsp;·&nbsp; ' : ''}${companyPhone ? `${companyPhone}` : ''}
    </div>
  </div>
  <div class="proposal-label">
    <div class="badge-proposal">Proposal</div>
    <h1>${tradeEmoji} ${proposalTitle}</h1>
    <div class="meta-line">Date: ${today}</div>
    ${validUntil  ? `<div class="meta-line">Valid Until: <strong>${validUntil}</strong></div>` : ''}
    ${startDate   ? `<div class="meta-line">Project Start: ${startDate}</div>` : ''}
  </div>
</div>
<div class="accent-bar"></div>

<!-- ═══════════════ APPROVED BANNER (if signed) ════════════ -->
${project.client_approved_at ? `
<div class="approved-banner">
  <span class="check">✅</span>
  <div>
    <strong>Proposal Approved</strong>
    <span>Signed by ${clientName} on ${signedDate}</span>
  </div>
</div>` : ''}

<!-- ═══════════════ INFO GRID ════════════════ -->
<div class="info-grid">
  <div class="info-box">
    <h4>Prepared For</h4>
    <p class="name">${clientName}</p>
    ${clientEmail   ? `<p>${clientEmail}</p>` : ''}
    ${clientPhone   ? `<p>${clientPhone}</p>` : ''}
    ${projectAddr   ? `<p style="margin-top:4px;color:#64748b;">${projectAddr}</p>` : ''}
  </div>
  <div class="info-box">
    <h4>Prepared By</h4>
    <p class="name">${companyName}</p>
    ${companyEmail  ? `<p>${companyEmail}</p>` : ''}
    ${companyPhone  ? `<p>${companyPhone}</p>` : ''}
  </div>
</div>

<!-- ═══════════════ LINE ITEMS ════════════════ -->
<table>
  <thead>
    <tr>
      <th>Description</th>
      <th>Category</th>
      <th class="th-num">Qty / Unit</th>
      <th class="th-num">Unit Price</th>
      <th class="th-num">Total</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;font-style:italic;">No line items added.</td></tr>'}
  </tbody>
</table>

<!-- ═══════════════ TOTALS ════════════════════ -->
<div class="totals-wrap">
  <div class="totals-box">
    ${totals.matSub   > 0 ? `<div class="totals-row"><span>Materials</span><span>${fmt(totals.matSub)}</span></div>` : ''}
    ${totals.laborSub > 0 ? `<div class="totals-row"><span>Labor</span><span>${fmt(totals.laborSub)}</span></div>` : ''}
    ${totals.eqSub    > 0 ? `<div class="totals-row"><span>Equipment</span><span>${fmt(totals.eqSub)}</span></div>` : ''}
    ${totals.otherSub > 0 ? `<div class="totals-row"><span>Other</span><span>${fmt(totals.otherSub)}</span></div>` : ''}
    <div class="totals-row sub"><span>Subtotal</span><span>${fmt(totals.subtotal)}</span></div>
    ${totals.marginAmount > 0 ? `<div class="totals-row"><span>Overhead &amp; Profit</span><span>${fmt(totals.marginAmount)}</span></div>` : ''}
    ${totals.taxAmount    > 0 ? `<div class="totals-row"><span>Tax</span><span>${fmt(totals.taxAmount)}</span></div>` : ''}
    <div class="totals-total">
      <span>TOTAL DUE</span>
      <span class="totals-copper">${fmt(totals.total)}</span>
    </div>
  </div>
</div>

<!-- ═══════════════ NOTES ════════════════════ -->
${project.notes ? `
<div class="notes-box">
  <h4>Notes &amp; Scope of Work</h4>
  <p>${esc(project.notes)}</p>
</div>` : ''}

<!-- ═══════════════ TERMS ════════════════════ -->
<div class="terms-box">
  <h4>Terms &amp; Conditions</h4>
  <p>This proposal is valid for the period stated above. By signing, the client authorizes the work described herein at the stated price. All work will be performed in a professional manner per standard industry practices. ${companyName} is not responsible for pre-existing conditions not visible at time of estimate. A deposit may be required before work begins.</p>
</div>

<!-- ═══════════════ SIGNATURES ═══════════════ -->
<div class="sig-section">
  <div class="sig-box">
    <h5>Client Acceptance</h5>
    ${sigImg}
    <div class="sig-name">${clientName}</div>
    <div class="sig-date">Date: ${signedDate || '_________________________'}</div>
  </div>
  <div class="sig-box">
    <h5>Authorized By</h5>
    <div class="sig-line"></div>
    <div class="sig-name">${companyName}</div>
    <div class="sig-date">Date: _________________________</div>
  </div>
</div>

<!-- ═══════════════ FOOTER ════════════════════ -->
<div class="footer">
  <div class="footer-left">
    <span class="footer-company">${companyName}</span><br/>
    ${companyEmail ? `${companyEmail}` : ''}${companyEmail && companyPhone ? ' &nbsp;·&nbsp; ' : ''}${companyPhone}
  </div>
  <div class="footer-right">Powered by PeakEstimator</div>
</div>

</body>
</html>`;
}
