import { useEffect, useState } from 'react';
import { supabase } from '../../api/supabase';
import { Bell, Check, X, Shield, Activity, HelpCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { Notification } from '../../types';

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    // Set up real-time subscription for in-app notifications
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && data) {
      setNotifications(data as Notification[]);
    }
    setLoading(false);
  };

  const handleMarkAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update notification');
    } else {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
  };

  const handleMarkAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      toast.error('Failed to update notifications');
    } else {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'support':
        return <HelpCircle className="w-4 h-4 text-emerald-500" />;
      case 'activity':
        return <Activity className="w-4 h-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-navy border-l border-slate-200 dark:border-navy-850 shadow-premium z-[90] flex flex-col animate-slide-in-right">
      <div className="px-5 py-4 border-b border-app-border dark:border-navy-800 flex items-center justify-between bg-slate-50 dark:bg-navy-950/45">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-copper" />
          <span className="font-sora font-bold text-sm text-slate-900 dark:text-white">Notifications</span>
          {notifications.filter(n => !n.is_read).length > 0 && (
            <span className="text-[9px] font-bold bg-copper text-white px-2 py-0.5 rounded-full">
              {notifications.filter(n => !n.is_read).length} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {notifications.filter(n => !n.is_read).length > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-[10px] text-copper font-bold hover:text-copper-hover hover:underline mr-2"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-app-border dark:divide-navy-850 scrollbar-thin">
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-copper border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center px-6">
            <Bell className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-800 dark:text-slate-200 text-xs font-semibold">You're all caught up</p>
            <p className="text-slate-400 text-[10px] mt-0.5">Alerts about your projects and support will appear here</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={`p-4 transition-colors relative flex items-start gap-3 ${
                n.is_read ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-navy-950/20'
              }`}
            >
              <div className="mt-0.5 w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-950 flex items-center justify-center flex-shrink-0">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{n.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                <p className="text-[9px] text-slate-400 mt-1 font-semibold uppercase">
                  {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at{' '}
                  {new Date(n.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!n.is_read && (
                <button
                  onClick={() => handleMarkAsRead(n.id)}
                  className="absolute right-4 top-4 w-5 h-5 rounded-full hover:bg-slate-200 dark:hover:bg-navy-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                  title="Mark as read"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
