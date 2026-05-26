# PeakEstimator — Production Setup Guide

## 1. Run Database Migrations

In your **Supabase SQL Editor** (`Dashboard → SQL Editor`), run each migration file in order:

```
supabase/migrations/001_initial.sql
supabase/migrations/20260518*.sql  (all in order)
supabase/migrations/20260521*.sql
supabase/migrations/20260522*.sql
supabase/migrations/20260523*.sql
supabase/migrations/20260526*.sql
supabase/migrations/20260526200000_production_fixes.sql   ← NEW
supabase/migrations/20260526210000_auth_hooks_and_security.sql  ← NEW
```

Or use the Supabase CLI:
```bash
supabase db push
```

---

## 2. Set Edge Function Secrets

In **Supabase Dashboard → Project Settings → Edge Functions → Secrets**, add:

| Secret Name | Value | Required For |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe checkout & webhook |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | stripe-webhook function |
| `STRIPE_PRO_PRICE_ID` | `price_...` | stripe-checkout |
| `STRIPE_ENTERPRISE_PRICE_ID` | `price_...` | stripe-checkout |
| `RESEND_API_KEY` | `re_...` | email-followup, notify-contractor |
| `FROM_EMAIL` | `noreply@peakestimator.com` | All email functions |
| `SITE_URL` | `https://peakestimator.com` | Email links, redirect URLs |
| `OPENAI_API_KEY` | `sk-...` | ai-estimator, ai-transcribe |
| `TRACK_LOGIN_HOOK_SECRET` | *(generate a random string)* | track-login auth hook |

**To generate a secure random secret:**
```bash
openssl rand -base64 32
```

---

## 3. Deploy Edge Functions

```bash
supabase functions deploy --no-verify-jwt track-login
supabase functions deploy admin-manager
supabase functions deploy admin-wire-approve
supabase functions deploy email-followup
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy generate-pdf
supabase functions deploy notify-contractor
supabase functions deploy ai-estimator
supabase functions deploy ai-transcribe
```

---

## 4. Set Up Auth Hook (last_login_at tracking)

In **Supabase Dashboard → Authentication → Hooks**:

1. Click **"Add hook"**
2. Event: **Login**
3. Hook type: **HTTP**
4. URL: `https://<your-project>.supabase.co/functions/v1/track-login`
5. Secret: paste the value of `TRACK_LOGIN_HOOK_SECRET`

This populates `last_login_at` on every sign-in, powering the Churn Risk Monitor in the Admin Portal.

---

## 5. Enable pg_cron (Proposal Expiry)

In **Supabase Dashboard → Database → Extensions**, enable **pg_cron**.

Then run in SQL Editor:
```sql
SELECT cron.schedule(
  'mark-expired-proposals',
  '0 * * * *',
  $$ SELECT public.mark_expired_proposals(); $$
);
```

This auto-marks proposals as expired every hour based on `valid_until`.

---

## 6. Set Up Stripe Webhook

In the **Stripe Dashboard → Developers → Webhooks**:
1. Add endpoint: `https://<your-project>.supabase.co/functions/v1/stripe-webhook`
2. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
3. Copy the **Signing secret** → paste into Supabase secrets as `STRIPE_WEBHOOK_SECRET`

---

## 7. Vercel Deployment

```bash
vercel --prod
```

Security headers (X-Frame-Options, CSP, HSTS etc.) are already configured in `vercel.json`.

