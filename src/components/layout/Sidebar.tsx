import { NavLink, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Briefcase, BookOpen, Settings, LogOut, ShieldAlert, X, Menu, Sun, Moon, Award, HelpCircle, Bell, ClipboardList, FileText, Wrench } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAppStore } from '../../store/useAppStore';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import NotificationPanel from './NotificationPanel';

const navItems = [
  { path: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/projects',   label: 'Projects',   icon: Briefcase },
  { path: '/price-book', label: 'Price Book', icon: BookOpen },
  { path: '/contracts',  label: 'Maintenance', icon: Wrench, hideForAdmin: true },
  { path: '/success',    label: 'Client Success', icon: Award, hideForAdmin: true },
  { path: '/support',    label: 'Support Desk', icon: HelpCircle },
  { path: '/onboarding', label: 'Onboarding Guide', icon: ClipboardList },
  { path: '/settings',   label: 'Settings',   icon: Settings },
];

function PeakLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="#0F172A"/>
      <polygon points="32,8 6,56 58,56" fill="none" stroke="#C58B5C" strokeWidth="2.5" strokeLinejoin="round"/>
      <polyline points="18,50 26,28 32,40 38,28 46,50" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="36" y1="16" x2="52" y2="30" stroke="#C58B5C" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="52" cy="30" r="3" fill="#C58B5C"/>
    </svg>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const profile = useAppStore(s => s.profile);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const channel = supabase
      .channel('sidebar:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchUnreadCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUnreadCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (!error && count !== null) setUnreadCount(count);
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      toast.success('Dark mode activated', { duration: 1500 });
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      toast.success('Light mode activated', { duration: 1500 });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-navy-700 text-white shadow-soft border-l-2 border-copper'
        : 'text-slate-400 hover:bg-navy-700/60 hover:text-slate-100'
    }`;

  const navIconClass = (isActive: boolean) =>
    `flex-shrink-0 transition-colors duration-150 ${isActive ? 'text-copper' : 'text-slate-400'}`;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-navy-700">
        <Link to="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <PeakLogo size={34} />
          <div>
            <div className="text-sm font-bold text-white leading-none tracking-tight">Peak<span className="text-copper">Estimator</span></div>
            <div className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-1">Enterprise</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems
          .filter(item => !(item.hideForAdmin && profile?.is_admin))
          .map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} className={navLinkClass} onClick={() => setMobileOpen(false)}>
            {({ isActive }) => (
              <>
                <Icon className={navIconClass(isActive)} style={{ width: 18, height: 18 }} />
                {label}
              </>
            )}
          </NavLink>
        ))}

        {profile?.is_admin && (
          <NavLink
            to="/admin"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 ${
                isActive ? 'bg-navy-700 text-rose-400 border-l-2 border-rose-500' : 'text-slate-400 hover:bg-navy-700/60 hover:text-rose-400'
              }`}>
            {({ isActive }) => (
              <>
                <ShieldAlert className={`flex-shrink-0 ${isActive ? 'text-rose-400' : 'text-slate-400'}`} style={{ width: 18, height: 18 }} />
                Admin Portal
              </>
            )}
          </NavLink>
        )}
      </nav>

      {/* Profile + Controls */}
      <div className="px-3 py-4 border-t border-navy-700 space-y-2 bg-navy-950/40">
        {profile && (
          <div className="px-3 py-2.5 rounded-xl bg-navy-700/80 border border-navy-700/45">
            <div className="text-xs font-semibold text-white truncate">
              {profile.company_name || profile.full_name || 'Your Company'}
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">{profile.email}</div>
            {profile.billing_tier && (
              <span className={`inline-block mt-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide ${
                profile.billing_tier === 'enterprise' ? 'bg-copper/20 text-copper' :
                profile.billing_tier === 'pro' ? 'bg-blue-500/20 text-blue-400' :
                'bg-slate-700 text-slate-400'
              }`}>{profile.billing_tier}</span>
            )}
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-navy-700 hover:text-white transition-all"
        >
          <span className="flex items-center gap-2">
            {isDark ? <Sun style={{ width: 14, height: 14 }} className="text-amber-400" /> : <Moon style={{ width: 14, height: 14 }} className="text-slate-400" />}
            {isDark ? 'Light Theme' : 'Dark Theme'}
          </span>
          <span className="text-[10px] bg-navy-700 text-slate-300 px-2 py-0.5 rounded-md border border-navy-700">Auto</span>
        </button>

        <button
          onClick={() => setShowNotifications(prev => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-navy-700 hover:text-white transition-all relative"
        >
          <span className="flex items-center gap-2">
            <Bell style={{ width: 14, height: 14 }} className={unreadCount > 0 ? "text-copper animate-pulse" : "text-slate-400"} />
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="bg-copper text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>

        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-navy-700 hover:text-rose-400 transition-all">
          <LogOut style={{ width: 14, height: 14 }} className="flex-shrink-0" />
          Sign Out
        </button>
        
        <div className="pt-2 text-center text-[9px] text-slate-500 tracking-wider uppercase border-t border-navy-700/40">
          PeakEstimator v2.0.0
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar (lg+) ───────────────────── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-60 bg-navy border-r border-navy-700 flex-col z-50 shadow-soft">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-navy-900 border-b border-slate-100 dark:border-navy-800 shadow-sm h-14 flex items-center justify-between px-4 transition-colors">
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <PeakLogo size={28} />
          <span className="text-sm font-bold text-slate-900 dark:text-white">Peak<span className="text-copper">Estimator</span></span>
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-all">
            {isDark ? <Sun style={{ width: 18, height: 18 }} /> : <Moon style={{ width: 18, height: 18 }} />}
          </button>
          <button onClick={() => setShowNotifications(prev => !prev)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-all relative">
            <Bell style={{ width: 18, height: 18 }} className={unreadCount > 0 ? "text-copper" : ""} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-copper rounded-full" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-all"
          >
            {mobileOpen ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 h-full w-72 bg-navy flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {showNotifications && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowNotifications(false)}>
          <div className="absolute inset-0" />
          <div
            className="absolute bottom-4 left-4 lg:left-64 w-80"
            onClick={e => e.stopPropagation()}
          >
            <NotificationPanel onClose={() => setShowNotifications(false)} />
          </div>
        </div>
      )}
    </>
  );
}
