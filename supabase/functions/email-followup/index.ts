import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { projectId, recipientEmail, template, ruleId, subject } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch project details
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projError || !project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    // 2. Safeguard check: If the proposal has already been approved or won, abort campaign!
    if (project.status === "approved" || project.status === "won" || project.status === "lost") {
      console.log(`[email-followup] Skipping email for project ${projectId} since status is already: ${project.status}`);
      return new Response(JSON.stringify({ ok: true, skipped: `Status is ${project.status}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const siteUrl = Deno.env.get("SITE_URL") || "https://peakestimator.com";
    const portalUrl = `${siteUrl}/approve/${project.share_token}`;

    const clientName = project.client_name || "Valued Client";
    const companyName = project.company_name || "PeakEstimator Contractor";
    const logoHtml = project.company_logo
      ? `<img src="${project.company_logo}" alt="${companyName} Logo" style="max-height: 50px; margin-bottom: 20px; display: block;" />`
      : "";

    // 3. Construct premium template HTML body
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 0; }
    .email-container { max-width: 580px; margin: 30px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #E2E8F0; }
    .header-bar { background-color: #1F2937; padding: 24px 30px; text-align: left; }
    .content-box { padding: 30px 40px; color: #334155; }
    .greeting { font-size: 16px; font-weight: bold; color: #0F172A; margin: 0 0 16px 0; }
    .body-text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }
    .action-btn { display: inline-block; background-color: #C07840; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; }
    .footer-bar { padding: 20px 40px; background-color: #F1F5F9; font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header-bar">
      <span style="color: #FFFFFF; font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">${companyName}</span>
    </div>
    <div class="content-box">
      ${logoHtml}
      <h2 class="greeting">Hello ${clientName},</h2>
      <p class="body-text">
        We hope you are doing well! We wanted to check in on the proposal we prepared for the project <strong>${project.name}</strong>.
      </p>
      <p class="body-text">
        You can review the full details, choose options, and approve it securely online.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" class="action-btn">Review &amp; Approve Proposal →</a>
      </div>
      <p class="body-text">
        If you have any questions or require modifications, please request changes directly through the link above, or reply to this email.
      </p>
      <p class="body-text" style="margin-top: 30px; font-weight: 500;">
        Best regards,<br/>
        <strong>${companyName}</strong>
      </p>
    </div>
    <div class="footer-bar">
      This is a secure proposal message powered by PeakEstimator.
    </div>
  </div>
</body>
</html>`;

    let providerMessageId = "";
    let deliveryStatus = "sent";
    let errorMessage = null;

    if (resendKey) {
      // Send email via Resend
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${companyName} <hello@peakeastimator.top>`,
          to: [recipientEmail],
          subject: subject || `Reminder: Your Proposal for ${project.name}`,
          html: htmlContent,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        providerMessageId = data.id || "";
        deliveryStatus = "delivered";
      } else {
        const errText = await response.text();
        console.error("[email-followup] Resend API error:", errText);
        deliveryStatus = "failed";
        errorMessage = errText;
      }
    } else {
      console.log(`[email-followup] Mock send follow-up to ${recipientEmail} for project ${projectId}`);
    }

    // 4. Log to email_logs table
    await supabase
      .from("email_logs")
      .insert({
        user_id: project.user_id,
        recipient_email: recipientEmail,
        template_type: template || "follow-up",
        subject: subject || `Reminder: Review proposal for ${project.name}`,
        delivery_status: deliveryStatus,
        provider: resendKey ? "resend" : "mock-fallback",
        provider_message_id: providerMessageId,
        error_message: errorMessage,
        html_preview: htmlContent.substring(0, 500),
        created_at: new Date().toISOString()
      });

    return new Response(JSON.stringify({
      ok: true,
      status: deliveryStatus,
      messageId: providerMessageId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
