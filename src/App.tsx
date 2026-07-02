/**
 * App.tsx — Application root with centralized auth and providers.
 *
 * ARCHITECTURE:
 *   AuthProvider (single session listener — replaces dual onAuthStateChange)
 *     └── OrganizationProvider (tenant context)
 *           └── ErrorBoundary (app-level crash shield)
 *                 └── Router
 *                       ├── Public routes (ClientPortal, LandingPage)
 *                       └── Protected routes (AppLayout)
 *
 * Auth state is consumed via useAuth() hook everywhere.
 * No component should call supabase.auth.onAuthStateChange() directly.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
const AcceptInvite = lazy(() => import('./pages/Auth/AcceptInvite'));
import { Toaster } from 'sonner';

import { AuthProvider, useAuth } from './providers/AuthProvider';
import { OrganizationProvider } from './providers/OrganizationProvider';
import { WhiteLabelProvider } from './providers/WhiteLabelProvider';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { ImpersonationBanner } from './components/layout/ImpersonationBanner';
import Sidebar from './components/layout/Sidebar';
import { useAppStore } from './store/useAppStore';
import { useEffect } from 'react';
import { usePermissions } from './hooks/usePermissions';

// ─── Eager-loaded (critical path) ─────────────────────────────────
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ForgotPassword from './pages/Auth/ForgotPassword';
import LandingPage from './pages/LandingPage';
import ClientPortal from './pages/ClientPortal';

// ─── Lazy-loaded (code split) ──────────────────────────────────────
const Dashboard            = lazy(() => import('./pages/Dashboard'));
const Projects             = lazy(() => import('./pages/Projects'));
const EstimatorWorkspace   = lazy(() => import('./pages/EstimatorWorkspace'));
const PriceBook            = lazy(() => import('./pages/PriceBook'));
const Settings             = lazy(() => import('./pages/Settings'));
const AdminPortalShell     = lazy(() => import('./pages/admin/AdminPortalShell'));
const ClientSuccess        = lazy(() => import('./pages/ClientSuccess'));
const SupportDesk          = lazy(() => import('./pages/SupportDesk'));
const EnterpriseOnboarding = lazy(() => import('./pages/EnterpriseOnboarding'));
const MaintenanceContracts = lazy(() => import('./pages/MaintenanceContracts'));
const ContractPortal       = lazy(() => import('./pages/ContractPortal'));
const SubcontractorPortal  = lazy(() => import('./pages/SubcontractorPortal'));

// ─── Shared loading spinner ───────────────────────────────────────

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin border-blue-500" />
    </div>
  );
}

// ─── SmartRoot — session-aware landing ────────────────────────────

function SmartRoot() {
  const { session, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

// ─── ProtectedRoute — redirects to / if no session ────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ─── AdminRoute — platform staff only ─────────────────────────────

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const { isAdminPortalAccess } = usePermissions();

  if (loading) return <PageSpinner />;

  if (!profile) return <Navigate to="/dashboard" replace />;
  if (!isAdminPortalAccess) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

// ─── AppLayout — authenticated shell with sidebar ─────────────────

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <div className="flex min-h-screen bg-slate-50 dark:bg-navy-950 transition-colors duration-200">
        <Sidebar />
        <main className="flex-1 overflow-auto pt-14 lg:pt-0 lg:ml-60 app-main">
          {children}
        </main>
      </div>
    </>
  );
}

// ─── App root ──────────────────────────────────────────────────────

function AppRoutes() {
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
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Public */}
          <Route path="/"                     element={<SmartRoot />} />
          <Route path="/login"                element={<Login />} />
          <Route path="/signup"               element={<Signup />} />
          <Route path="/forgot-password"      element={<ForgotPassword />} />
          <Route path="/approve/:shareToken"  element={<ClientPortal />} />
          <Route path="/onboarding"           element={<EnterpriseOnboarding />} />
          <Route path="/contract/:shareToken" element={<ContractPortal />} />
          <Route path="/sub-bid/:token"       element={<SubcontractorPortal />} />

          {/* Protected */}
          <Route path="/dashboard"   element={<ProtectedRoute><AppLayout><ErrorBoundary label="Dashboard" level="route"><Dashboard /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/projects"    element={<ProtectedRoute><AppLayout><ErrorBoundary label="Projects" level="route"><Projects /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><AppLayout><ErrorBoundary label="Estimator" level="route"><EstimatorWorkspace /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/price-book"  element={<ProtectedRoute><AppLayout><ErrorBoundary label="Price Book" level="route"><PriceBook /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/settings"    element={<ProtectedRoute><AppLayout><ErrorBoundary label="Settings" level="route"><Settings /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/support"     element={<ProtectedRoute><AppLayout><ErrorBoundary label="Support" level="route"><SupportDesk /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/success"     element={<ProtectedRoute><AppLayout><ClientSuccess /></AppLayout></ProtectedRoute>} />
          <Route path="/contracts"   element={<ProtectedRoute><AppLayout><ErrorBoundary label="Contracts" level="route"><MaintenanceContracts /></ErrorBoundary></AppLayout></ProtectedRoute>} />

          {/* Admin — platform staff only */}
          <Route path="/admin"       element={<ProtectedRoute><AppLayout><AdminRoute><ErrorBoundary label="Admin Portal" level="route"><AdminPortalShell /></ErrorBoundary></AdminRoute></AppLayout></ProtectedRoute>} />

          <Route path="/welcome"              element={<AcceptInvite />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary label="Application" level="app">
      <WhiteLabelProvider>
        <AuthProvider>
          <OrganizationProvider>
            <AppRoutes />
          </OrganizationProvider>
        </AuthProvider>
      </WhiteLabelProvider>
    </ErrorBoundary>
  );
}
