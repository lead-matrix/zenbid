import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Briefcase, BookOpen, Settings, LogOut, ShieldAlert, X, Menu } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAppStore } from '../../store/useAppStore';
import { toast } from 'sonner';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/projects',   label: 'Projects',   icon: Briefcase },
  { path: '/price-book', label: 'Price Book', icon: BookOpen },
  { path: '/settings',   label: 'Settings',   icon: Settings },
];

function PeakLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="#1C2B5C"/>
      <polygon points="32,8 6,56 58,56" fill="none" stroke="#C07840" strokeWidth="2.5" strokeLinejoin="round"/>
      <polyline points="18,50 26,28 32,40 38,28 46,50" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="36" y1="16" x2="52" y2="30" stroke="#C07840" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="52" cy="30" r="3" fill="#C07840"/>
    </svg>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const profile = useAppStore(s => s.profile);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
      isActive ? 'bg-navy-50 text-navy-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`;

  const navIconClass = (isActive: boolean) =>
    `flex-shrink-0 ${isActive ? 'text-navy-600' : 'text-slate-400'}`;

  return (
    <>
      {/* ── Desktop sidebar (lg+) ───────────────────── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-slate-100 flex-col z-50 shadow-sm">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <PeakLogo size={34} />
            <div>
              <div className="text-sm font-bold text-slate-900 leading-none">Peak<span className="text-copper-600">Estimator</span></div>
              <div className="text-xs text-slate-400 mt-0.5">Contractor Bidding</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map(({ path, label, icon: Icon }) => (
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
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 ${
                isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-rose-50/50 hover:text-rose-700'
              }`}>
              {({ isActive }) => (
                <>
                  <ShieldAlert className={`flex-shrink-0 ${isActive ? 'text-rose-600' : 'text-slate-400'}`} style={{ width: 18, height: 18 }} />
                  Admin Portal
                </>
              )}
            </NavLink>
          )}
        </nav>

        {/* Profile + Logout */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-1">
          {profile && (
            <div className="px-3 py-2.5 rounded-xl bg-slate-50 mb-2">
              <div className="text-xs font-semibold text-slate-800 truncate">
                {profile.company_name || profile.full_name || 'Your Company'}
              </div>
              <div className="text-xs text-slate-400 truncate">{profile.email}</div>
            </div>
          )}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all">
            <LogOut style={{ width: 18, height: 18 }} className="flex-shrink-0" />
            Sign Out
          </button>
          <div className="mt-3 mx-1 px-3 py-2 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #1C2B5C, #2E449F)' }}>
            <div className="text-xs font-bold text-white">Peak<span className="text-copper-300">Estimator</span></div>
            <div className="text-xs text-slate-300 opacity-75">Precision Bidding</div>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-100 shadow-sm h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <PeakLogo size={28} />
          <span className="text-sm font-bold text-slate-900">Peak<span className="text-copper-600">Estimator</span></span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-all">
          <Menu style={{ width: 20, height: 20 }} />
        </button>
      </div>

      {/* ── Mobile drawer overlay ───────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-white h-full flex flex-col shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <PeakLogo size={32} />
                <div>
                  <div className="text-sm font-bold text-slate-900">Peak<span className="text-copper-600">Estimator</span></div>
                  <div className="text-xs text-slate-400">Contractor Bidding</div>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all">
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map(({ path, label, icon: Icon }) => (
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
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-rose-50/50 hover:text-rose-700'
                  }`}>
                  {({ isActive }) => (
                    <>
                      <ShieldAlert className={`flex-shrink-0 ${isActive ? 'text-rose-600' : 'text-slate-400'}`} style={{ width: 18, height: 18 }} />
                      Admin Portal
                    </>
                  )}
                </NavLink>
              )}
            </nav>
            {/* Profile */}
            <div className="px-3 py-4 border-t border-slate-100 space-y-1">
              {profile && (
                <div className="px-3 py-2.5 rounded-xl bg-slate-50 mb-2">
                  <div className="text-xs font-semibold text-slate-800 truncate">{profile.company_name || profile.full_name || 'Your Company'}</div>
                  <div className="text-xs text-slate-400 truncate">{profile.email}</div>
                </div>
              )}
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all">
                <LogOut style={{ width: 18, height: 18 }} className="flex-shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav ───────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-lg flex items-center justify-around px-1 h-16">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all flex-1 ${
              isActive ? 'text-navy-700' : 'text-slate-400 hover:text-slate-700'
            }`}>
            {({ isActive }) => (
              <>
                <Icon className={isActive ? 'text-navy-600' : 'text-slate-400'} style={{ width: 20, height: 20 }} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
        {profile?.is_admin && (
          <NavLink to="/admin" className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all flex-1 ${
              isActive ? 'text-rose-600' : 'text-slate-400 hover:text-rose-500'
            }`}>
            {({ isActive }) => (
              <>
                <ShieldAlert className={isActive ? 'text-rose-600' : 'text-slate-400'} style={{ width: 20, height: 20 }} />
                <span className="text-[10px] font-medium leading-none">Admin</span>
              </>
            )}
          </NavLink>
        )}
      </nav>
    </>
  );
}
