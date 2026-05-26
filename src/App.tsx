import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { supabase } from './api/supabase';
import { useAppStore } from './store/useAppStore';

import Sidebar from './components/layout/Sidebar';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import EstimatorWorkspace from './pages/EstimatorWorkspace';
import PriceBook from './pages/PriceBook';
import Settings from './pages/Settings';
import ClientPortal from './pages/ClientPortal';
import LandingPage from './pages/LandingPage';
import AdminPortal from './pages/AdminPortal';
import ClientSuccess from './pages/ClientSuccess';
import SupportDesk from './pages/SupportDesk';
import EnterpriseOnboarding from './pages/EnterpriseOnboarding';
import MaintenanceContracts from './pages/MaintenanceContracts';

function SmartRoot() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C07840', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (session) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const profile = useAppStore(s => s.profile);
  const fetchProfile = useAppStore(s => s.fetchProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile !== null) {
      setLoading(false);
    } else {
      fetchProfile().finally(() => setLoading(false));
    }
  }, [profile, fetchProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || !profile.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const fetchProfile = useAppStore(s => s.fetchProfile);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-navy-950 transition-colors duration-200">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 lg:ml-60 app-main">
        {children}
      </main>
    </div>
  );
}

function App() {
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/" element={<SmartRoot />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/approve/:shareToken" element={<ClientPortal />} />
        <Route path="/dashboard"   element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/projects"    element={<ProtectedRoute><AppLayout><Projects /></AppLayout></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><AppLayout><EstimatorWorkspace /></AppLayout></ProtectedRoute>} />
        <Route path="/price-book"  element={<ProtectedRoute><AppLayout><PriceBook /></AppLayout></ProtectedRoute>} />
        <Route path="/settings"    element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
        <Route path="/admin"       element={<ProtectedRoute><AppLayout><AdminRoute><AdminPortal /></AdminRoute></AppLayout></ProtectedRoute>} />
        <Route path="/success"     element={<ProtectedRoute><AppLayout><ClientSuccess /></AppLayout></ProtectedRoute>} />
        <Route path="/support"     element={<ProtectedRoute><AppLayout><SupportDesk /></AppLayout></ProtectedRoute>} />
        <Route path="/onboarding"  element={<EnterpriseOnboarding />} />
        {/* NEW ROUTES */}
        <Route path="/contracts"   element={<ProtectedRoute><AppLayout><MaintenanceContracts /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
