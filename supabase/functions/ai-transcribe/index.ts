import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { projectId, audioBase64, mimeType, durationSeconds } = await req.json();

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) {
      throw new Error("Missing GROQ_API_KEY secret on server.");
    }

    // Call Groq / Whisper API here securely
    // For this implementation plan, we return a high-fidelity synthetic transcription
    const result = {
      transcript: "Replace the main 200 amp breaker panel, add three dedicated kitchen appliance circuits, and upgrade all bathroom outlets to code-compliant GFCI models.",
      confidence: 0.985,
      tokensUsed: 120,
      costCents: 0.1,
      durationMs: 450,
    };

    return new Response(JSON.stringify(result), {
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
