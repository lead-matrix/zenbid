import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * ai-transcribe — PeakEstimator
 *
 * Voice transcription is now handled entirely in the browser via the
 * Web Speech API (SpeechRecognition). This edge function serves as a
 * lightweight relay for text-based transcript parsing & audit logging.
 *
 * Payload: { projectId, transcript, trade? }
 * Returns: { transcript, confidence, tokensUsed, costCents, durationMs }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Accept a pre-transcribed string from the browser's Web Speech API
    const { projectId, transcript: rawTranscript, trade } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header provided.");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = profile?.organization_id;

    // 3. Normalise transcript — clean up Web Speech artifacts
    const transcript = (rawTranscript ?? "")
      .trim()
      .replace(/\s+/g, " ");

    const confidence = transcript.length > 0 ? 0.97 : 0;

    // 4. Log the transcription action (zero cost — Web Speech API is free)
    if (orgId) {
      await supabase.from("ai_usage_logs").insert({
        organization_id: orgId,
        user_id: user.id,
        provider: "web-speech-api",
        prompt_tokens: 0,
        completion_tokens: 0,
        cost: 0,
        action: "ai-transcribe",
        created_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({
      transcript: transcript || "",
      confidence,
      tokensUsed: 0,
      costCents: 0,
      durationMs: 0,
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
