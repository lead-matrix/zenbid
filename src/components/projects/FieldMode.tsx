import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RotateCw } from 'lucide-react';
import { offlineDB, OfflineDraft } from '../../lib/indexedDB';
import { jobQueue } from '../../lib/jobQueue';
import { toast } from 'sonner';

export default function FieldMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineDraft[]>([]);
  const [pendingJobsCount, setPendingJobsCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet connection restored! Background sync started.');
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Offline mode activated. Drafts will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadOfflineData();

    const interval = setInterval(loadOfflineData, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  async function loadOfflineData() {
    try {
      const drafts = await offlineDB.getAll<OfflineDraft>('drafts');
      setOfflineDrafts(drafts);

      const jobs = await offlineDB.getAll<any>('jobs');
      setPendingJobsCount(jobs.filter((j: any) => j.status === 'pending' || j.status === 'failed').length);
    } catch (e) {
      console.error('Error loading offline stats:', e);
    }
  };

  async function triggerSync() {
    if (!navigator.onLine) {
      toast.error('Cannot sync while offline.');
      return;
    }
    setSyncing(true);
    try {
      await jobQueue.processQueue();
      await loadOfflineData();
      toast.success('Sync completed successfully!');
    } catch (err: any) {
      toast.error(`Sync partially failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-800/80 shadow-card p-5 space-y-4">
      {/* Network Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isOnline 
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' 
              : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600'
          }`}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white font-sora">
              {isOnline ? 'Online - Cloud Synced' : 'Offline - Field Mode'}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-inter">
              {isOnline ? 'All drafts are synced with remote servers.' : 'Data is safe in IndexedDB and will sync automatically.'}
            </p>
          </div>
        </div>
        {isOnline && pendingJobsCount > 0 && (
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-copper/10 hover:bg-copper/20 text-copper rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        )}
      </div>

      {/* Stats Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 dark:bg-navy-950/40 rounded-xl p-3 border border-slate-100 dark:border-navy-850 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Offline Drafts
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-slate-800 dark:text-white font-sora">
              {offlineDrafts.length}
            </span>
            <span className="text-xs text-slate-400">stored</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-navy-950/40 rounded-xl p-3 border border-slate-100 dark:border-navy-850 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Queue Status
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-xl font-bold font-sora ${pendingJobsCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {pendingJobsCount}
            </span>
            <span className="text-xs text-slate-400">pending</span>
          </div>
        </div>
      </div>

      {/* Sync Queue Table */}
      {offlineDrafts.length > 0 && (
        <div className="border-t border-slate-100 dark:border-navy-800 pt-3.5 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
            Recent Local Drafts
          </span>
          <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin pr-1">
            {offlineDrafts.map(draft => (
              <div 
                key={draft.id} 
                className="flex items-center justify-between p-2.5 bg-slate-50/50 dark:bg-navy-950/20 border border-slate-100 dark:border-navy-800 rounded-xl"
              >
                <div className="truncate pr-4">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {draft.data?.name || `Draft ${draft.type}`}
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">
                    Drafted {new Date(draft.updatedAt).toLocaleTimeString()}
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 text-[9px] font-bold rounded uppercase">
                    Local Only
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
