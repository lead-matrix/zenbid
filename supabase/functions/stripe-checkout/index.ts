import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.4.0?target=deno";

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
    const { plan = "pro", successUrl, cancelUrl } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Authenticate user from request header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No Authorization header provided.");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Fetch profile & organization info
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      throw new Error("User does not belong to a valid organization.");
    }

    const orgId = profile.organization_id;

    // 3. Initialize Stripe
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set.");
    }
    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2022-11-15",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const finalSuccessUrl = successUrl || `${origin}/settings?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${origin}/settings`;

    let lineItems = [];
    let mode: "subscription" | "payment" = "subscription";

    if (plan === "enterprise") {
      // Enterprise pricing tier: $499 setup fee, then annual subscription or trial phase
      lineItems = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "PeakEstimator Enterprise Plan",
              description: "White-glove setup, trial phase, and dedicated annual platform license",
            },
            unit_amount: 49900, // $499.00 setup fee
          },
          quantity: 1,
        }
      ];
      mode = "payment"; // Payment mode for setup fee checkout, webhook upgrades to enterprise
    } else {
      // Pro pricing tier: $49.00 USD/month recurring
      lineItems = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "PeakEstimator Pro Plan",
              description: "Full access to PeakEstimator Pro features and unlimited estimating capabilities",
            },
            unit_amount: 4900, // $49.00
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        }
      ];
      mode = "subscription";
    }

    // 4. Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: mode,
      customer_email: user.email,
      metadata: {
        organizationId: orgId,
        plan: plan,
      },
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
    });

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
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
