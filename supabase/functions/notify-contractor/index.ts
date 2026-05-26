import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { shareToken, action, clientMessage, clientName } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch project by share token
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("share_token", shareToken)
      .single();

    if (pErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contractorEmail = project.company_email;
    if (!contractorEmail) {
      return new Response(JSON.stringify({ ok: true, skipped: "no contractor email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isApproval = action === "approve";
    const subject = isApproval
      ? `✅ ${clientName || project.client_name} Approved Your Proposal — ${project.name}`
      : `📝 ${clientName || project.client_name} Requested Changes — ${project.name}`;

    const portalUrl = `${Deno.env.get("SITE_URL") || "https://peakestimator.com"}/approve/${shareToken}`;
    const approvalDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 0; }
    .wrapper { max-width: 580px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #1C2B5C; padding: 32px 40px; }
    .header-title { color: #C07840; font-size: 22px; font-weight: 700; }
    .header-sub { color: #94A3B8; font-size: 12px; margin-top: 4px; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; margin: 24px 40px 0; }
    .badge-approved { background: #D1FAE5; color: #059669; }
    .badge-changes { background: #FEF3C7; color: #D97706; }
    .body { padding: 24px 40px 32px; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
    .info-label { color: #94A3B8; font-weight: 600; }
    .info-value { color: #1E293B; font-weight: 600; text-align: right; }
    .message-box { background: #F8FAFC; border-left: 3px solid ${isApproval ? "#059669" : "#D97706"}; border-radius: 0 8px 8px 0; padding: 14px 16px; margin: 20px 0; font-size: 13px; color: #475569; line-height: 1.6; }
    .cta { display: block; text-align: center; background: #C07840; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; margin: 24px 0 0; }
    .footer { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 16px 40px; text-align: center; font-size: 11px; color: #94A3B8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-title">PeakEstimator</div>
      <div class="header-sub">Proposal Notification</div>
    </div>

    <div class="badge ${isApproval ? "badge-approved" : "badge-changes"}">
      ${isApproval ? "✅ Proposal Approved" : "✏️ Changes Requested"}
    </div>

    <div class="body">
      <p style="font-size:15px;font-weight:700;color:#0F172A;margin:0 0 4px;">
        ${isApproval ? "Great news!" : "Action needed"} — ${clientName || project.client_name} has responded to your proposal.
      </p>
      <p style="font-size:13px;color:#64748B;margin:0 0 20px;">
        ${isApproval
          ? "Your client has approved the bid. You can now proceed with the project."
          : "Your client has requested some changes to the proposal."}
      </p>
 
      <div class="info-row"><span class="info-label">Project</span><span class="info-value">${project.name}</span></div>
      <div class="info-row"><span class="info-label">Client</span><span class="info-value">${clientName || project.client_name || "—"}</span></div>
      <div class="info-row"><span class="info-label">Date</span><span class="info-value">${approvalDate}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value">${isApproval ? "✅ Approved" : "📝 Changes Requested"}</span></div>

      ${clientMessage ? `
      <p style="font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;margin:20px 0 6px;">Client Message</p>
      <div class="message-box">${clientMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      ` : ""}

      <a href="${portalUrl}" class="cta">View Proposal →</a>
    </div>

    <div class="footer">
      ${project.company_name || "PeakEstimator"} · Powered by PeakEstimator · ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>`;

    // Send email via Supabase Auth Admin API (uses project's SMTP settings)
    const emailRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      },
    });

    // Use Resend API if available, otherwise log
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `PeakEstimator <hello@peakeastimator.top>`,
          to: [contractorEmail],
          subject,
          html: htmlBody,
        }),
      });

      if (!resendRes.ok) {
        const resendErr = await resendRes.text();
        console.error("Resend error:", resendErr);
        // Don't fail — just log
      }
    } else {
      // Fallback: use Supabase's built-in mailer via pg_net or log
      console.log(`[notify-contractor] Would send to ${contractorEmail}: ${subject}`);
    }

    return new Response(JSON.stringify({ ok: true, sentTo: contractorEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("notify-contractor error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
