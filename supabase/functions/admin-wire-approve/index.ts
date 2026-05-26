// supabase/functions/admin-wire-approve/index.ts
// Admin-only endpoint to verify a wire payment and activate a subscription
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Authenticate the calling admin
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userErr || !user) throw new Error('Unauthorized')

    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!adminProfile || !['super_admin', 'admin'].includes(adminProfile.role)) {
      throw new Error('Admin access required')
    }

    const { organization_id, plan = 'pro', expires_at = null, notify_email } = await req.json()

    if (!organization_id) throw new Error('organization_id is required')

    // Activate subscription via stored procedure
    const { error: rpcErr } = await supabase.rpc('approve_wire_payment', {
      org_id: organization_id,
      new_plan: plan,
      expires_at,
    })
    if (rpcErr) throw rpcErr

    // Send activation email if requested
    if (notify_email && RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'billing@peakestimator.com',
          to: notify_email,
          subject: '🎉 Your PeakEstimator Pro account is active!',
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; background: #0F172A; color: #F1F5F9; padding: 40px; border-radius: 16px;">
              <h1 style="color: #B27150; margin-bottom: 8px;">Welcome to PeakEstimator Pro</h1>
              <p style="color: #94A3B8; margin-bottom: 24px;">Your wire transfer has been verified and your account has been upgraded.</p>
              <div style="background: #1E293B; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 18px; font-weight: 700;">Plan: <span style="color: #B27150;">${plan.toUpperCase()}</span></p>
                ${expires_at ? `<p style="margin: 8px 0 0; color: #94A3B8; font-size: 14px;">Active until: ${new Date(expires_at).toLocaleDateString()}</p>` : ''}
              </div>
              <a href="https://peakestimator.com/dashboard" style="display: inline-block; background: #B27150; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700;">
                Open Dashboard →
              </a>
              <p style="color: #475569; font-size: 12px; margin-top: 32px;">Questions? Reply to this email or contact billing@peakestimator.com</p>
            </div>
          `,
        }),
      })
    }

    return new Response(
      JSON.stringify({ success: true, message: `Subscription upgraded to ${plan}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
