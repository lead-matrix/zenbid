import { useState, useRef, useEffect } from 'react';
import { Building2, Mail, Phone, Save, Upload, Percent, Moon, Sun, Bell, CreditCard } from 'lucide-react';
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

  // Dark Mode State & Handler
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
  });

  const handleToggleDarkMode = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    toast.success(`${nextDark ? 'Dark' : 'Light'} mode enabled!`);
  };

  // Notification Preferences State & Handler
  const [notificationForm, setNotificationForm] = useState({
    email: profile?.notification_prefs?.email ?? true,
    in_app: profile?.notification_prefs?.in_app ?? true,
    digest: profile?.notification_prefs?.digest ?? false,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    await updateProfile({
      notification_prefs: notificationForm,
    });
    toast.success('Notification preferences saved!');
    setSavingNotifications(false);
  };

  // Financing Defaults State & Handler
  const [financingForm, setFinancingForm] = useState({
    apr: 9.99,
    term: 60,
    minAmount: 1000,
  });
  const [savingFinancing, setSavingFinancing] = useState(false);

  // Load financing defaults from localStorage
  useEffect(() => {
    if (profile?.id) {
      const stored = localStorage.getItem(`financing_defaults_${profile.id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setFinancingForm({
            apr: parsed.apr ?? 9.99,
            term: parsed.term ?? 60,
            minAmount: parsed.minAmount ?? 1000,
          });
        } catch (e) {
          console.error('Failed to parse stored financing defaults', e);
        }
      }
    }
  }, [profile?.id]);

  const handleSaveFinancing = async () => {
    if (!profile?.id) return;
    setSavingFinancing(true);
    localStorage.setItem(`financing_defaults_${profile.id}`, JSON.stringify(financingForm));
    toast.success('Financing defaults saved!');
    setSavingFinancing(false);
  };

  // Sync profile data when profile updates
  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        company_name: profile.company_name || '',
        company_email: profile.company_email || '',
        company_phone: profile.company_phone || '',
      });
      setMarkupForm({
        default_labor_markup: profile.default_labor_markup ?? 30,
        default_material_markup: profile.default_material_markup ?? 18,
        default_equipment_markup: profile.default_equipment_markup ?? 12,
        default_tax_rate: profile.default_tax_rate ?? 8,
      });
      setNotificationForm({
        email: profile.notification_prefs?.email ?? true,
        in_app: profile.notification_prefs?.in_app ?? true,
        digest: profile.notification_prefs?.digest ?? false,
      });
      setLogoUrl(profile.company_logo || '');
    }
  }, [profile]);

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

  const inputClass = 'w-full px-4 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm text-text-primary dark:text-text-darkPrimary placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all';

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto animate-fade-in space-y-6 font-inter select-none">
      <div>
        <h1 className="text-2xl sm:text-3xl font-sora font-extrabold text-text-primary dark:text-text-darkPrimary">Settings</h1>
        <p className="text-text-secondary dark:text-text-darkSecondary text-sm mt-0.5">Manage your company profile and defaults</p>
      </div>

      {/* Company Profile */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-app-border dark:border-navy-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-text-primary dark:text-text-darkPrimary" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-sora font-bold text-text-primary dark:text-text-darkPrimary">Company Profile</h2>
              <p className="text-xs text-text-secondary dark:text-text-darkSecondary font-medium">Shown on all proposals and PDFs</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Logo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-2">Company Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-navy-950">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-700" />
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
                  className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 text-text-secondary dark:text-text-darkSecondary rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-900 transition-all shadow-sm disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
                <p className="text-[11px] text-text-secondary dark:text-text-darkSecondary mt-1.5 font-medium">PNG, JPG, SVG up to 2MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Your Name</label>
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
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Company Name</label>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">
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

          <div className="flex justify-end pt-2 border-t border-app-border dark:border-navy-800">
            <button
              id="save-profile-btn"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="flex items-center gap-2 px-5 py-3 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white rounded-xl font-bold text-sm transition-all shadow-md active:translate-y-0 hover:-translate-y-0.5 disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* Default Markups */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-app-border dark:border-navy-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg flex items-center justify-center">
              <Percent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-sora font-bold text-text-primary dark:text-text-darkPrimary">Default Markup Rates</h2>
              <p className="text-xs text-text-secondary dark:text-text-darkSecondary font-medium">Pre-filled into every new project</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {[
              { label: 'Labor Markup', field: 'default_labor_markup', color: 'blue' },
              { label: 'Material Markup', field: 'default_material_markup', color: 'emerald' },
              { label: 'Equipment Markup', field: 'default_equipment_markup', color: 'amber' },
              { label: 'Default Tax Rate', field: 'default_tax_rate', color: 'violet' },
            ].map(({ label, field }) => (
              <div key={field}>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">{label}</label>
                <div className="relative">
                  <input
                    id={`settings-${field}`}
                    type="number"
                    value={markupForm[field as keyof typeof markupForm]}
                    onChange={e => setMarkupForm(p => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    max="100"
                    step="0.5"
                    className={`${inputClass} pr-10`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-copper">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 mb-6 text-xs text-text-secondary dark:text-text-darkSecondary border border-app-border dark:border-navy-800">
            <strong className="text-text-primary dark:text-text-darkPrimary font-bold block mb-1">How this works:</strong> These rates are automatically copied into every new project you create. You can always override them per-project in the Estimator Workspace.
          </div>

          <div className="flex justify-end pt-2 border-t border-app-border dark:border-navy-800">
            <button
              id="save-markup-btn"
              onClick={handleSaveMarkup}
              disabled={savingMarkup}
              className="flex items-center gap-2 px-5 py-3 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white rounded-xl font-bold text-sm transition-all shadow-md active:translate-y-0 hover:-translate-y-0.5 disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              <Save className="w-4 h-4" />
              {savingMarkup ? 'Saving...' : 'Save Defaults'}
            </button>
          </div>
        </div>
      </div>

      {/* Theme Appearance */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-app-border dark:border-navy-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-lg flex items-center justify-center">
              {isDark ? <Moon className="w-4 h-4 text-text-primary dark:text-text-darkPrimary" /> : <Sun className="w-4 h-4 text-text-primary dark:text-text-darkPrimary" />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-sora font-bold text-text-primary dark:text-text-darkPrimary">Theme Appearance</h2>
              <p className="text-xs text-text-secondary dark:text-text-darkSecondary font-medium">Switch between light and dark theme mode</p>
            </div>
          </div>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary">Dark Mode</span>
            <p className="text-xs text-text-secondary dark:text-text-darkSecondary mt-0.5">Toggle dark theme across the application dashboard</p>
          </div>
          <button
            id="toggle-dark-mode-btn"
            onClick={handleToggleDarkMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-copper focus:ring-offset-2 ${
              isDark ? 'bg-copper' : 'bg-slate-200 dark:bg-navy-950 border dark:border-navy-700'
            }`}
          >
            <span
              className={`${
                isDark ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-app-border dark:border-navy-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-sora font-bold text-text-primary dark:text-text-darkPrimary">Notifications</h2>
              <p className="text-xs text-text-secondary dark:text-text-darkSecondary font-medium">Manage how and when you receive updates</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <label className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary cursor-pointer select-none" htmlFor="notify-email">Email Notifications</label>
                <p className="text-xs text-text-secondary dark:text-text-darkSecondary mt-0.5">Receive proposal updates and comments via email</p>
              </div>
              <button
                id="notify-email"
                onClick={() => setNotificationForm(p => ({ ...p, email: !p.email }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-copper focus:ring-offset-2 ${
                  notificationForm.email ? 'bg-copper' : 'bg-slate-200 dark:bg-navy-950 border dark:border-navy-700'
                }`}
              >
                <span
                  className={`${
                    notificationForm.email ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
            </div>

            <div className="flex items-start justify-between">
              <div>
                <label className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary cursor-pointer select-none" htmlFor="notify-in-app">In-App Notifications</label>
                <p className="text-xs text-text-secondary dark:text-text-darkSecondary mt-0.5">Show notifications banner and badge inside the app</p>
              </div>
              <button
                id="notify-in-app"
                onClick={() => setNotificationForm(p => ({ ...p, in_app: !p.in_app }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-copper focus:ring-offset-2 ${
                  notificationForm.in_app ? 'bg-copper' : 'bg-slate-200 dark:bg-navy-950 border dark:border-navy-700'
                }`}
              >
                <span
                  className={`${
                    notificationForm.in_app ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
            </div>

            <div className="flex items-start justify-between">
              <div>
                <label className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary cursor-pointer select-none" htmlFor="notify-digest">Weekly Summary Digest</label>
                <p className="text-xs text-text-secondary dark:text-text-darkSecondary mt-0.5">Receive a weekly email summarizing your proposal conversion rate and sales pipeline</p>
              </div>
              <button
                id="notify-digest"
                onClick={() => setNotificationForm(p => ({ ...p, digest: !p.digest }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-copper focus:ring-offset-2 ${
                  notificationForm.digest ? 'bg-copper' : 'bg-slate-200 dark:bg-navy-950 border dark:border-navy-700'
                }`}
              >
                <span
                  className={`${
                    notificationForm.digest ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-app-border dark:border-navy-800">
            <button
              id="save-notifications-btn"
              onClick={handleSaveNotifications}
              disabled={savingNotifications}
              className="flex items-center gap-2 px-5 py-3 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white rounded-xl font-bold text-sm transition-all shadow-md active:translate-y-0 hover:-translate-y-0.5 disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              <Save className="w-4 h-4" />
              {savingNotifications ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>

      {/* Financing Defaults */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-app-border dark:border-navy-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-sora font-bold text-text-primary dark:text-text-darkPrimary">Financing Defaults</h2>
              <p className="text-xs text-text-secondary dark:text-text-darkSecondary font-medium">Set the default financing options presented to homeowners</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Default APR</label>
              <div className="relative">
                <input
                  id="settings-financing-apr"
                  type="number"
                  value={financingForm.apr}
                  onChange={e => setFinancingForm(p => ({ ...p, apr: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  max="100"
                  step="0.01"
                  className={`${inputClass} pr-10`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-copper">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Default Term (Months)</label>
              <input
                id="settings-financing-term"
                type="number"
                value={financingForm.term}
                onChange={e => setFinancingForm(p => ({ ...p, term: parseInt(e.target.value) || 0 }))}
                min="12"
                max="240"
                step="12"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Minimum Project Amount</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 dark:text-navy-400">$</span>
                <input
                  id="settings-financing-min"
                  type="number"
                  value={financingForm.minAmount}
                  onChange={e => setFinancingForm(p => ({ ...p, minAmount: parseInt(e.target.value) || 0 }))}
                  min="0"
                  className={`${inputClass} pl-8`}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 text-xs text-text-secondary dark:text-text-darkSecondary border border-app-border dark:border-navy-800">
            <strong className="text-text-primary dark:text-text-darkPrimary font-bold block mb-1">Contractor Financing Presentation:</strong> These defaults will calculate and show the estimated monthly low-rate financing payment at the bottom of the proposal totals and tier comparison blocks for projects matching or exceeding the minimum limit.
          </div>

          <div className="flex justify-end pt-2 border-t border-app-border dark:border-navy-800">
            <button
              id="save-financing-btn"
              onClick={handleSaveFinancing}
              disabled={savingFinancing}
              className="flex items-center gap-2 px-5 py-3 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white rounded-xl font-bold text-sm transition-all shadow-md active:translate-y-0 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
            >
              <Save className="w-4 h-4" />
              {savingFinancing ? 'Saving...' : 'Save Financing Defaults'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
