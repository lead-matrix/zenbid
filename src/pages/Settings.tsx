import { useState, useRef, useEffect } from 'react';
import { Building2, Mail, Phone, Save, Upload, Percent, Moon, Sun, Bell, Copy, CheckCircle2, Landmark, Send, ShieldCheck, ArrowRight, Zap, CreditCard } from 'lucide-react';
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

  // Wire Transfer state
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [wireRefCode, setWireRefCode] = useState('');
  const [submittingWire, setSubmittingWire] = useState(false);
  const [wireSubmitted, setWireSubmitted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise' | null>(null);

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

      {/* ── PeakEstimator Pro — Subscription & Wire Transfer ──────────────── */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-navy-700 shadow-card bg-gradient-to-br from-slate-900 via-navy-900 to-slate-950 relative">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-copper via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-copper/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-copper to-amber-500 flex items-center justify-center shadow-lg shadow-copper/30">
              <Landmark className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-sora font-bold text-white flex items-center gap-2">
                PeakEstimator Upgrades & Licensing
              </h2>
              <p className="text-xs text-white/50 font-medium mt-0.5">Select your plan and complete a bank wire transfer — activated within 1 business day</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Plan Selection */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-copper" />
              Select a Plan — Pay via Bank Wire Transfer
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pro plan */}
              <button
                id="select-plan-pro"
                onClick={() => {
                  setSelectedPlan('pro');
                  setWireRefCode('');
                  setWireSubmitted(false);
                }}
                className={`text-left bg-white/5 border rounded-xl p-5 flex flex-col justify-between transition-all hover:border-copper/50 ${
                  selectedPlan === 'pro' ? 'border-copper ring-1 ring-copper/30' : 'border-white/10'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-extrabold px-2.5 py-0.5 bg-copper/20 border border-copper/40 text-copper rounded-full uppercase tracking-wider">Pro</span>
                    <span className="text-base font-sora font-extrabold text-white">$49 <span className="text-xs text-white/60 font-medium">/ month</span></span>
                  </div>
                  <h4 className="text-sm font-bold text-white font-sora mt-2">PeakEstimator Pro Plan</h4>
                  <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                    Full AI estimator features, unlimited multi-tier G/B/B proposal tabs, PWA field cache support, and automated customer follow-ups.
                  </p>
                  <ul className="mt-3 space-y-1">
                    {['Unlimited proposals', 'AI scope assistant', 'Good/Better/Best tiers', 'Digital signatures', 'Follow-up automation'].map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-[11px] text-white/60">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  selectedPlan === 'pro' ? 'bg-copper text-white' : 'bg-white/10 text-white/70 hover:bg-copper/30 hover:text-white'
                }`}>
                  {selectedPlan === 'pro' ? <CheckCircle2 className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                  {selectedPlan === 'pro' ? 'Selected — Wire Details Below' : 'Select Pro Plan'}
                </div>
              </button>

              {/* Enterprise plan */}
              <button
                id="select-plan-enterprise"
                onClick={() => {
                  setSelectedPlan('enterprise');
                  setWireRefCode('');
                  setWireSubmitted(false);
                }}
                className={`text-left bg-white/5 border rounded-xl p-5 flex flex-col justify-between transition-all hover:border-amber-500/50 ${
                  selectedPlan === 'enterprise' ? 'border-amber-400 ring-1 ring-amber-400/30' : 'border-white/10'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-extrabold px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-full uppercase tracking-wider">Enterprise</span>
                    <span className="text-base font-sora font-extrabold text-white">$499 <span className="text-xs text-white/60 font-medium">setup + $199/mo</span></span>
                  </div>
                  <h4 className="text-sm font-bold text-white font-sora mt-2">PeakEstimator Enterprise Plan</h4>
                  <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                    White-glove onboarding, multi-user teams, custom branding, priority support, API access, and unlimited AI quotas.
                  </p>
                  <ul className="mt-3 space-y-1">
                    {['Everything in Pro', 'Multi-user teams', 'Custom branding', 'Priority support', 'API access & webhooks'].map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-[11px] text-white/60">
                        <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  selectedPlan === 'enterprise' ? 'bg-gradient-to-r from-amber-500 to-copper text-white' : 'bg-white/10 text-white/70 hover:bg-amber-500/20 hover:text-white'
                }`}>
                  {selectedPlan === 'enterprise' ? <CheckCircle2 className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  {selectedPlan === 'enterprise' ? 'Selected — Wire Details Below' : 'Select Enterprise Plan'}
                </div>
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
              <Landmark className="w-3.5 h-3.5 text-copper" />
              Bank Wire Transfer Details
            </h3>
          </div>

          {/* Plan Highlight */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Annual License', value: '$8,000 / year', sub: '≈ $667/mo' },
              { label: 'Proposal Credits', value: 'Unlimited', sub: 'No monthly caps' },
              { label: 'AI Scope Assists', value: 'Unlimited', sub: 'Powered by Gemini' },
            ].map(item => (
              <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">{item.label}</p>
                <p className="text-base font-sora font-extrabold text-white">{item.value}</p>
                <p className="text-[11px] text-copper mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>

          {/* Wire Transfer Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-copper" />
              Secure Wire Transfer Details
            </h3>
            <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/10 overflow-hidden">
              {[
                { label: 'Bank Name', value: 'First National Commerce Bank', field: 'bank' },
                { label: 'Account Name', value: 'PeakEstimator Technologies Inc.', field: 'acct_name' },
                { label: 'Account Number', value: '8821 0047 3390 1124', field: 'acct_num' },
                { label: 'Routing Number (ABA)', value: '021 000 089', field: 'routing' },
                { label: 'SWIFT / BIC', value: 'FNCBUS33XXX', field: 'swift' },
                { label: 'Reference / Memo', value: `PEAK-${(profile?.company_name || 'ORG').replace(/\s+/g, '').toUpperCase().slice(0, 8)}-PRO`, field: 'ref' },
              ].map(({ label, value, field }) => (
                <div key={field} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</p>
                    <p className="text-sm font-mono font-semibold text-white truncate mt-0.5">{value}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(value);
                      setCopiedField(field);
                      setTimeout(() => setCopiedField(null), 2000);
                      toast.success(`${label} copied!`);
                    }}
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-copper/20 border border-white/10 hover:border-copper/40 flex items-center justify-center transition-all"
                    title={`Copy ${label}`}
                  >
                    {copiedField === field
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      : <Copy className="w-3.5 h-3.5 text-white/50" />
                    }
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/30 mt-2 leading-relaxed">
              International transfers: include SWIFT code. Processing typically takes 1–3 business days. Your account will be activated within 24 hours of confirmed receipt.
            </p>
          </div>

          {/* Reference Code Submission */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            {wireSubmitted ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Wire Transfer Submitted!</p>
                  <p className="text-xs text-white/50 mt-1">Our team will verify your payment and activate your Pro account within 1 business day.</p>
                </div>
              </div>
            ) : (
              <>
                <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-copper" />
                  Confirm Your Wire Transfer
                </h4>
                <p className="text-[11px] text-white/40 mb-4">After completing the wire transfer, enter your bank's confirmation / reference number below. Our team will verify and activate your account within 1 business day.</p>
                {!selectedPlan && (
                  <p className="text-[11px] text-amber-400/80 mb-3 flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3" /> Please select a plan above first.
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    id="wire-ref-input"
                    type="text"
                    value={wireRefCode}
                    onChange={e => setWireRefCode(e.target.value)}
                    placeholder="e.g. TXN-20260522-00847291"
                    disabled={!selectedPlan}
                    className="flex-1 px-3.5 py-2.5 bg-white/10 border border-white/15 rounded-xl text-sm font-mono text-white placeholder-white/25 focus:border-copper focus:outline-none focus:ring-1 focus:ring-copper/40 transition-all disabled:opacity-40"
                  />
                  <button
                    id="wire-submit-btn"
                    disabled={!wireRefCode.trim() || submittingWire || !selectedPlan}
                    onClick={async () => {
                      if (!wireRefCode.trim() || !selectedPlan) return;
                      setSubmittingWire(true);
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          await supabase.from('subscriptions').upsert({
                            organization_id: (profile as any)?.organization_id,
                            plan: selectedPlan,
                            status: 'pending_wire',
                            wire_reference: wireRefCode.trim(),
                            wire_submitted_at: new Date().toISOString(),
                          }, { onConflict: 'organization_id' });
                        }
                        setWireSubmitted(true);
                        toast.success('Wire reference submitted! We\'ll activate your account shortly.');
                      } catch {
                        toast.error('Submission failed. Please email billing@peakestimator.com with your reference.');
                      }
                      setSubmittingWire(false);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {submittingWire ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Submit
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer note */}
          <div className="flex items-start gap-2.5 text-[11px] text-white/30 leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 text-copper/60 flex-shrink-0 mt-0.5" />
            <span>Questions? Contact <span className="text-copper/80 font-semibold">billing@peakestimator.com</span> — our team responds within 4 business hours.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
