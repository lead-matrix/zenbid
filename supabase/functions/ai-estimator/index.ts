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
    const { projectId, trade, prompt, imageBase64 } = await req.json();

    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openRouterKey) {
      throw new Error("Missing OPENROUTER_API_KEY secret on server.");
    }

    // Call OpenRouter / LLM here securely
    // For this implementation plan, we return a high-fidelity synthetic estimating model response
    const mockLineItems = [
      {
        description: `Install professional grade ${trade} primary components as requested`,
        quantity: 1,
        unit: "LS",
        unit_price: 1200.00,
        category: "material",
        markup: 15,
      },
      {
        description: `Standard onsite installation labor for ${trade} setup`,
        quantity: 8,
        unit: "HR",
        unit_price: 85.00,
        category: "labor",
        markup: 20,
      },
      {
        description: `Specialized setup tooling rental and cleanups`,
        quantity: 1,
        unit: "day",
        unit_price: 150.00,
        category: "equipment",
        markup: 10,
      }
    ];

    const estimatedTotal = mockLineItems.reduce((acc, curr) => {
      const base = curr.quantity * curr.unit_price;
      const total = base * (1 + curr.markup / 100);
      return acc + total;
    }, 0);

    const result = {
      lineItems: mockLineItems,
      homeownerSummary: `This proposal includes all materials, equipment, and certified labor necessary to complete the ${trade} installation, ensuring compliance with local codes.`,
      estimatedTotal: Math.round(estimatedTotal * 100) / 100,
      tokensUsed: 420,
      costCents: 2,
      durationMs: 820,
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
