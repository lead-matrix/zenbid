import { offlineDB, OfflineJob } from './indexedDB';
import { supabase } from '../api/supabase';
import { eventBus } from './eventBus';

class JobQueue {
  private isProcessing = false;
  private maxRetries = 5;

  constructor() {
    // Add connection listeners to resume queue syncing automatically
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
      // Attempt immediate processing on boot if online
      if (navigator.onLine) {
        setTimeout(() => this.processQueue(), 2000);
      }
    }
  }

  /**
   * Enqueues a new background job.
   * If online, attempts instant execution. If offline, caches in IndexedDB for syncing later.
   */
  public async enqueue(jobType: string, payload: any, scheduledAt?: string): Promise<OfflineJob> {
    const job: OfflineJob = {
      id: crypto.randomUUID(),
      jobType,
      payload,
      status: 'pending',
      retryCount: 0,
      scheduledAt: scheduledAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Save to local IndexedDB first
    await offlineDB.put('jobs', job);

    // Sync to Supabase background_jobs if online (non-blocking)
    if (navigator.onLine) {
      this.syncJobToRemote(job).catch(err => console.warn('[JobQueue] Failed to seed remote job:', err));
    }

    // Trigger processing
    this.processQueue();

    return job;
  }

  /**
   * Syncs a local job's metadata to Supabase
   */
  private async syncJobToRemote(job: OfflineJob): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch user's organization_id from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) return;

    await supabase.from('background_jobs').insert({
      id: job.id,
      organization_id: profile.organization_id,
      job_type: job.jobType,
      payload: job.payload,
      status: job.status,
      retry_count: job.retryCount,
      last_error: job.lastError,
      scheduled_at: job.scheduledAt,
      created_at: job.createdAt,
    });
  }

  /**
   * Process all pending jobs in the queue
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!navigator.onLine) return;

    this.isProcessing = true;

    try {
      const allJobs = await offlineDB.getAll<OfflineJob>('jobs');
      const now = new Date();

      // Filter for jobs that are ready to run (pending/failed status and scheduledAt <= now)
      const runnableJobs = allJobs
        .filter(j => (j.status === 'pending' || j.status === 'failed') && new Date(j.scheduledAt) <= now)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      for (const job of runnableJobs) {
        await this.executeJob(job);
      }
    } catch (err) {
      console.error('[JobQueue] Error during queue processing:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Executes an individual background job
   */
  private async executeJob(job: OfflineJob): Promise<void> {
    job.status = 'running';
    await offlineDB.put('jobs', job);
    this.updateRemoteJobStatus(job.id, 'running').catch(() => {});

    try {
      // 1. Route execution based on Job Type
      switch (job.jobType) {
        case 'ai.generate-scope':
          await this.handleAIGeneration(job.payload);
          break;

        case 'email.follow-up':
          await this.handleEmailFollowUp(job.payload);
          break;

        case 'media.compress':
          // Handled client-side, mock processing complete
          break;

        default:
          throw new Error(`Unknown job type: ${job.jobType}`);
      }

      // 2. Mark complete
      job.status = 'completed';
      await offlineDB.delete('jobs', job.id); // Clear local successful job
      this.updateRemoteJobStatus(job.id, 'completed').catch(() => {});
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error(`[JobQueue] Job ${job.id} failed:`, errorMsg);

      job.retryCount += 1;
      job.lastError = errorMsg;

      if (job.retryCount >= this.maxRetries) {
        // Dead Letter Queue
        job.status = 'failed';
        await offlineDB.put('jobs', job);
        this.updateRemoteJobStatus(job.id, 'failed', errorMsg).catch(() => {});

        // Raise critical notification or event
        console.error(`[JobQueue] Job ${job.id} reached Max Retries (5). Moved to Dead Letter Queue.`);
      } else {
        // Schedule next retry with exponential backoff: 2 ^ retry_count seconds
        const backoffMs = Math.pow(2, job.retryCount) * 1000;
        const newScheduledTime = new Date(Date.now() + backoffMs).toISOString();

        job.status = 'failed';
        job.scheduledAt = newScheduledTime;
        await offlineDB.put('jobs', job);
        
        this.updateRemoteJobStatus(job.id, 'failed', `Retry planned in ${backoffMs / 1000}s. Error: ${errorMsg}`).catch(() => {});
      }
    }
  }

  /**
   * Update remote job status in Supabase table
   */
  private async updateRemoteJobStatus(id: string, status: string, error?: string): Promise<void> {
    if (!navigator.onLine) return;
    await supabase
      .from('background_jobs')
      .update({
        status,
        retry_count: status === 'failed' ? undefined : 0, // database logic updates
        last_error: error || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * AI Generation Handler
   */
  private async handleAIGeneration(payload: { projectId: string; prompt: string }): Promise<void> {
    // Flows through the secure Edge Function Client
    const { data, error } = await supabase.functions.invoke('ai-estimator', {
      body: payload,
    });

    if (error || !data) {
      throw new Error(error?.message || 'AI Edge Function invocation failed');
    }

    // Emit event on successful scope generation
    await eventBus.emit('ai.scope.generated', {
      projectId: payload.projectId,
      tokensUsed: data.tokensUsed || 0,
      costCents: data.costCents || 0,
      durationMs: data.durationMs || 0,
    });
  }

  /**
   * Automated Campaign Reminders handler
   */
  private async handleEmailFollowUp(payload: { projectId: string; recipientEmail: string; template: string }): Promise<void> {
    // Deliver email via internal email log syncing and background sending
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active auth session for email queue');

    const { error } = await supabase.from('email_logs').insert({
      recipient_email: payload.recipientEmail,
      template_type: payload.template,
      subject: `PeakEstimator Reminder — Review your Proposal`,
      delivery_status: 'sent',
      provider: 'resend',
      metadata: { projectId: payload.projectId },
    });

    if (error) throw new Error(`Email delivery insertion failed: ${error.message}`);
  }
}

export const jobQueue = new JobQueue();
