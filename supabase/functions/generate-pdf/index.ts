import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatCurrency(value: number): string {
  return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function calcTotals(items: any[], lMarkup: number, mMarkup: number, eMarkup: number, taxRate: number) {
  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0);
  const laborSub = items.filter((i: any) => i.category === "labor").reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
  const matSub = items.filter((i: any) => i.category === "material").reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
  const eqSub = items.filter((i: any) => i.category === "equipment").reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
  const otherSub = subtotal - laborSub - matSub - eqSub;
  const margin = (laborSub * lMarkup / 100) + (matSub * mMarkup / 100) + (eqSub * eMarkup / 100) + (otherSub * 0.15);
  const tax = (subtotal + margin) * (taxRate / 100);
  return { subtotal, laborSub, matSub, eqSub, margin, tax, total: subtotal + margin + tax };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { projectId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: project, error: pErr } = await supabase
      .from("projects").select("*").eq("id", projectId).single();
    if (pErr || !project) throw new Error("Project not found");

    const { data: items } = await supabase
      .from("project_items").select("*").eq("project_id", projectId).order("sort_order");

    const allItems = items || [];
    const totals = calcTotals(allItems, project.labor_markup, project.material_markup, project.equipment_markup, project.tax_rate);

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const validUntil = project.valid_until
      ? new Date(project.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "—";

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>PeakEstimator Proposal - ${project.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #0F172A; background: white; }
  .header { background: #0F172A; padding: 32px 48px; display: flex; justify-content: space-between; align-items: center; }
  .company-name { color: white; font-size: 22px; font-weight: 700; }
  .company-contact { color: #94A3B8; font-size: 10px; margin-top: 4px; }
  .proposal-label { color: #C07840; font-size: 26px; font-weight: 700; text-align: right; }
  .proposal-date { color: #94A3B8; font-size: 10px; text-align: right; margin-top: 4px; }
  .info-band { background: #F1F5F9; padding: 24px 48px; display: flex; justify-content: space-between; }
  .info-label { font-size: 9px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .info-name { font-size: 18px; font-weight: 700; color: #0F172A; }
  .info-sub { font-size: 11px; color: #64748B; margin-top: 2px; }
  .content { padding: 32px 48px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #1E293B; }
  thead th { color: #CBD5E1; font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 10px 12px; text-align: left; }
  tbody tr:nth-child(even) { background: #F8FAFC; }
  tbody td { padding: 9px 12px; font-size: 11px; border-bottom: 1px solid #F1F5F9; }
  .cat-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; }
  .cat-material { background: #D1FAE5; color: #059669; }
  .cat-labor { background: #DBEAFE; color: #2563EB; }
  .cat-equipment { background: #FEF3C7; color: #D97706; }
  .cat-other { background: #F3F4F6; color: #6B7280; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals-box { width: 280px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 12px; }
  .total-row.gray { background: #F1F5F9; border-radius: 6px; margin-bottom: 4px; }
  .total-row.final { background: #1C2B5C; border-radius: 10px; margin-top: 8px; }
  .total-row.final span { color: white; font-weight: 700; font-size: 15px; }
  .notes-section { background: #F8FAFC; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
  .notes-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 10px; }
  .notes-text { font-size: 11px; color: #475569; line-height: 1.6; white-space: pre-wrap; }
  .sig-block { display: flex; gap: 40px; padding: 28px 0 24px; border-top: 2px solid #E2E8F0; margin-top: 24px; }
  .sig-col { flex: 1; }
  .sig-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #94A3B8; letter-spacing: 0.05em; margin-bottom: 6px; }
  .sig-line { height: 52px; border-bottom: 2px solid #CBD5E1; margin-bottom: 8px; }
  .sig-sub { font-size: 10px; color: #94A3B8; }
  .sig-hint { font-size: 9px; color: #CBD5E1; margin-top: 3px; }
  .footer { background: #0F172A; padding: 16px 48px; text-align: center; color: #64748B; font-size: 10px; margin-top: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } page { margin: 0; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company-name">${project.company_name || "Your Company"}</div>
    <div class="company-contact">${project.company_email || ""}${project.company_phone ? " · " + project.company_phone : ""}</div>
  </div>
  <div>
    <div class="proposal-label">PROPOSAL</div>
    <div class="proposal-date">Date: ${dateStr}</div>
    <div class="proposal-date">Valid Until: ${validUntil}</div>
  </div>
</div>

<div class="info-band">
  <div>
    <div class="info-label">Prepared For</div>
    <div class="info-name">${project.client_name || "—"}</div>
    <div class="info-sub">${project.client_email || ""}</div>
    <div class="info-sub">${project.client_phone || ""}</div>
  </div>
  <div>
    <div class="info-label">Project</div>
    <div class="info-name">${project.name}</div>
    <div class="info-sub">${project.project_address || ""}</div>
    <div class="info-sub">${project.start_date ? "Start: " + new Date(project.start_date).toLocaleDateString("en-US") : ""}</div>
  </div>
</div>

<div class="content">
  <table>
    <thead>
      <tr>
        <th style="width:40%">Description</th>
        <th>Category</th>
        <th style="text-align:center">Qty</th>
        <th>Unit</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${allItems.map((item: any) => `
      <tr>
        <td>${item.description || "—"}</td>
        <td><span class="cat-badge cat-${item.category}">${item.category}</span></td>
        <td style="text-align:center">${item.quantity}</td>
        <td>${item.unit}</td>
        <td style="text-align:right">$${item.unit_price.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">${formatCurrency(item.quantity * item.unit_price)}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="total-row gray"><span>Subtotal</span><span style="font-weight:600">${formatCurrency(totals.subtotal)}</span></div>
      ${totals.margin > 0 ? `<div class="total-row gray"><span>Overhead &amp; Profit</span><span>${formatCurrency(totals.margin)}</span></div>` : ""}
      ${totals.tax > 0 ? `<div class="total-row gray"><span>Tax</span><span>${formatCurrency(totals.tax)}</span></div>` : ""}
      <div class="total-row final"><span>TOTAL</span><span>${formatCurrency(totals.total)}</span></div>
    </div>
  </div>

  ${project.notes ? `
  <div class="notes-section">
    <div class="notes-title">Notes &amp; Scope of Work</div>
    <div class="notes-text">${project.notes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  </div>` : ""}

  <div class="sig-block">
    <div class="sig-col">
      <div class="sig-label">Client Signature</div>
      ${project.signature_data 
        ? `<div style="height: 52px; margin-bottom: 8px;"><img src="${project.signature_data}" style="max-height: 52px; max-width: 100%;" /></div>`
        : `<div class="sig-line"></div>`
      }
      <div class="sig-sub">${project.client_approved_at ? "Signed electronically on " + new Date(project.client_approved_at).toLocaleDateString("en-US") : "Signature &amp; Date"}</div>
      <div class="sig-hint">${project.client_approved_at ? "IP Logged" : "Sign above"}</div>
    </div>
    <div class="sig-col">
      <div class="sig-label">Authorized By</div>
      <div class="sig-line"></div>
      <div class="sig-sub">${project.company_name || "Company Representative"}</div>
      <div class="sig-hint">Company Representative</div>
    </div>
  </div>
</div>

<div class="footer">${project.company_name || "PeakEstimator"} · Generated by PeakEstimator · ${new Date().getFullYear()}</div>
<script>
  window.onload = () => {
    // Short delay to ensure styles are loaded before print dialog
    setTimeout(() => { window.print(); }, 500);
  };
</script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="PeakEstimator_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.html"`,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
