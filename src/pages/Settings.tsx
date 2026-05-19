import { useState, useRef } from 'react';
import { Building2, Mail, Phone, Save, Upload, Percent } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../api/supabase';
import { toast } from 'sonner';

export default function Settings() {
  const { profile, updateProfile } = useAppStore();
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    company_name: profile?.company_name || '',
    company_email: profile?.company_email || '',
    company_phone: profile?.company_phone || '',
  });
  const [markupForm, setMarkupForm] = useState({
    default_labor_markup: profile?.default_labor_markup ?? 30,
    default_material_markup: profile?.default_material_markup ?? 18,
    default_equipment_markup: profile?.default_equipment_markup ?? 12,
    default_tax_rate: profile?.default_tax_rate ?? 8,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState(profile?.company_logo || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    await updateProfile({ ...profileForm, company_logo: logoUrl });
    toast.success('Profile saved!');
    setSavingProfile(false);
  };

  const handleSaveMarkup = async () => {
    setSavingMarkup(true);
    await updateProfile(markupForm);
    toast.success('Default markups saved!');
    setSavingMarkup(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ext = file.name.split('.').pop();
    const path = `logos/${user.id}/company-logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error('Logo upload failed: ' + uploadError.message);
      setUploadingLogo(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('company-logos')
      .getPublicUrl(path);

    setLogoUrl(publicUrl);
    await updateProfile({ company_logo: publicUrl });
    toast.success('Logo uploaded!');
    setUploadingLogo(false);
  };

  const inputClass = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-copper-500/20 focus:border-copper-400 transition-all';

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your company profile and defaults</p>
      </div>

      {/* Company Profile */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-navy-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-navy-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Company Profile</h2>
              <p className="text-xs text-slate-400">Shown on all proposals and PDFs</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Logo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Company Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
                <p className="text-xs text-slate-400 mt-1.5">PNG, JPG, SVG up to 2MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Your Name</label>
              <input
                id="settings-full-name"
                type="text"
                value={profileForm.full_name}
                onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="John Smith"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Company Name</label>
              <input
                id="settings-company-name"
                type="text"
                value={profileForm.company_name}
                onChange={e => setProfileForm(p => ({ ...p, company_name: e.target.value }))}
                placeholder="Smith Electric LLC"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> Company Email</span>
              </label>
              <input
                id="settings-company-email"
                type="email"
                value={profileForm.company_email}
                onChange={e => setProfileForm(p => ({ ...p, company_email: e.target.value }))}
                placeholder="info@company.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> Company Phone</span>
              </label>
              <input
                id="settings-company-phone"
                type="tel"
                value={profileForm.company_phone}
                onChange={e => setProfileForm(p => ({ ...p, company_phone: e.target.value }))}
                placeholder="(555) 000-0000"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="save-profile-btn"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="flex items-center gap-2 px-5 py-2.5 bg-copper hover:bg-copper-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-copper-200/50 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* Default Markups */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Percent className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Default Markup Rates</h2>
              <p className="text-xs text-slate-400">Pre-filled into every new project</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: 'Labor Markup', field: 'default_labor_markup', color: 'blue' },
              { label: 'Material Markup', field: 'default_material_markup', color: 'emerald' },
              { label: 'Equipment Markup', field: 'default_equipment_markup', color: 'amber' },
              { label: 'Default Tax Rate', field: 'default_tax_rate', color: 'violet' },
            ].map(({ label, field, color }) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
                <div className="relative">
                  <input
                    id={`settings-${field}`}
                    type="number"
                    value={markupForm[field as keyof typeof markupForm]}
                    onChange={e => setMarkupForm(p => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    max="100"
                    step="0.5"
                    className={`${inputClass} pr-8`}
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${color === 'blue' ? 'text-blue-500' : color === 'emerald' ? 'text-emerald-500' : color === 'amber' ? 'text-amber-500' : 'text-violet-500'}`}>%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-xl p-4 mb-5 text-xs text-slate-500">
            <strong className="text-slate-700">How this works:</strong> These rates are automatically copied into every new project you create. You can always override them per-project in the Estimator Workspace.
          </div>

          <div className="flex justify-end">
            <button
              id="save-markup-btn"
              onClick={handleSaveMarkup}
              disabled={savingMarkup}
              className="flex items-center gap-2 px-5 py-2.5 bg-copper hover:bg-copper-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-copper-200/50 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingMarkup ? 'Saving...' : 'Save Defaults'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
