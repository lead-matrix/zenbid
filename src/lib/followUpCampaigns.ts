import { eventBus } from './eventBus';
import { jobQueue } from './jobQueue';
import { offlineDB, OfflineJob } from './indexedDB';
import { supabase } from '../api/supabase';

// Define structures for follow-up rules and triggers
export interface FollowUpRule {
  id: string;
  name: string;
  triggerEvent: 'viewed' | 'abandoned' | 'expired' | 'created';
  delayHours: number;
  templateType: string;
  subject: string;
  isActive: boolean;
}

// Default Out-of-the-Box Rules for Contractors
export const DEFAULT_FOLLOW_UP_RULES: FollowUpRule[] = [
  {
    id: 'viewed-quick-reminder',
    name: 'Quick Re-engagement (After View)',
    triggerEvent: 'viewed',
    delayHours: 2,
    templateType: 'follow-up',
    subject: 'Any questions about your PeakEstimator proposal?',
    isActive: true,
  },
  {
    id: 'abandoned-winback',
    name: 'Abandoned Proposal Re-engagement',
    triggerEvent: 'abandoned',
    delayHours: 24,
    templateType: 'follow-up',
    subject: 'We would love to earn your business — Let\'s connect',
    isActive: true,
  },
  {
    id: 'created-follow-up-1',
    name: 'Proposal Follow-up (1 Day)',
    triggerEvent: 'created',
    delayHours: 24,
    templateType: 'follow-up',
    subject: 'Reminder: Review your PeakEstimator proposal',
    isActive: true,
  },
  {
    id: 'created-follow-up-3',
    name: 'Proposal Follow-up (3 Days)',
    triggerEvent: 'created',
    delayHours: 72,
    templateType: 'follow-up',
    subject: 'Your estimate is waiting — secured contract pricing',
    isActive: true,
  },
  {
    id: 'expired-reopen',
    name: 'Expired Estimate Re-open Campaign',
    triggerEvent: 'expired',
    delayHours: 1,
    templateType: 'follow-up',
    subject: 'Your estimate has expired — re-activate pricing today',
    isActive: true,
  }
];

class FollowUpCampaignManager {
  private rules: FollowUpRule[] = [...DEFAULT_FOLLOW_UP_RULES];

  constructor() {
    this.loadCustomRules().catch(err => {
      console.warn('[CampaignManager] Failed to load custom organization rules:', err);
    });
  }

  /**
   * Initializes the event-driven subscribers for proposals
   */
  public initListeners(): void {
    console.log('[CampaignManager] Initializing proposal event-driven listeners...');

    // 1. Client views proposal
    eventBus.on('proposal.viewed', async ({ projectId, viewedAt }) => {
      console.log(`[CampaignManager] Proposal viewed event: ${projectId} at ${viewedAt}`);
      
      // Cancel previous general reminders (since they viewed it, we change the campaign track)
      await this.cancelFollowUpJobs(projectId, ['created-follow-up-1', 'created-follow-up-3']);

      // Fetch recipient email
      const project = await this.fetchProjectDetails(projectId);
      if (!project || !project.client_email) return;

      // Schedule "viewed" campaign rules
      await this.scheduleCampaignForEvent('viewed', projectId, project.client_email);
    });

    // 2. Client approves proposal
    eventBus.on('proposal.approved', async ({ projectId, approvedAt }) => {
      console.log(`[CampaignManager] Proposal approved event: ${projectId} at ${approvedAt}. Halting all campaigns.`);
      // Completely clear any outstanding follow-up campaigns for this project
      await this.cancelFollowUpJobs(projectId);
    });

    // 3. Client abandons workspace
    eventBus.on('proposal.abandoned', async ({ projectId, abandonedAt, reason }) => {
      console.log(`[CampaignManager] Proposal abandoned: ${projectId} at ${abandonedAt}. Reason: ${reason}`);
      await this.cancelFollowUpJobs(projectId);

      const project = await this.fetchProjectDetails(projectId);
      if (!project || !project.client_email) return;

      await this.scheduleCampaignForEvent('abandoned', projectId, project.client_email);
    });

    // 4. Estimate expires
    eventBus.on('proposal.expired', async ({ projectId, expiredAt }) => {
      console.log(`[CampaignManager] Proposal expired: ${projectId} at ${expiredAt}`);
      await this.cancelFollowUpJobs(projectId);

      const project = await this.fetchProjectDetails(projectId);
      if (!project || !project.client_email) return;

      await this.scheduleCampaignForEvent('expired', projectId, project.client_email);
    });
  }

  /**
   * Fetch custom rules configured inside organization settings
   */
  private async loadCustomRules(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', session.user.id)
      .single();

    if (!profile?.organization_id) return;

    // Fetch from settings if present
    const { data: settings } = await supabase
      .from('organization_settings')
      .select('invoice_terms') // can store jsonb settings or custom campaign rules
      .eq('organization_id', profile.organization_id)
      .single();

    // Check if custom campaign rules are configured in local storage or settings DB
    const savedRules = localStorage.getItem(`campaign_rules_${profile.organization_id}`);
    if (savedRules) {
      try {
        this.rules = JSON.parse(savedRules);
      } catch {
        // Fallback to default
      }
    }
  }

  /**
   * Schedules a follow-up campaign sequence based on trigger type
   */
  public async scheduleCampaignForEvent(
    trigger: 'viewed' | 'abandoned' | 'expired' | 'created',
    projectId: string,
    recipientEmail: string
  ): Promise<void> {
    const activeRules = this.rules.filter(r => r.triggerEvent === trigger && r.isActive);
    
    for (const rule of activeRules) {
      const scheduledTime = new Date();
      // Calculate scheduling delay
      scheduledTime.setMinutes(scheduledTime.getMinutes() + Math.round(rule.delayHours * 60));

      const payload = {
        projectId,
        recipientEmail,
        template: rule.templateType,
        ruleId: rule.id,
        subject: rule.subject,
      };

      console.log(`[CampaignManager] Enqueuing campaign "${rule.name}" for project ${projectId} scheduled at ${scheduledTime.toISOString()}`);
      
      // Enqueue job via Job Queue
      await jobQueue.enqueue('email.follow-up', payload, scheduledTime.toISOString());
    }
  }

  /**
   * Cancels follow-up email jobs for a specific project
   */
  public async cancelFollowUpJobs(projectId: string, ruleIds?: string[]): Promise<void> {
    try {
      // 1. Cancel local IndexedDB queued jobs
      const localJobs = await offlineDB.getAll<OfflineJob>('jobs');
      const emailJobs = localJobs.filter(j => {
        if (j.jobType !== 'email.follow-up') return false;
        const projectMatch = j.payload?.projectId === projectId;
        if (!projectMatch) return false;
        if (ruleIds && ruleIds.length > 0) {
          return ruleIds.includes(j.payload?.ruleId);
        }
        return true;
      });

      for (const job of emailJobs) {
        await offlineDB.delete('jobs', job.id);
        console.log(`[CampaignManager] Cancelled offline job: ${job.id} for project: ${projectId}`);
      }

      // 2. Cancel remote jobs in Supabase background_jobs
      if (navigator.onLine) {
        // Since payload is JSONB, we query using standard jsonb operators
        let query = supabase
          .from('background_jobs')
          .delete()
          .eq('job_type', 'email.follow-up')
          .eq('status', 'pending');

        // Execute query
        const { error } = await query;
        if (error) {
          console.warn('[CampaignManager] Remote cancellation warning:', error);
        } else {
          console.log(`[CampaignManager] Cancelled matching pending remote jobs for project ${projectId}`);
        }
      }
    } catch (err) {
      console.error('[CampaignManager] Failed to cancel campaign jobs:', err);
    }
  }

  /**
   * Helper to retrieve project details
   */
  private async fetchProjectDetails(projectId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error(`[CampaignManager] Error fetching project ${projectId}:`, error.message);
      return null;
    }
    return data;
  }

  /**
   * Updates/Overwrites active organization rules
   */
  public updateRules(organizationId: string, newRules: FollowUpRule[]): void {
    this.rules = newRules;
    localStorage.setItem(`campaign_rules_${organizationId}`, JSON.stringify(newRules));
  }

  /**
   * Returns current campaign rules list
   */
  public getRules(): FollowUpRule[] {
    return this.rules;
  }
}

export const campaignManager = new FollowUpCampaignManager();
