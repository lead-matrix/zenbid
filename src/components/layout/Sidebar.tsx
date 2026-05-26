import { NavLink, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Briefcase, BookOpen, Settings, LogOut, ShieldAlert, X, Menu, Sun, Moon, Award, HelpCircle, Bell } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAppStore } from '../../store/useAppStore';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import NotificationPanel from './NotificationPanel';

const navItems = [
  { path: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/projects',   label: 'Projects',   icon: Briefcase },
  { path: '/price-book', label: 'Price Book', icon: BookOpen },
  { path: '/success',    label: 'Client Success', icon: Award, hideForAdmin: true },
  { path: '/support',    label: 'Support Desk', icon: HelpCircle },
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
    // Sync external dark mode changes if any
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUnreadCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error && count !== null) {
      setUnreadCount(count);
    }
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

  return (
    <>
      {/* ── Desktop sidebar (lg+) ───────────────────── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-60 bg-navy border-r border-navy-700 flex-col z-50 shadow-soft">
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
          {navItems.filter(item => !(item.hideForAdmin && profile?.is_admin)).map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} className={navLinkClass}>
              {({ isActive }) => (
                <>
                  <Icon className={navIconClass(isActive)} style={{ width: 18, height: 18 }} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          {profile?.is_admin && (
            <NavLink to="/admin" className={({ isActive }) =>
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
            </div>
          )}

          {/* Theme switcher */}
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

          {/* Notifications Toggle */}
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
            PeakEstimator v1.2.0
          </div>
        </div>
      </aside>
 
      {/* ── Mobile top bar ──────────────────────────── */}
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
              <span className="absolute top-1.5 right-1.5 bg-copper text-white text-[8px] font-bold px-1 py-0.2 rounded-full min-w-3.5 h-3.5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => setMobileOpen(true)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-all">
            <Menu style={{ width: 20, height: 20 }} />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer overlay ───────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-navy h-full flex flex-col shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className="px-5 py-4 border-b border-navy-700 flex items-center justify-between">
              <Link to="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
                <PeakLogo size={32} />
                <div>
                  <div className="text-sm font-bold text-white">Peak<span className="text-copper">Estimator</span></div>
                  <div className="text-xs text-slate-400">Contractor Bidding</div>
                </div>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-navy-700 transition-all">
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.filter(item => !(item.hideForAdmin && profile?.is_admin)).map(({ path, label, icon: Icon }) => (
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
                <NavLink to="/admin" onClick={() => setMobileOpen(false)} className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive ? 'bg-navy-700 text-rose-400' : 'text-slate-400 hover:bg-navy-700/60 hover:text-rose-400'
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
            {/* Profile */}
            <div className="px-3 py-4 border-t border-navy-700 space-y-2 bg-navy-950/40">
              {profile && (
                <div className="px-3 py-2.5 rounded-xl bg-navy-700 mb-2">
                  <div className="text-xs font-semibold text-white truncate">{profile.company_name || profile.full_name || 'Your Company'}</div>
                  <div className="text-[10px] text-slate-400 truncate">{profile.email}</div>
                </div>
              )}
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-navy-700 hover:text-rose-400 transition-all">
                <LogOut style={{ width: 14, height: 14 }} className="flex-shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

 
      {/* ══════════════════════════════════════════════
           MOBILE — Top bar + Slide-in sidebar drawer
         ══════════════════════════════════════════════ */}

      {/* Top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-md border-b border-navy-700/60 h-14 flex items-center justify-between px-4 shadow-lg">
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <PeakLogo size={26} />
          <span className="text-sm font-bold text-white tracking-tight">Peak<span className="text-copper">Estimator</span></span>
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-white rounded-lg transition-all">
            {isDark ? <Sun style={{ width: 17, height: 17 }} className="text-amber-400" /> : <Moon style={{ width: 17, height: 17 }} />}
          </button>
          <button onClick={() => setShowNotifications(prev => !prev)} className="p-2 text-slate-400 hover:text-white rounded-lg transition-all relative">
            <Bell style={{ width: 17, height: 17 }} className={unreadCount > 0 ? 'text-copper animate-pulse' : ''} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-copper text-white text-[8px] font-black rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 text-slate-400 hover:text-white rounded-lg transition-all ml-1"
            aria-label="Open menu"
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>
        </div>
      </div>

      {/* Drawer backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-72 z-[70] bg-navy border-r border-navy-700/80 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Drawer header */}
        <div className="px-5 py-4 border-b border-navy-700/60 flex items-center justify-between">
          <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
            <PeakLogo size={30} />
            <div>
              <div className="text-sm font-bold text-white leading-none">Peak<span className="text-copper">Estimator</span></div>
              <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Enterprise</div>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-navy-700 transition-all"
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Profile card */}
        {profile && (
          <div className="mx-3 mt-4 px-4 py-3 rounded-2xl bg-navy-700/60 border border-navy-700/40">
            <div className="text-xs font-bold text-white truncate">{profile.company_name || profile.full_name || 'Your Company'}</div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">{profile.email}</div>
            {profile.is_admin && (
              <span className="inline-block mt-1.5 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-full">Superadmin</span>
            )}
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.filter(item => !(item.hideForAdmin && profile?.is_admin)).map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-navy-700 text-white border-l-2 border-copper shadow-sm'
                    : 'text-slate-400 hover:bg-navy-700/50 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`shrink-0 ${isActive ? 'text-copper' : 'text-slate-500'}`} style={{ width: 18, height: 18 }} />
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
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all mt-2 ${
                  isActive ? 'bg-rose-500/10 text-rose-400 border-l-2 border-rose-500' : 'text-slate-400 hover:bg-rose-500/5 hover:text-rose-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <ShieldAlert className={`shrink-0 ${isActive ? 'text-rose-400' : 'text-slate-500'}`} style={{ width: 18, height: 18 }} />
                  Admin Portal
                </>
              )}
            </NavLink>
          )}
        </nav>

        {/* Bottom controls */}
        <div className="px-3 pb-6 pt-3 border-t border-navy-700/60 space-y-2">
          <button
            onClick={() => { setShowNotifications(prev => !prev); setMobileOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-navy-700 hover:text-white transition-all"
          >
            <Bell style={{ width: 16, height: 16 }} className={unreadCount > 0 ? 'text-copper' : ''} />
            Notifications
            {unreadCount > 0 && <span className="ml-auto bg-copper text-white text-[9px] font-black px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all">
            <LogOut style={{ width: 16, height: 16 }} />
            Sign Out
          </button>
          <div className="text-center text-[9px] text-slate-600 uppercase tracking-widest pt-1">PeakEstimator v1.2.0</div>
        </div>
      </aside>

      {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />
      }
    </>
  );
}
