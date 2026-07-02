import React, { useState, useEffect } from 'react';
import { X, Check, Building2, Phone, Mail, Award, ArrowRight, ArrowLeft, Layers, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { useEventBus } from '../../hooks/useEventBus';
import { supabase } from '../../api/supabase';
import { toast } from 'sonner';

interface WelcomeModalProps {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  const { profile, updateProfile } = useAuth();
  const { triggerEvent } = useEventBus();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Profile Form
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [trade, setTrade] = useState('general');

  // Step 2: Markup Form
  const [laborMarkup, setLaborMarkup] = useState(25);
  const [materialMarkup, setMaterialMarkup] = useState(15);
  const [equipmentMarkup, setEquipmentMarkup] = useState(10);

  // Step 3: Integrations Form
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.company_name || '');
      setCompanyPhone(profile.company_phone || '');
      setCompanyEmail(profile.company_email || profile.email || '');
      if (profile.default_labor_markup > 0) setLaborMarkup(profile.default_labor_markup);
      if (profile.default_material_markup > 0) setMaterialMarkup(profile.default_material_markup);
      if (profile.default_equipment_markup > 0) setEquipmentMarkup(profile.default_equipment_markup);
    }
  }, [profile]);

  const handleToolToggle = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    );
  };

  const handleClose = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Local dismissal persistence
      localStorage.setItem(`peak_onboarding_dismissed_${profile.id}`, 'true');
      
      // Supabase dismissal persistence
      await updateProfile({ onboarding_dismissed: true });
      
      toast.success('Onboarding checklist deferred. Customize anytime in Settings.');
      onClose();
    } catch (err) {
      console.error('Error saving onboarding dismissal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Local complete persistence
      localStorage.setItem(`peak_onboarding_completed_${profile.id}`, 'true');
      localStorage.setItem(`peak_onboarding_dismissed_${profile.id}`, 'true');

      // Update database profile
      await updateProfile({
        company_name: companyName,
        company_phone: companyPhone,
        company_email: companyEmail,
        trade: trade as any,
        default_labor_markup: Number(laborMarkup),
        default_material_markup: Number(materialMarkup),
        default_equipment_markup: Number(equipmentMarkup),
        onboarding_completed: true,
        onboarding_dismissed: true,
        concierge_requested: selectedTools.length > 0,
        concierge_details: {
          ...profile.concierge_details,
          onboarding_selected_integrations: selectedTools,
          onboarding_completed_at: new Date().toISOString()
        }
      });

      // Sync organization table with company info
      if (profile.organization_id) {
        await supabase.from('organizations').update({
          name: companyName || profile.company_name || 'My Organization',
          updated_at: new Date().toISOString(),
        }).eq('id', profile.organization_id);
      }

      // Trigger Onboarding Complete event
      await triggerEvent({
        entityType: 'onboarding',
        actionType: 'completed',
        title: 'Enterprise Workspace Initialized',
        description: `Operations initialized for ${companyName || 'General Trades'}. Standard markup model: L:${laborMarkup}% M:${materialMarkup}% E:${equipmentMarkup}%.`,
        sendNotification: true,
        notificationType: 'success'
      });

      toast.success('Workspace configured successfully! Operational readiness optimized.');
      onClose();
    } catch (err) {
      toast.error('Sync failed. Please retry.');
      console.error('Error completing onboarding wizard:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 shadow-premium p-8 rounded-3xl max-w-xl w-full text-white overflow-hidden relative animate-scale-in">
        
        {/* Close Button */}
        <button 
          onClick={handleClose} 
          disabled={loading}
          className="absolute right-6 top-6 text-slate-500 hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress header */}
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-copper animate-pulse" />
          <span className="text-xs font-bold text-copper uppercase tracking-wider">Onboarding Checklist ({step}/3)</span>
          <div className="flex-1 h-[2px] bg-slate-800 rounded-full overflow-hidden ml-4">
            <div 
              className="h-full bg-copper transition-all duration-300 rounded-full" 
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Profile Configuration */}
        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold font-sora tracking-tight text-white mb-2">Company Configuration</h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Establish your basic organizational identity. These fields populate your client-facing proposals, bids, and invoices.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="E.g. Apex Roofing & Contracting"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-copper transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Operations Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      value={companyEmail}
                      onChange={e => setCompanyEmail(e.target.value)}
                      placeholder="ops@company.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-copper transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Operations Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      value={companyPhone}
                      onChange={e => setCompanyPhone(e.target.value)}
                      placeholder="(555) 000-0000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-copper transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Primary Trade Classification</label>
                <select 
                  value={trade}
                  onChange={e => setTrade(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-copper transition-all"
                >
                  <option value="general">General Contracting</option>
                  <option value="roofing">Roofing & Siding</option>
                  <option value="electrical">Electrical Operations</option>
                  <option value="plumbing">Plumbing & Mechanical</option>
                  <option value="hvac">HVAC Services</option>
                  <option value="painting">Painting & Finish Carpentry</option>
                  <option value="other">Other Specialized Trade</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md"
              >
                Configure Estimating Markups <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Markup Setup */}
        {step === 2 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold font-sora tracking-tight text-white mb-2">Operations Markup Model</h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Configure your default cost-plus margins. These variables will automatically apply markup overrides to labor, materials, and equipment items inside estimates.
              </p>
            </div>

            <div className="space-y-5">
              <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-850 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider">Labor Markup</label>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Applied to crew rates and man-hours</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={laborMarkup}
                      onChange={e => setLaborMarkup(Math.max(0, Number(e.target.value)))}
                      className="w-20 bg-slate-900 border border-slate-850 rounded-xl py-2 px-3 text-center text-sm font-bold text-white focus:outline-none focus:border-copper"
                    />
                    <span className="text-sm font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider">Material Markup</label>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Applied to bulk materials and supplier invoices</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={materialMarkup}
                      onChange={e => setMaterialMarkup(Math.max(0, Number(e.target.value)))}
                      className="w-20 bg-slate-900 border border-slate-850 rounded-xl py-2 px-3 text-center text-sm font-bold text-white focus:outline-none focus:border-copper"
                    />
                    <span className="text-sm font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider">Equipment Markup</label>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Applied to machinery, tool rentals, and shipping costs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={equipmentMarkup}
                      onChange={e => setEquipmentMarkup(Math.max(0, Number(e.target.value)))}
                      className="w-20 bg-slate-900 border border-slate-850 rounded-xl py-2 px-3 text-center text-sm font-bold text-white focus:outline-none focus:border-copper"
                    />
                    <span className="text-sm font-bold text-slate-500">%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-copper-950/20 border border-copper-900/30 rounded-2xl text-copper-300">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <p className="text-[10px] leading-relaxed">
                  <strong>Pro Tip:</strong> Setting default markups streamlines bidding workflows. You can still modify individual items or estimate margins dynamically inside the workspace.
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-between gap-4">
              <button 
                onClick={() => setStep(1)}
                className="px-5 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button 
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md"
              >
                Configure Concierge Integrations <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Integrations & Complete */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold font-sora tracking-tight text-white mb-2">Concierge & Workflow Sync</h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Connect your operations to standard contractor software pipelines. Check the tools you currently use, and our customer success team will assist in migrating your data.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {[
                { id: 'quickbooks', name: 'QuickBooks Online', desc: 'Accounting & Payroll' },
                { id: 'excel', name: 'Excel / CSV Import', desc: 'Bespoke Item Lists' },
                { id: 'procore', name: 'Procore API', desc: 'Project Management' },
                { id: 'stripe', name: 'Stripe Payments', desc: 'Invoice Processing' },
                { id: 'salesforce', name: 'Salesforce CRM', desc: 'Client Pipelines' },
                { id: 'hubspot', name: 'HubSpot Marketing', desc: 'Lead Flow' },
              ].map(tool => {
                const isSelected = selectedTools.includes(tool.id);
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolToggle(tool.id)}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                      isSelected 
                        ? 'bg-copper-950/25 border-copper text-white' 
                        : 'bg-slate-950 border-slate-850 hover:bg-slate-900/50 hover:border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold">{tool.name}</span>
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                        isSelected ? 'bg-copper border-copper text-white' : 'border-slate-700 text-transparent'
                      }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1">{tool.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 flex justify-between gap-4">
              <button 
                onClick={() => setStep(2)}
                disabled={loading}
                className="px-5 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button 
                onClick={handleComplete}
                disabled={loading}
                className="px-6 py-3 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                {loading ? 'Configuring Workspace...' : 'Complete Workspace Configuration'} 
                {!loading && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
