import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.4.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecret) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not set" }), { status: 500 });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2022-11-15",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature");

  let event: any;

  try {
    const rawBody = await req.text();
    if (webhookSecret && signature) {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } else {
      // Direct parsing fallback for non-signed events in dev/testing environments
      event = JSON.parse(rawBody);
    }
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const eventType = event.type;
  console.log(`[stripe-webhook] Received Stripe event: ${eventType}`);

  try {
    if (eventType === "checkout.session.completed") {
      const session = event.data.object;
      const orgId = session.metadata?.organizationId;
      const plan = session.metadata?.plan || "pro";

      if (orgId) {
        // Upgrade organization billing tier
        const billingTier = plan === "enterprise" ? "enterprise" : "pro";
        
        // 1. Update organization billing tier
        const { error: orgErr } = await supabase
          .from("organizations")
          .update({
            billing_tier: billingTier,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orgId);

        if (orgErr) throw orgErr;

        // 2. Set default monthly limit in ai_usage_limits based on tier
        const monthlyLimit = billingTier === "enterprise" ? 50000 : 5000; // $500.00 vs $50.00 limits
        const { error: limitErr } = await supabase
          .from("ai_usage_limits")
          .upsert({
            organization_id: orgId,
            monthly_limit_cents: monthlyLimit,
            updated_at: new Date().toISOString(),
          }, { onConflict: "organization_id" });

        if (limitErr) throw limitErr;

        // 3. Update subscription tracker record
        const stripeSubId = session.subscription || null;
        const currentPeriodEnd = stripeSubId 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // estimate 30 days
          : null;

        const { error: subErr } = await supabase
          .from("subscriptions")
          .upsert({
            organization_id: orgId,
            stripe_subscription_id: stripeSubId,
            status: "active",
            price_id: session.line_items?.[0]?.price?.id || null,
            current_period_end: currentPeriodEnd,
          }, { onConflict: "organization_id" });

        if (subErr) throw subErr;

        console.info(`[stripe-webhook] Successfully activated tier "${billingTier}" for org "${orgId}"`);
      }
    } 
    else if (
      eventType === "customer.subscription.created" || 
      eventType === "customer.subscription.updated"
    ) {
      const subscription = event.data.object;
      const orgId = subscription.metadata?.organizationId;

      if (orgId) {
        const stripeStatus = subscription.status;
        let localStatus: "active" | "past_due" | "canceled" = "active";
        let tier: "pro" | "free" = "pro";

        if (stripeStatus === "active") {
          localStatus = "active";
          tier = "pro";
        } else if (stripeStatus === "past_due") {
          localStatus = "past_due";
          tier = "free"; // degrade on past due
        } else if (["unpaid", "canceled", "incomplete_expired"].includes(stripeStatus)) {
          localStatus = "canceled";
          tier = "free";
        }

        // Update organization billing tier
        const { error: orgErr } = await supabase
          .from("organizations")
          .update({
            billing_tier: tier,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orgId);

        if (orgErr) throw orgErr;

        // Update subscription record
        const { error: subErr } = await supabase
          .from("subscriptions")
          .upsert({
            organization_id: orgId,
            stripe_subscription_id: subscription.id,
            status: localStatus,
            price_id: subscription.items.data[0]?.price.id,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          }, { onConflict: "organization_id" });

        if (subErr) throw subErr;

        console.info(`[stripe-webhook] Updated subscription status to "${localStatus}" for org "${orgId}"`);
      }
    } 
    else if (eventType === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const orgId = subscription.metadata?.organizationId;

      if (orgId) {
        // Degrade organization to free
        const { error: orgErr } = await supabase
          .from("organizations")
          .update({
            billing_tier: "free",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orgId);

        if (orgErr) throw orgErr;

        // Update subscription tracker record
        const { error: subErr } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            current_period_end: new Date(subscription.ended_at * 1000).toISOString(),
          })
          .eq("organization_id", orgId);

        if (subErr) throw subErr;

        console.info(`[stripe-webhook] Subscription deleted. Degraded org "${orgId}" to free tier.`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error(`[stripe-webhook] Error processing webhook action: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
