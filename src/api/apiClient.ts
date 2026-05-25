/**
 * apiClient.ts
 * ─────────────────────────────────────────────────────────────────
 * Secure internal API boundary layer.
 *
 * SECURITY RULE:
 *   All AI provider keys (OPENROUTER_API_KEY, GROQ_API_KEY) live ONLY
 *   in Supabase Edge Function environment variables — never in the
 *   browser bundle and never prefixed with VITE_.
 *
 *   Frontend clients always call this module, which forwards requests
 *   to the appropriate Supabase Edge Function over HTTPS with the
 *   authenticated session token. The Edge Function holds the secrets.
 * ─────────────────────────────────────────────────────────────────
 */

import { supabase } from './supabase';

// ─── Types ─────────────────────────────────────────────────────────

export interface AIScopeRequest {
  projectId: string;
  trade: string;
  /** Free-form description, voice transcript, or photo analysis prompt */
  prompt: string;
  imageBase64?: string;  // Optional compressed photo from mediaProcessor
}

export interface AIScopeResponse {
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    category: 'material' | 'labor' | 'equipment' | 'other';
    markup: number;
  }>;
  homeownerSummary: string;
  estimatedTotal: number;
  tokensUsed: number;
  costCents: number;
  durationMs: number;
}

export interface VersionLockRequest {
  projectId: string;
  versionNumber: number;
  itemsSnapshot: any[];
  totalsSnapshot: Record<string, number>;
  notesSnapshot?: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// ─── Internal helper ───────────────────────────────────────────────

async function invokeFunction<TReq, TRes>(
  functionName: string,
  body: TReq
): Promise<ApiResponse<TRes>> {
  const start = Date.now();
  try {
    const { data, error } = await supabase.functions.invoke<TRes>(functionName, {
      body: body as Record<string, unknown>,
    });

    if (error) {
      console.error(`[ApiClient] Edge Function "${functionName}" error:`, error.message);
      return { data: null, error: error.message };
    }

    console.info(`[ApiClient] ${functionName} completed in ${Date.now() - start}ms`);
    return { data: data ?? null, error: null };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[ApiClient] Unexpected error calling "${functionName}":`, msg);
    return { data: null, error: msg };
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Sends a scope generation request to the secure `ai-estimator` Edge Function.
 * The AI provider key is accessed ONLY inside the Edge Function's env.
 *
 * @example
 * const { data, error } = await apiClient.generateScope({ ... });
 */
export const apiClient = {

  /**
   * Generate AI line-item scope from a text prompt or voice transcript.
   * Routes to: supabase/functions/ai-estimator/index.ts
   */
  generateScope(req: AIScopeRequest): Promise<ApiResponse<AIScopeResponse>> {
    return invokeFunction<AIScopeRequest, AIScopeResponse>('ai-estimator', req);
  },

  /**
   * Lock a proposal version snapshot, making it immutable.
   * Routes to: supabase/functions/version-lock/index.ts
   */
  lockProposalVersion(req: VersionLockRequest): Promise<ApiResponse<{ versionId: string }>> {
    return invokeFunction<VersionLockRequest, { versionId: string }>('version-lock', req);
  },

  /**
   * Trigger a follow-up email campaign for a proposal.
   * Routes to: supabase/functions/email-followup/index.ts
   */
  scheduleFollowUp(req: {
    projectId: string;
    recipientEmail: string;
    recipientName: string;
    delayHours: number;
    template: 'reminder_24h' | 'reminder_72h' | 'final_notice';
  }): Promise<ApiResponse<{ jobId: string }>> {
    return invokeFunction('email-followup', req);
  },

  /**
   * Transcribe a voice note audio blob via the AI transcription Edge Function.
   * The audio blob must first be base64-encoded before calling this.
   */
  transcribeAudio(req: {
    projectId: string;
    audioBase64: string;
    mimeType: string;
    durationSeconds: number;
  }): Promise<ApiResponse<{ transcript: string; confidence: number }>> {
    return invokeFunction('ai-transcribe', req);
  },

  /**
   * Create a Stripe subscription/payment checkout session.
   * Routes to: supabase/functions/stripe-checkout/index.ts
   */
  createStripeSession(req: {
    plan: 'pro' | 'enterprise';
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<ApiResponse<{ sessionId: string; url: string }>> {
    return invokeFunction('stripe-checkout', req);
  },

} as const;
