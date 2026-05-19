import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
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

function SmartRoot() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A1024' }}>
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

function AppLayout({ children }: { children: React.ReactNode }) {
  const fetchProfile = useAppStore(s => s.fetchProfile);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      {/* pt-14 on mobile for top bar, lg:pt-0 for desktop; lg:ml-60 for sidebar offset */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 lg:ml-60 app-main">
        {children}
      </main>
    </div>
  );
}

function App() {
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
        <Route path="/admin"       element={<ProtectedRoute><AppLayout><AdminPortal /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
