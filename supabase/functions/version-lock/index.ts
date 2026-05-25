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
    const { projectId, versionNumber, itemsSnapshot, totalsSnapshot, notesSnapshot } = await req.json();

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

    // 3. Storing proposal snapshot for historic locking and absolute audit compliance
    const { data: versionData, error: versionError } = await supabase
      .from("proposal_versions")
      .insert({
        organization_id: orgId,
        project_id: projectId,
        version_number: versionNumber,
        items_snapshot: itemsSnapshot || [],
        totals_snapshot: totalsSnapshot || {},
        notes_snapshot: notesSnapshot || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (versionError) {
      throw new Error(`Failed to save version snapshot: ${versionError.message}`);
    }

    // 4. Log to audit_logs
    const ipAddress = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "unknown";
    const { error: auditError } = await supabase
      .from("audit_logs")
      .insert({
        organization_id: orgId,
        actor_id: user.id,
        action_type: "LOCK",
        entity_type: "project",
        entity_id: projectId,
        original_value: {},
        new_value: { version_number: versionNumber, version_id: versionData.id },
        ip_address: ipAddress,
        created_at: new Date().toISOString()
      });

    if (auditError) {
      console.warn("Failed to write audit log:", auditError.message);
    }

    const result = {
      versionId: versionData.id,
      status: "locked",
      timestamp: versionData.created_at,
      message: `Snapshot version ${versionNumber} is now permanently sealed.`,
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

