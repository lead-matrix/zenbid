// ─── PeakEstimator: track-login Edge Function ───────────────────
// Purpose: Supabase Auth Hook — updates last_login_at on every login
// Setup:   Dashboard → Authentication → Hooks → Login hook
//          URL: https://<project>.supabase.co/functions/v1/track-login
//          Secret: TRACK_LOGIN_HOOK_SECRET (set in Edge Function secrets)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Supabase sends Auth Hooks as POST with a shared secret in the header
  const hookSecret = Deno.env.get("TRACK_LOGIN_HOOK_SECRET");
  if (hookSecret) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${hookSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth Hook payload shape: { user: { id, email, ... }, event: "LOGIN" }
  const userId = payload?.user?.id || payload?.user_id;

  if (!userId) {
    return new Response(JSON.stringify({ message: "No user_id in payload" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase
    .from("profiles")
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("[track-login] Failed to update last_login_at:", error.message);
  } else {
    console.log(`[track-login] Updated last_login_at for user ${userId}`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
