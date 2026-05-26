/**
 * proposalAnalytics.ts
 * Records client engagement events on shared proposals.
 * Events: viewed, section_viewed, tier_hovered, time_spent, link_opened
 */
import { supabase } from '../api/supabase';

function getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function getSessionId(): string {
  let sid = sessionStorage.getItem('peak_session_id');
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('peak_session_id', sid);
  }
  return sid;
}

export async function trackEvent(
  projectId: string,
  shareToken: string,
  eventType: 'viewed' | 'section_viewed' | 'tier_hovered' | 'time_spent' | 'link_opened',
  metadata: Record<string, any> = {}
) {
  try {
    await supabase.from('proposal_analytics').insert({
      project_id: projectId,
      share_token: shareToken,
      event_type: eventType,
      metadata,
      session_id: getSessionId(),
      device_type: getDeviceType(),
    });
  } catch (_) {
    // Never block the user experience for analytics
  }
}

// Track total time spent when user leaves
export function initTimeTracking(projectId: string, shareToken: string) {
  const startTime = Date.now();
  const onLeave = () => {
    const seconds = Math.round((Date.now() - startTime) / 1000);
    if (seconds > 3) {
      trackEvent(projectId, shareToken, 'time_spent', { seconds });
    }
  };
  window.addEventListener('beforeunload', onLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onLeave();
  });
  return () => window.removeEventListener('beforeunload', onLeave);
}
