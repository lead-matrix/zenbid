import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify caller is admin
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profErr || !profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Unauthorized. Admin access required." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, email, fullName, companyName, userId } = await req.json();

    if (action === 'invite') {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Generate invite link / send invite email
      const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
        data: {
          full_name: fullName || '',
          company_name: companyName || '',
        },
        redirectTo: `${Deno.env.get("SITE_URL") || "https://peakeastimator.top"}/dashboard`,
      });

      if (inviteErr) {
        throw inviteErr;
      }

      // Extract the action_link (magic invite URL) from the response if available
      // Supabase auth.admin.inviteUserByEmail sends the email automatically.
      // The action_link is returned so admin can also share it manually.
      const actionLink = (inviteData as any)?.properties?.action_link || null;

      return new Response(JSON.stringify({ 
        ok: true, 
        user: inviteData.user,
        action_link: actionLink
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'delete') {
      if (!userId) {
        return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteErr) {
        throw deleteErr;
      }

      return new Response(JSON.stringify({ ok: true, deletedId: userId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("admin-manager error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
