import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../api/supabase';
import type { Organization } from '../types';

interface WhiteLabelContextValue {
  tenantOrg: Organization | null;
  loading: boolean;
  error: Error | null;
}

const WhiteLabelContext = createContext<WhiteLabelContextValue>({
  tenantOrg: null,
  loading: true,
  error: null,
});

export function WhiteLabelProvider({ children }: { children: ReactNode }) {
  const [tenantOrg, setTenantOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function detectTenant() {
      try {
        const hostname = window.location.hostname;
        
        // Skip detection for local dev and main SaaS domain
        if (
          hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.endsWith('peakestimator.com') ||
          hostname.includes('vercel.app')
        ) {
          setLoading(false);
          return;
        }

        // Search for matching custom domain
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('custom_domain', hostname)
          .eq('custom_domain_verified', true)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setTenantOrg(data as Organization);
          applyWhiteLabelTheming(data as Organization);
        }
      } catch (err: any) {
        console.error('[WhiteLabelProvider] Failed to detect tenant:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    detectTenant();
  }, []);

  // Helper to inject CSS variables dynamically based on tenant settings
  function applyWhiteLabelTheming(org: Organization) {
    if (!org.white_label_settings) return;
    const settings = org.white_label_settings as Record<string, any>;
    
    const root = document.documentElement;
    if (settings.primaryColor) {
      root.style.setProperty('--color-primary', settings.primaryColor);
    }
    if (settings.logoUrl) {
      // Store logo URL in a CSS var or handle via context
    }
    if (settings.appName) {
      document.title = settings.appName;
    }
  };

  return (
    <WhiteLabelContext.Provider value={{ tenantOrg, loading, error }}>
      {/* If we're loading the tenant config, we could show a generic spinner, 
          but usually we want to be as fast as possible. */}
      {loading ? (
         <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950">
           <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin border-blue-500" />
         </div>
      ) : (
        children
      )}
    </WhiteLabelContext.Provider>
  );
}

export function useWhiteLabel() {
  return useContext(WhiteLabelContext);
}
