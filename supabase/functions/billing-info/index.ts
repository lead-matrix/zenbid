// supabase/functions/billing-info/index.ts
// Returns current wire billing details and plan info for the calling org
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get calling user
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userErr || !user) throw new Error('Unauthorized')

    // Get org_id from profile
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    if (pErr || !profile?.organization_id) throw new Error('Profile not found')

    const { data: sub, error: sErr } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .single()
    if (sErr) throw new Error('Subscription not found')

    // Wire transfer banking details (static — configure these to your actual bank)
    const wireDetails = {
      bank_name: "Chase Business Banking",
      account_name: "PeakEstimator LLC",
      routing_number: "021000021",
      account_number: "XXXX-XXXX-4892",
      swift_code: "CHASUS33",
      memo_prefix: "PEAK",
    }

    return new Response(
      JSON.stringify({
        subscription: sub,
        wire_details: wireDetails,
        plans: {
          pro: { name: 'Pro Plan', price_monthly: 49, features: ['Unlimited proposals', 'AI scope assistant', 'Good/Better/Best tiers', 'Digital signatures', 'Follow-up automation'] },
          enterprise: { name: 'Enterprise Plan', setup_fee: 499, price_monthly: 199, features: ['Everything in Pro', 'Multi-user teams', 'Custom branding', 'Priority support', 'API access'] }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
