import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../api/supabase';
import { useEventBus } from '../hooks/useEventBus';
import {
  ShieldAlert, UserCheck, Trash2, Mail, Plus, Users, Search,
  Building2, Zap, Heart, AlertCircle, Clock, Check, FileText,
  Star, MessageSquare, Send, Eye, RefreshCw, Shield, HelpCircle,
  Laptop, Smartphone, ArrowRight, UserPlus, Flag, Bot, Bell,
  LayoutTemplate, ScrollText, CreditCard, ToggleLeft, ToggleRight,
  Pencil, Save, X, ChevronRight, Activity, Database, TrendingUp,
  DollarSign, Percent, Timer, Package, CircleCheck, CircleX, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { campaignManager, DEFAULT_FOLLOW_UP_RULES, type FollowUpRule } from '../lib/followUpCampaigns';
import type {
  Profile, SupportTicket, TicketResponse, IntegrationRequest, EmailLog,
  FeatureFlag, AIUsageLimit, AuditLog, Template, TemplateItem, Subscription
} from '../types';

interface WaitlistItem {
  id: string;
  email: string;
  name: string | null;
  trade: string | null;
  company: string | null;
  created_at: string;
}

type AdminTab = 'members' | 'crm' | 'integrations' | 'support' | 'email_sandbox' | 'waitlist' | 'feature_flags' | 'ai_settings' | 'automation' | 'templates' | 'audit_logs' | 'system_logs';

export default function AdminPortal() {
  const { triggerEvent } = useEventBus();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<AdminTab>('members');
  
  // Data lists
  const [members, setMembers] = useState<Profile[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
  const [integrationRequests, setIntegrationRequests] = useState<IntegrationRequest[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected details
  const [selectedCrmUser, setSelectedCrmUser] = useState<Profile | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketResponses, setTicketResponses] = useState<TicketResponse[]>([]);
  const [userActivity, setUserActivity] = useState<any[]>([]);

  // Form states
  const [adminNotes, setAdminNotes] = useState('');
  const [successManager, setSuccessManager] = useState('');
  const [crmTagInput, setCrmTagInput] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [isInternalResponse, setIsInternalResponse] = useState(false);
  const [sendingResponse, setSendingResponse] = useState(false);
  const [updatingTicket, setUpdatingTicket] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteCompany, setInviteCompany] = useState('');
  const [inviting, setInviting] = useState(false);

  // Email Sandbox States
  const [selectedEmailType, setSelectedEmailType] = useState<string>('welcome');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // ── Enterprise Tab State ────────────────────────────────────────────────────

  // Feature Flags
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);

  // AI Settings
  const [aiUsage, setAiUsage] = useState<AIUsageLimit | null>(null);
  const [aiUsageLogs, setAiUsageLogs] = useState<any[]>([]);
  const [aiSettingsLoading, setAiSettingsLoading] = useState(false);
  const [editingAiLimit, setEditingAiLimit] = useState(false);
  const [newMonthlyLimit, setNewMonthlyLimit] = useState('');
  const [newRpmLimit, setNewRpmLimit] = useState('');

  // Automation / Campaigns
  const [campaignRules, setCampaignRules] = useState<FollowUpRule[]>([...DEFAULT_FOLLOW_UP_RULES]);
  const [editingRule, setEditingRule] = useState<FollowUpRule | null>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [editingFinancing, setEditingFinancing] = useState(false);
  const [finForm, setFinForm] = useState({ rate: '9.99', maxTerm: '120', minAmount: '1000', enabled: true });

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', trade: 'general' as string });

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PAGE_SIZE = 25;

  // System / Subscriptions
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageStats, setUsageStats] = useState<any[]>([]);
  const [sysLoading, setSysLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      fetchTicketResponses(selectedTicket.id);
      
      // Collision prevention tag: simulate admin active channel subscription
      const channel = supabase
        .channel(`admin_view:${selectedTicket.id}`)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedTicket]);

  useEffect(() => {
    if (selectedCrmUser) {
      fetchUserActivity(selectedCrmUser.id);
      setAdminNotes(selectedCrmUser.concierge_details?.admin_notes || '');
      setSuccessManager(selectedCrmUser.assigned_success_manager || '');
    }
  }, [selectedCrmUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Waitlist
      const { data: waitData } = await supabase.from('waitlist').select('*').order('created_at', { ascending: false });
      if (waitData) setWaitlist(waitData);

      // 2. Fetch Members (Profiles)
      const { data: memData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (memData) setMembers(memData as Profile[]);

      // 3. Fetch Integration Requests
      const { data: intData } = await supabase.from('integration_requests').select('*').order('created_at', { ascending: false });
      if (intData) setIntegrationRequests(intData as IntegrationRequest[]);

      // 4. Fetch Support Tickets
      const { data: supData } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
      if (supData) setSupportTickets(supData as SupportTicket[]);

      // 5. Fetch Email Logs
      const { data: emData } = await supabase.from('email_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (emData) setEmailLogs(emData as EmailLog[]);
      
    } catch (e) {
      console.error('Error fetching admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Enterprise Data Fetchers ──────────────────────────────────────────────

  const fetchFeatureFlags = useCallback(async () => {
    setFlagsLoading(true);
    try {
      const { data } = await supabase
        .from('feature_flags')
        .select('*')
        .order('name', { ascending: true });
      if (data) setFeatureFlags(data as FeatureFlag[]);
    } catch (e) {
      console.error('Failed to load feature flags', e);
    } finally {
      setFlagsLoading(false);
    }
  }, []);

  const fetchAiSettings = useCallback(async () => {
    setAiSettingsLoading(true);
    try {
      const [limitsRes, logsRes] = await Promise.all([
        supabase.from('ai_usage_limits').select('*').single(),
        supabase.from('ai_usage_logs').select('*').order('created_at', { ascending: false }).limit(30)
      ]);
      if (limitsRes.data) {
        setAiUsage(limitsRes.data as AIUsageLimit);
        setNewMonthlyLimit(String(limitsRes.data.monthly_limit_cents));
        setNewRpmLimit(String(limitsRes.data.max_requests_per_minute));
      }
      if (logsRes.data) setAiUsageLogs(logsRes.data);
    } catch (e) {
      console.error('Failed to load AI settings', e);
    } finally {
      setAiSettingsLoading(false);
    }
  }, []);

  const fetchSystemSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from('system_settings').select('*').single();
      if (data) {
        setSystemSettings(data);
        setFinForm({
          rate: String(data.financing_interest_rate),
          maxTerm: String(data.financing_max_term_months),
          minAmount: String(data.financing_min_amount),
          enabled: data.financing_enabled
        });
      }
    } catch (e) {
      console.error('Failed to load system settings', e);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .order('trade', { ascending: true });
      if (data) setTemplates(data as Template[]);
    } catch (e) {
      console.error('Failed to load templates', e);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchTemplateItems = useCallback(async (templateId: string) => {
    const { data } = await supabase
      .from('template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });
    if (data) setTemplateItems(data as TemplateItem[]);
  }, []);

  const fetchAuditLogs = useCallback(async (page = 1) => {
    setAuditLogsLoading(true);
    try {
      const from = (page - 1) * AUDIT_PAGE_SIZE;
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + AUDIT_PAGE_SIZE - 1);
      if (data) setAuditLogs(data as AuditLog[]);
    } catch (e) {
      console.error('Failed to load audit logs', e);
    } finally {
      setAuditLogsLoading(false);
    }
  }, []);

  const fetchSystemLogs = useCallback(async () => {
    setSysLoading(true);
    try {
      const [subRes, usageRes] = await Promise.all([
        supabase.from('subscriptions').select('*').single(),
        supabase.from('usage_tracking').select('*').order('billing_period_start', { ascending: false })
      ]);
      if (subRes.data) setSubscription(subRes.data as Subscription);
      if (usageRes.data) setUsageStats(usageRes.data);
    } catch (e) {
      console.error('Failed to load system logs', e);
    } finally {
      setSysLoading(false);
    }
  }, []);

  const fetchTicketResponses = async (ticketId: string) => {
    const { data, error } = await supabase
      .from('ticket_responses')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setTicketResponses(data as TicketResponse[]);
    }
  };

  const fetchUserActivity = async (userId: string) => {
    const { data } = await supabase
      .from('activity_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) {
      setUserActivity(data);
    }
  };

  const handleUpdateCrmUser = async () => {
    if (!selectedCrmUser) return;
    try {
      const details = {
        ...selectedCrmUser.concierge_details,
        admin_notes: adminNotes
      };
      
      const { error } = await supabase
        .from('profiles')
        .update({
          assigned_success_manager: successManager,
          concierge_details: details
        })
        .eq('id', selectedCrmUser.id);

      if (error) throw error;
      
      toast.success('Customer Intelligence workspace updated!');
      fetchData();
    } catch (err: any) {
      toast.error('Update failed: ' + err.message);
    }
  };

  const handleToggleTag = async (tag: string) => {
    if (!selectedCrmUser) return;
    const currentTags = selectedCrmUser.customer_tags || [];
    const updatedTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ customer_tags: updatedTags })
        .eq('id', selectedCrmUser.id);

      if (error) throw error;
      setSelectedCrmUser(prev => prev ? { ...prev, customer_tags: updatedTags } : null);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update tags');
    }
  };

  const handleAddCustomTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crmTagInput.trim() || !selectedCrmUser) return;
    const currentTags = selectedCrmUser.customer_tags || [];
    if (currentTags.includes(crmTagInput.trim())) return;
    
    const updatedTags = [...currentTags, crmTagInput.trim()];
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ customer_tags: updatedTags })
        .eq('id', selectedCrmUser.id);

      if (error) throw error;
      setSelectedCrmUser(prev => prev ? { ...prev, customer_tags: updatedTags } : null);
      setCrmTagInput('');
      fetchData();
      toast.success(`Tag "${crmTagInput.trim()}" appended`);
    } catch (e) {
      toast.error('Failed to add custom tag');
    }
  };

  const handleUpdateTicketStatus = async (status: 'open' | 'in progress' | 'resolved' | 'closed') => {
    if (!selectedTicket) return;
    setUpdatingTicket(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

      if (error) throw error;
      
      setSelectedTicket(prev => prev ? { ...prev, status } : null);
      
      // Event Bus
      await triggerEvent({
        entityType: 'support',
        entityId: selectedTicket.id,
        actionType: 'status_changed',
        title: 'Support Incident Status Updated',
        description: `Ticket status set to ${status.toUpperCase()} by Superadmin.`,
        sendNotification: true,
        notificationType: 'support'
      });

      toast.success(`Ticket set to ${status}`);
      fetchData();
    } catch (err: any) {
      toast.error('Status update failed');
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleSendTicketResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResponse.trim() || !selectedTicket) return;

    setSendingResponse(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user session');

      const { error } = await supabase
        .from('ticket_responses')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: newResponse,
          is_internal: isInternalResponse
        });

      if (error) throw error;

      // Update ticket timing
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString(), status: 'in progress' })
        .eq('id', selectedTicket.id);

      // Event Bus
      await triggerEvent({
        entityType: 'support',
        entityId: selectedTicket.id,
        actionType: 'replied',
        title: isInternalResponse ? 'Internal Admin Comment Added' : 'Admin Support Reply Sent',
        description: isInternalResponse 
          ? `Internal memo recorded on Ticket #${selectedTicket.id.slice(0, 5)}.`
          : `Admin reply posted on Ticket #${selectedTicket.id.slice(0, 5)}.`,
        sendNotification: !isInternalResponse,
        notificationType: 'support'
      });

      setNewResponse('');
      fetchTicketResponses(selectedTicket.id);
      fetchData();
      toast.success(isInternalResponse ? 'Internal memo saved' : 'Reply dispatched successfully');
    } catch (err: any) {
      toast.error('Reply dispatch failed');
    } finally {
      setSendingResponse(false);
    }
  };

  const handleUpdateIntegrationStatus = async (reqId: string, status: any) => {
    try {
      const { error } = await supabase
        .from('integration_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', reqId);
      if (error) throw error;

      toast.success(`Integration status set to ${status}`);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update integration');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error("No active session");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'invite',
          email: inviteEmail.trim(),
          fullName: inviteName.trim(),
          companyName: inviteCompany.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite user");

      // Log to activity timeline
      await triggerEvent({
        entityType: 'member',
        actionType: 'invited',
        title: 'New Member Invitation Dispatched',
        description: `Secure signup credentials issued to recipient: ${inviteEmail}.`,
        sendNotification: true
      });

      toast.success(`Invitation sent to ${inviteEmail}!`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteCompany('');
      fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeAccess = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to permanently revoke access for ${email}?`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'delete', userId: id })
      });

      if (!res.ok) throw new Error("Failed to delete user");

      toast.success(`Access revoked for ${email}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleApproveWaitlist = async (item: WaitlistItem) => {
    setInviteEmail(item.email);
    setInviteName(item.name || '');
    setInviteCompany(item.company || '');
    setShowInviteModal(true);
  };

  const handleRemoveWaitlist = async (id: string) => {
    if (!confirm("Remove this entry from the waitlist?")) return;
    const { error } = await supabase.from('waitlist').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Waitlist entry removed");
      fetchData();
    }
  };

  // ── Enterprise Handlers ──────────────────────────────────────────────────

  const handleToggleFeatureFlag = async (flag: FeatureFlag) => {
    const newValue = !flag.enabled_globally;
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled_globally: newValue, updated_at: new Date().toISOString() })
        .eq('id', flag.id);
      if (error) throw error;
      setFeatureFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled_globally: newValue } : f));
      toast.success(`"${flag.name}" ${newValue ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast.error('Toggle failed: ' + err.message);
    }
  };

  const handleSaveAiLimits = async () => {
    if (!aiUsage) return;
    try {
      const { error } = await supabase
        .from('ai_usage_limits')
        .update({
          monthly_limit_cents: parseInt(newMonthlyLimit, 10),
          max_requests_per_minute: parseInt(newRpmLimit, 10),
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', aiUsage.organization_id);
      if (error) throw error;
      setAiUsage(prev => prev ? { ...prev, monthly_limit_cents: parseInt(newMonthlyLimit, 10), max_requests_per_minute: parseInt(newRpmLimit, 10) } : null);
      setEditingAiLimit(false);
      toast.success('AI usage limits updated');
    } catch (err: any) {
      toast.error('Update failed: ' + err.message);
    }
  };

  const handleSaveCampaignRule = async () => {
    if (!editingRule) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();
    const orgId = profile?.organization_id || '';
    const updatedRules = campaignRules.map(r => r.id === editingRule.id ? editingRule : r);
    campaignManager.updateRules(orgId, updatedRules);
    setCampaignRules(updatedRules);
    setEditingRule(null);
    toast.success('Campaign rule updated');
  };

  const handleToggleCampaignRule = async (ruleId: string) => {
    const updated = campaignRules.map(r => r.id === ruleId ? { ...r, isActive: !r.isActive } : r);
    const { data: { session } } = await supabase.auth.getSession();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session?.user?.id!).single();
    const orgId = profile?.organization_id || '';
    campaignManager.updateRules(orgId, updated);
    setCampaignRules(updated);
    toast.success('Campaign rule toggled');
  };

  const handleSaveFinancingSettings = async () => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          financing_interest_rate: parseFloat(finForm.rate),
          financing_max_term_months: parseInt(finForm.maxTerm, 10),
          financing_min_amount: parseFloat(finForm.minAmount),
          financing_enabled: finForm.enabled,
          updated_at: new Date().toISOString()
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows
      if (error) throw error;
      setEditingFinancing(false);
      toast.success('Financing configuration saved');
      fetchSystemSettings();
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.name.trim()) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session?.user?.id!).single();
      const { error } = await supabase.from('templates').insert({
        name: newTemplate.name,
        description: newTemplate.description,
        trade: newTemplate.trade,
        organization_id: profile?.organization_id,
        is_global: false
      });
      if (error) throw error;
      setShowNewTemplateForm(false);
      setNewTemplate({ name: '', description: '', trade: 'general' });
      toast.success('Template created');
      fetchTemplates();
    } catch (err: any) {
      toast.error('Create failed: ' + err.message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Template deleted');
    setSelectedTemplate(null);
    setTemplateItems([]);
    fetchTemplates();
  };

  // Resend / SMTP Simulated send test preview
  const handleSendTestEmail = async () => {
    if (!testRecipient.trim()) {
      toast.error('Specify recipient email first');
      return;
    }
    setSendingTestEmail(true);
    
    // Select correct template details
    const tmpl = emailTemplates.find(t => t.id === selectedEmailType);
    if (!tmpl) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const trackingToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const { error } = await supabase
        .from('email_logs')
        .insert({
          user_id: user?.id || null,
          template_type: selectedEmailType,
          recipient_email: testRecipient.trim(),
          subject: tmpl.subject,
          delivery_status: 'sent',
          provider: 'smtp',
          provider_message_id: trackingToken,
          metadata: {
            'X-Resend-Sandbox': 'true',
            'SMTP-Server': 'peakestimator.top',
            'tracking_token': trackingToken
          }
        });

      if (error) throw error;
      
      toast.success(`Test email [${tmpl.title}] delivered successfully to ${testRecipient}!`, { duration: 4000 });
      fetchData();
    } catch (err: any) {
      toast.error('Simulation delivery error: ' + err.message);
    } finally {
      setSendingTestEmail(false);
    }
  };

  // 7 Responsive Transactional Templates Definition
  const emailTemplates = [
    {
      id: 'welcome',
      title: '1. Onboarding Welcome Guide',
      subject: 'Welcome to the Peak Contractor Operations Ecosystem!',
      plaintext: `Welcome! Let's get your contractor operations running at full velocity.
Your Next Steps:
1. Setup Company Identity Branding Profile.
2. Define Standard Labor & Material Profit Markups.
3. Import legacy trade price sheets.
Need custom integrations? Request Procore or CRM connections anytime inside your success tab.`,
      html: `
        <div style="background-color:#0F172A; padding:40px; font-family:sans-serif; color:#FFFFFF; border-radius:16px; max-width:600px; margin:0 auto;">
          <div style="text-align:center; border-bottom:1px solid #1E293B; padding-bottom:20px; margin-bottom:30px;">
            <h2 style="color:#C58B5C; margin:0; font-size:24px;">Peak<span style="color:#FFFFFF;">Estimator</span></h2>
            <p style="color:#94A3B8; font-size:10px; text-transform:uppercase; letter-spacing:2px; margin-top:5px;">Contractor Operations</p>
          </div>
          <h3 style="font-size:20px; margin-bottom:15px; color:#C58B5C;">Onboarding Started!</h3>
          <p style="font-size:13px; line-height:1.6; color:#CBD5E1;">
            Welcome. Your account has been registered. You have officially upgraded from a normal estimation tool into an elite operations ecosystem.
          </p>
          <div style="background-color:#1E293B; padding:20px; border-radius:12px; margin:25px 0;">
            <h4 style="margin:0 0 10px 0; font-size:12px; text-transform:uppercase; color:#94A3B8; letter-spacing:1px;">First-Login Setup Checklist</h4>
            <ul style="margin:0; padding-left:15px; font-size:12px; color:#E2E8F0; line-height:1.8;">
              <li>Configure professional company branding in settings.</li>
              <li>Setup default labor, material, and tax markup variables.</li>
              <li>Initialize trade price sheet books.</li>
            </ul>
          </div>
          <div style="text-align:center; margin-top:35px;">
            <a href="https://peakestimator.top/dashboard" style="background-color:#C58B5C; color:#FFFFFF; text-decoration:none; padding:12px 30px; font-weight:bold; font-size:12px; border-radius:8px; display:inline-block;">Launch Command Center</a>
          </div>
          <div style="border-top:1px solid #1E293B; margin-top:40px; pt-20px; text-align:center; font-size:10px; color:#64748B;">
            PeakEstimator Enterprise • peakestimator.top
          </div>
        </div>
      `
    },
    {
      id: 'invite',
      title: '2. Seat Invite & Magic Link',
      subject: 'You have been invited to join PeakEstimator Operations',
      plaintext: `An administrator has invited you to join their contractor operations portal.
Click below to accept your invitation and configure your seat settings:
https://peakestimator.top/signup`,
      html: `
        <div style="background-color:#0F172A; padding:40px; font-family:sans-serif; color:#FFFFFF; border-radius:16px; max-width:600px; margin:0 auto;">
          <div style="text-align:center; border-bottom:1px solid #1E293B; padding-bottom:20px; margin-bottom:30px;">
            <h2 style="color:#C58B5C; margin:0;">Peak<span style="color:#FFFFFF;">Estimator</span></h2>
          </div>
          <h3 style="font-size:18px; margin-bottom:15px; color:#C58B5C;">Team Registration Invitation</h3>
          <p style="font-size:13px; line-height:1.6; color:#CBD5E1;">
            You have been assigned a certified operational seat in PeakEstimator. Set up your login credentials to gain full access to projects, estimators, and price sheets.
          </p>
          <div style="text-align:center; margin:35px 0;">
            <a href="https://peakestimator.top/signup" style="background-color:#C58B5C; color:#FFFFFF; text-decoration:none; padding:12px 30px; font-weight:bold; font-size:12px; border-radius:8px; display:inline-block;">Configure Contractor Account</a>
          </div>
          <p style="font-size:10px; color:#64748B; text-align:center;">
            If you did not request this invite, please contact superadmin support.
          </p>
        </div>
      `
    },
    {
      id: 'prospect',
      title: '3. Proposal Created (Client Ready)',
      subject: 'Project Proposal Ready for Review: [Project Name]',
      plaintext: `A new project estimate proposal is ready for your review.
Project: [Project Name]
Review details, check pricing, and securely sign to approve this proposal directly inside your browser:
https://peakestimator.top/approve/share-token`,
      html: `
        <div style="background-color:#0F172A; padding:40px; font-family:sans-serif; color:#FFFFFF; border-radius:16px; max-width:600px; margin:0 auto;">
          <div style="text-align:center; border-bottom:1px solid #1E293B; padding-bottom:20px; margin-bottom:30px;">
            <h2 style="color:#C58B5C; margin:0;">Peak<span style="color:#FFFFFF;">Estimator</span></h2>
          </div>
          <h3 style="font-size:18px; margin-bottom:10px; color:#C58B5C;">Project Proposal Ready</h3>
          <p style="font-size:13px; color:#CBD5E1; line-height:1.6;">
            A new project proposal has been constructed and is ready for your review and digital signature authorization.
          </p>
          <div style="background-color:#1E293B; padding:15px; border-radius:8px; margin:20px 0; font-size:12px;">
            <div style="color:#94A3B8; margin-bottom:5px;">Project Title: <strong style="color:#FFFFFF;">Highland Renovation</strong></div>
            <div style="color:#94A3B8;">Pricing Estimate: <strong style="color:#C58B5C;">$24,500.00</strong></div>
          </div>
          <div style="text-align:center; margin:30px 0;">
            <a href="https://peakestimator.top/approve/share-token" style="background-color:#10B981; color:#FFFFFF; text-decoration:none; padding:12px 30px; font-weight:bold; font-size:12px; border-radius:8px; display:inline-block;">Review & Approve Proposal</a>
          </div>
        </div>
      `
    },
    {
      id: 'approved',
      title: '4. Proposal Approved (Signature Captured)',
      subject: 'Proposal Approved & Signed: [Project Name]',
      plaintext: `Great news! Your project proposal for [Project Name] has been signed and approved by the client.
Signee: [Client Name]
Details have been synced into your Command Center dashboard under "Approved".`,
      html: `
        <div style="background-color:#0F172A; padding:40px; font-family:sans-serif; color:#FFFFFF; border-radius:16px; max-width:600px; margin:0 auto;">
          <div style="text-align:center; border-bottom:1px solid #1E293B; padding-bottom:20px; margin-bottom:30px;">
            <h2 style="color:#C58B5C; margin:0;">Peak<span style="color:#FFFFFF;">Estimator</span></h2>
          </div>
          <h3 style="font-size:18px; color:#10B981; margin-bottom:15px;">Proposal Approved! 🎉</h3>
          <p style="font-size:13px; color:#CBD5E1; line-height:1.6;">
            The project proposal for <strong>Highland Renovation</strong> has been signed, authorized, and approved by the client.
          </p>
          <div style="background-color:#1E293B; padding:15px; border-radius:8px; margin:20px 0; font-size:12px;">
            <div style="color:#94A3B8; margin-bottom:5px;">Client Signee: <strong style="color:#FFFFFF;">Alice Cooper</strong></div>
            <div style="color:#94A3B8;">Contract value: <strong style="color:#10B981;">$24,500.00</strong></div>
          </div>
          <p style="font-size:11px; color:#94A3B8;">The contract has been locked and signature captured. Launch settings or projects page to review complete details.</p>
        </div>
      `
    },
    {
      id: 'feature_received',
      title: '5. Custom Integration Request Received',
      subject: 'Custom Integration Request Received: [Type]',
      plaintext: `We have received your custom workflow integration request!
Our moated success team is evaluating your business needs and current tools.
Standard review takes 24 hours.`,
      html: `
        <div style="background-color:#0F172A; padding:40px; font-family:sans-serif; color:#FFFFFF; border-radius:16px; max-width:600px; margin:0 auto;">
          <div style="text-align:center; border-bottom:1px solid #1E293B; padding-bottom:20px; margin-bottom:30px;">
            <h2 style="color:#C58B5C; margin:0;">Peak<span style="color:#FFFFFF;">Estimator</span></h2>
          </div>
          <h3 style="font-size:18px; color:#C58B5C; margin-bottom:15px;">Integration Request Logged</h3>
          <p style="font-size:13px; color:#CBD5E1; line-height:1.6;">
            We have registered your request for custom workflow linkages. Our core team is analyzing the spreadsheet files or CRM parameters to set up white-glove migration models.
          </p>
          <div style="border-left:3px solid #C58B5C; padding-left:15px; margin:20px 0; font-size:12px; color:#CBD5E1;">
            Our support engineers are analyzing your request. Average review takes under 24 hours.
          </div>
        </div>
      `
    },
    {
      id: 'ticket_received',
      title: '6. Support Ticket Opened (SLA Confirmation)',
      subject: 'Support Incident Logged - Ticket ID #[ID]',
      plaintext: `Your support incident has been logged.
Priority: [Priority]
Our engineers will review and respond according to your SLA time commitment.`,
      html: `
        <div style="background-color:#0F172A; padding:40px; font-family:sans-serif; color:#FFFFFF; border-radius:16px; max-width:600px; margin:0 auto;">
          <div style="text-align:center; border-bottom:1px solid #1E293B; padding-bottom:20px; margin-bottom:30px;">
            <h2 style="color:#C58B5C; margin:0;">Peak<span style="color:#FFFFFF;">Estimator</span></h2>
          </div>
          <h3 style="font-size:18px; color:#C58B5C; margin-bottom:15px;">Support Case Registered</h3>
          <p style="font-size:13px; color:#CBD5E1; line-height:1.6;">
            A new support ticket has been registered in the system queue. You can track resolution status and converse directly with your success manager inside your Support Center.
          </p>
          <div style="background-color:#1E293B; padding:15px; border-radius:8px; margin:20px 0; font-size:12px;">
            <div>Urgency Level: <strong style="color:#FFFFFF;">HIGH</strong></div>
            <div style="margin-top:5px;">SLA Response window: <strong style="color:#C58B5C;">8 Hours Response Time</strong></div>
          </div>
        </div>
      `
    },
    {
      id: 'sla_breach',
      title: '7. SLA Breach Escalation Notice',
      subject: 'CRITICAL ALERT: Support Incident SLA Target Approaching',
      plaintext: `ALERT: Support Ticket #[ID] is approaching its SLA response window.
Priority: Urgent
Please assign an administrator immediately to prevent collision and address.`,
      html: `
        <div style="background-color:#EF4444; padding:4px; border-radius:16px; max-width:600px; margin:0 auto;">
          <div style="background-color:#0F172A; padding:36px; font-family:sans-serif; color:#FFFFFF; border-radius:12px;">
            <h3 style="color:#EF4444; margin-top:0; font-size:20px;">SLA Alert Limit Approaching</h3>
            <p style="font-size:13px; color:#CBD5E1; line-height:1.6;">
              Support incident <strong>Case #4928A</strong> is approaching its SLA response threshold. Urgent action required by the operations team to address client bottlenecks.
            </p>
            <div style="background-color:#1E293B; padding:15px; border-radius:8px; margin:20px 0; font-size:12px;">
              <div>Client Incident Ref: <strong style="color:#FFFFFF;">Price List Load Blocked</strong></div>
              <div style="margin-top:5px; color:#EF4444;">Time Remaining: <strong>25 Minutes</strong></div>
            </div>
            <div style="text-align:center; margin-top:25px;">
              <a href="https://peakestimator.top/admin" style="background-color:#EF4444; color:#FFFFFF; text-decoration:none; padding:12px 30px; font-weight:bold; font-size:12px; border-radius:8px; display:inline-block;">Open Admin Portal</a>
            </div>
          </div>
        </div>
      `
    }
  ];

  // Filtering lists based on search string
  const filteredMembers = members.filter(m =>
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    (m.full_name && m.full_name.toLowerCase().includes(search.toLowerCase())) ||
    (m.company_name && m.company_name.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredWaitlist = waitlist.filter(w =>
    w.email.toLowerCase().includes(search.toLowerCase()) ||
    (w.name && w.name.toLowerCase().includes(search.toLowerCase())) ||
    (w.company && w.company.toLowerCase().includes(search.toLowerCase())) ||
    (w.trade && w.trade.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredIntegrations = integrationRequests.filter(r =>
    r.business_need.toLowerCase().includes(search.toLowerCase()) ||
    (r.current_tool && r.current_tool.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredTickets = supportTickets.filter(t =>
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.message.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  const activeEmailTemplate = emailTemplates.find(t => t.id === selectedEmailType) || emailTemplates[0];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto font-inter select-none animate-fade-in relative min-h-screen pb-16">
      
      {/* Superadmin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-sora font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            Admin Management
            <span className="text-[10px] font-bold bg-rose-500 text-white px-2.5 py-1 rounded-full uppercase tracking-wider">
              Superadmin
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Control seats, manage integration pipelines, resolve tickets, and preview emails.</p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-copper hover:bg-copper-hover active:bg-copper-600 text-white font-bold text-sm px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all w-full md:w-auto"
        >
          <UserPlus className="w-4 h-4" />
          Send Direct Invitation
        </button>
      </div>

      {/* Tabs — split into 2 rows: existing + enterprise */}
      <div className="mb-6 space-y-2">
        {/* Row 1: Core Ops */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mr-2">Ops</span>
          {[
            { id: 'members', label: 'Seat Manager', icon: Users },
            { id: 'crm', label: 'Customer CRM', icon: Star },
            { id: 'integrations', label: 'Integration Desk', icon: Zap },
            { id: 'support', label: 'Support Desk', icon: HelpCircle },
            { id: 'email_sandbox', label: 'Email Sandbox', icon: Mail },
            { id: 'waitlist', label: 'Waitlist Queue', icon: UserCheck }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as AdminTab); setSelectedCrmUser(null); setSelectedTicket(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-[11px] transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-100 dark:bg-navy-950 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-navy-800'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* Row 2: Enterprise Controls */}
        <div className="flex items-center gap-1 flex-wrap border-t border-slate-100 dark:border-navy-900 pt-2">
          <span className="text-[9px] font-bold text-copper/80 uppercase tracking-widest mr-2">Enterprise</span>
          {[
            { id: 'feature_flags', label: 'Feature Flags', icon: Flag },
            { id: 'ai_settings', label: 'AI Controls', icon: Bot },
            { id: 'automation', label: 'Automation', icon: Bell },
            { id: 'templates', label: 'Templates', icon: LayoutTemplate },
            { id: 'audit_logs', label: 'Audit Logs', icon: ScrollText },
            { id: 'system_logs', label: 'System & Billing', icon: CreditCard }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as AdminTab);
                  setSelectedCrmUser(null);
                  setSelectedTicket(null);
                  if (tab.id === 'feature_flags') fetchFeatureFlags();
                  if (tab.id === 'ai_settings') fetchAiSettings();
                  if (tab.id === 'automation') fetchSystemSettings();
                  if (tab.id === 'templates') fetchTemplates();
                  if (tab.id === 'audit_logs') fetchAuditLogs(1);
                  if (tab.id === 'system_logs') fetchSystemLogs();
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-[11px] transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-copper/10 text-copper shadow-sm border border-copper/20'
                    : 'text-slate-400 hover:text-copper dark:hover:text-copper'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Search and Filter */}
      {activeTab !== 'email_sandbox' && (
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search within ${activeTab.toUpperCase()} items...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy border border-slate-200 dark:border-navy-850 rounded-xl text-xs focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
      )}

      {/* Render Workspace Content */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-copper border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'members' ? (
        /* TAB 1: MEMBERS */
        <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-950 border-b border-app-border dark:border-navy-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Member / Company</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Access Role</th>
                  <th className="py-4 px-6">Seat Registration</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border dark:divide-navy-800 text-xs text-slate-900 dark:text-white">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">No active contractor seats.</td>
                  </tr>
                ) : (
                  filteredMembers.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-950/40">
                      <td className="py-4 px-6">
                        <div className="font-bold">{m.full_name || '—'}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5" /> {m.company_name || 'No Branding Profile'}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold">{m.email}</td>
                      <td className="py-4 px-6">
                        {m.is_admin ? (
                          <span className="bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 px-2 py-0.5 border border-rose-100 dark:border-rose-900/30 rounded text-[9px] font-bold uppercase">Superadmin</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 dark:bg-navy-950 dark:text-slate-400 px-2 py-0.5 border border-slate-200 dark:border-navy-850 rounded text-[9px] font-bold uppercase">Contractor Seat</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-400 font-semibold">{new Date(m.created_at || '').toLocaleDateString()}</td>
                      <td className="py-4 px-6 text-right">
                        {!m.is_admin && (
                          <button
                            onClick={() => handleRevokeAccess(m.id, m.email)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                            title="Revoke access seat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'crm' ? (
        /* TAB 2: CUSTOMER SUCCESS CRM */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CRM Users List */}
          <div className="lg:col-span-4 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden max-h-[70vh] flex flex-col">
            <div className="px-5 py-4 border-b border-app-border dark:border-navy-800 bg-slate-50 dark:bg-navy-950/25 flex-shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Select Customer</span>
            </div>
            
            <div className="flex-1 overflow-y-auto divide-y divide-app-border dark:divide-navy-850 scrollbar-thin">
              {filteredMembers.map(m => (
                <div
                  key={m.id}
                  onClick={() => setSelectedCrmUser(m)}
                  className={`p-4 transition-colors cursor-pointer relative ${
                    selectedCrmUser?.id === m.id 
                      ? 'bg-slate-50 dark:bg-navy-950/40 border-l-2 border-copper' 
                      : 'hover:bg-slate-50/30 dark:hover:bg-navy-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs block">{m.full_name || m.email}</span>
                    <span className="text-[10px] font-extrabold text-copper">{m.health_score || 0} Health</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">{m.company_name || 'No Branding Complete'}</p>
                  
                  {m.customer_tags && m.customer_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {m.customer_tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-1.5 py-0.2 border border-copper/10 text-copper rounded bg-copper/5 text-[8px] font-bold uppercase">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Customer Intelligence Lifecycle Workspace */}
          <div className="lg:col-span-8">
            {selectedCrmUser ? (
              <div className="space-y-6">
                
                {/* Core Customer Info card */}
                <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-6 rounded-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 dark:border-navy-850 pb-4 mb-4">
                    <div>
                      <h3 className="font-sora font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">{selectedCrmUser.full_name || 'No Name Complete'}</h3>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{selectedCrmUser.email} • ID: {selectedCrmUser.id.slice(0, 8)}...</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Health Index</span>
                        <span className="text-xl font-sora font-extrabold text-emerald-500 mt-0.5 block">{selectedCrmUser.health_score || 0}/100</span>
                      </div>
                      <div className="w-10 h-10 rounded-full border border-emerald-500/25 bg-emerald-500/5 flex items-center justify-center text-emerald-500">
                        <Heart className="w-5 h-5 fill-current animate-pulse" />
                      </div>
                    </div>
                  </div>

                  {/* Operational Settings Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-inter text-xs mb-6">
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1.5">Assigned Success Manager</label>
                      <input
                        type="text"
                        value={successManager}
                        onChange={(e) => setSuccessManager(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1.5">Branding Configuration</label>
                      <div className="p-3 bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-900 rounded-xl">
                        <div className="font-semibold">Company: {selectedCrmUser.company_name || '—'}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Logo Status: {selectedCrmUser.company_logo ? 'Uploaded' : 'None'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Tags Multi-select */}
                  <div className="mb-6 font-inter text-xs">
                    <label className="block text-slate-500 dark:text-slate-400 font-bold mb-2">Customer Classification Tags</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {['Enterprise', 'Power User', 'Integration-Heavy', 'Churn Risk', 'Inactive', 'High Priority'].map(tag => {
                        const active = selectedCrmUser.customer_tags?.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => handleToggleTag(tag)}
                            className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase transition-all ${
                              active 
                                ? 'bg-copper text-white border-copper' 
                                : 'bg-transparent text-slate-400 border-slate-200 dark:border-navy-800 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>

                    <form onSubmit={handleAddCustomTag} className="flex gap-2 max-w-sm">
                      <input
                        type="text"
                        value={crmTagInput}
                        onChange={(e) => setCrmTagInput(e.target.value)}
                        placeholder="Append custom tag..."
                        className="flex-1 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                      />
                      <button type="submit" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-950 dark:hover:bg-navy-900 border border-slate-200 dark:border-navy-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold">
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Internal Administrative Notes */}
                  <div className="mb-6 font-inter text-xs">
                    <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1.5">Internal Administrative Notes (Strictly Protected)</label>
                    <textarea
                      rows={4}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add strategic account observations, legacy CRM preferences, white-glove migration specifications..."
                      className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <button
                    onClick={handleUpdateCrmUser}
                    className="px-5 py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    Save CRM Profile Updates
                  </button>
                </div>

                {/* Customer Lifecycle Event Logs */}
                <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-6 rounded-2xl">
                  <h3 className="text-xs sm:text-sm font-sora font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-copper" />
                    Customer Audited Activity Timeline
                  </h3>

                  {userActivity.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No activity recorded for this customer yet.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                      {userActivity.map((act, index) => (
                        <div key={act.id || index} className="flex gap-3 relative pl-3.5 pb-2">
                          {index < userActivity.length - 1 && (
                            <div className="absolute left-[20px] top-6 bottom-0 w-0.5 bg-slate-100 dark:bg-navy-850" />
                          )}
                          <div className="absolute left-[13px] top-1.5 w-4 h-4 rounded-full bg-slate-50 dark:bg-navy-950 border-2 border-copper flex items-center justify-center flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-copper" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-slate-800 dark:text-white block">
                                {act.metadata?.title || `${act.entity_type} ${act.action_type}`}
                              </span>
                              <span className="text-[8px] font-semibold text-slate-400">
                                {new Date(act.created_at).toLocaleDateString()} at {new Date(act.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                              {act.metadata?.description || `Logged event for ${act.entity_type}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-12 rounded-2xl text-center">
                <Star className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="font-sora font-extrabold text-sm text-slate-800 dark:text-white">Customer Success CRM Workspace</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Select a registered contractor profile from the left panel to classify account tiers, write protected success logs, review automated health gauges, and audit real-time timelines.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'integrations' ? (
        /* TAB 3: INTEGRATION REQUESTS PIPELINE */
        <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-950 border-b border-app-border dark:border-navy-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Requester Seat</th>
                  <th className="py-4 px-6">Bespoke Integration Request Details</th>
                  <th className="py-4 px-6">Urgency SLA</th>
                  <th className="py-4 px-6">Submission Date</th>
                  <th className="py-4 px-6 text-right">Status Action Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border dark:divide-navy-800 text-xs text-slate-900 dark:text-white font-inter">
                {filteredIntegrations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">No integration requests in queue.</td>
                  </tr>
                ) : (
                  filteredIntegrations.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-950/40">
                      <td className="py-4 px-6">
                        <span className="font-bold block">Ref Requester ID:</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{req.user_id.slice(0, 12)}...</span>
                      </td>
                      <td className="py-4 px-6 max-w-sm">
                        <div className="font-bold leading-relaxed">{req.business_need}</div>
                        {req.desired_workflow && (
                          <div className="text-[10px] text-slate-400 mt-1 font-semibold">Desired workflow: {req.desired_workflow}</div>
                        )}
                        {req.attachment_url && (
                          <div className="mt-2">
                            <a href={req.attachment_url} target="_blank" rel="noreferrer" className="text-[9px] text-copper font-bold hover:underline">
                              Download attached data resource
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 border rounded-md font-bold tracking-wider text-[9px] uppercase ${
                          req.urgency === 'critical' || req.urgency === 'high'
                            ? 'text-rose-500 border-rose-500/20 bg-rose-500/5'
                            : 'text-slate-400 border-slate-200 dark:border-navy-850 bg-slate-50 dark:bg-navy-950'
                        }`}>
                          {req.urgency}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400 font-semibold">{new Date(req.created_at).toLocaleDateString()}</td>
                      <td className="py-4 px-6 text-right">
                        <select
                          value={req.status}
                          onChange={(e) => handleUpdateIntegrationStatus(req.id, e.target.value as any)}
                          className="bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-lg p-2 text-[10px] font-bold text-slate-800 dark:text-white focus:outline-none"
                        >
                          <option value="pending review">Pending Review</option>
                          <option value="under analysis">Under Analysis</option>
                          <option value="planned">Planned</option>
                          <option value="in progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'support' ? (
        /* TAB 4: ADVANCED SLA SUPPORT TICKETS DESK */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Ticket Queue List */}
          <div className="lg:col-span-4 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden max-h-[70vh] flex flex-col">
            <div className="px-5 py-4 border-b border-app-border dark:border-navy-800 bg-slate-50 dark:bg-navy-950/25 flex-shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Incident Ticket Queue</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-app-border dark:divide-navy-850 scrollbar-thin">
              {filteredTickets.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No incidents in queue.</div>
              ) : (
                filteredTickets.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-4 transition-colors cursor-pointer relative ${
                      selectedTicket?.id === t.id 
                        ? 'bg-slate-50 dark:bg-navy-950/45 border-l-2 border-copper' 
                        : 'hover:bg-slate-50/30 dark:hover:bg-navy-950/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase">#{t.id.slice(0, 5)}</span>
                      <span className={`text-[8px] font-bold uppercase px-2 py-0.2 rounded border ${
                        t.status === 'resolved' || t.status === 'closed'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-amber-50 text-amber-600 border-amber-200'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs mt-1 truncate">{t.subject}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Priority: {t.priority}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ticket Response Board */}
          <div className="lg:col-span-8">
            {selectedTicket ? (
              <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden flex flex-col max-h-[75vh]">
                
                {/* Conversation Header */}
                <div className="px-6 py-4.5 border-b border-app-border dark:border-navy-800 bg-slate-50 dark:bg-navy-950/25 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-sora font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">{selectedTicket.subject}</h4>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-copper/10 text-copper rounded border border-copper/15 uppercase">
                        SLA Window: {selectedTicket.priority}
                      </span>
                    </div>
                    <span className="text-[9.5px] text-slate-400 mt-0.5 block">Client Requester: {selectedTicket.user_id}</span>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleUpdateTicketStatus('resolved')}
                      className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-[10px] font-bold transition-all"
                    >
                      Resolve Case
                    </button>
                    <button 
                      onClick={() => handleUpdateTicketStatus('closed')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-navy-950 dark:hover:bg-navy-900 text-slate-500 rounded-xl text-[10px] font-bold border border-slate-250 dark:border-navy-850"
                    >
                      Close Case
                    </button>
                  </div>
                </div>

                {/* Responses List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[40vh] scrollbar-thin">
                  {/* First incident query */}
                  <div className="bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-900 p-4 rounded-xl text-xs">
                    <p className="font-bold text-slate-800 dark:text-white border-b border-slate-200/40 pb-1 mb-2">Original Ticket Message</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{selectedTicket.message}</p>
                    {selectedTicket.attachment_url && (
                      <div className="mt-2 text-[10px]">
                        <a href={selectedTicket.attachment_url} target="_blank" rel="noreferrer" className="text-copper font-bold hover:underline">
                          View Attached Screenshot / Link
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Conversation thread */}
                  {ticketResponses.map(res => (
                    <div 
                      key={res.id} 
                      className={`flex flex-col max-w-[85%] ${
                        res.user_id === selectedTicket.user_id ? 'mr-auto items-start' : 'ml-auto items-end'
                      }`}
                    >
                      <div className={`p-4 rounded-2xl shadow-sm text-xs leading-relaxed ${
                        res.is_internal
                          ? 'bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300'
                          : res.user_id === selectedTicket.user_id
                            ? 'bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-900 text-slate-700 dark:text-slate-200'
                            : 'bg-copper text-white'
                      }`}>
                        {res.is_internal && <span className="font-extrabold text-[8px] bg-rose-500 text-white px-1.5 py-0.2 rounded uppercase block mb-1.5 tracking-wider max-w-max">Protected Admin Note</span>}
                        <p className="whitespace-pre-wrap">{res.message}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 px-2 font-semibold">
                        {res.user_id === selectedTicket.user_id ? 'Client' : res.is_internal ? 'Superadmin Memo' : 'You'} • {new Date(res.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Reply Input Form */}
                <form onSubmit={handleSendTicketResponse} className="px-5 py-4 border-t border-app-border dark:border-navy-800 bg-slate-50 dark:bg-navy-950/45 space-y-3 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalResponse}
                        onChange={(e) => setIsInternalResponse(e.target.checked)}
                        className="rounded border-slate-300 text-copper focus:ring-copper"
                      />
                      Post as Internal Administrative Memo (Hidden from Client)
                    </label>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newResponse}
                      onChange={(e) => setNewResponse(e.target.value)}
                      placeholder={isInternalResponse ? "Write protected admin comments..." : "Respond to customer ticket..."}
                      className="flex-1 bg-white dark:bg-navy border border-slate-200 dark:border-navy-850 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                    />
                    <button
                      type="submit"
                      disabled={sendingResponse || !newResponse.trim()}
                      className="p-3 bg-copper hover:bg-copper-hover disabled:opacity-50 text-white rounded-xl shadow-md transition-all flex-shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>

              </div>
            ) : (
              <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-12 rounded-2xl text-center">
                <HelpCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="font-sora font-extrabold text-sm text-slate-800 dark:text-white">Incident Response Terminal</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Select a support incident ticket from the left panel to review logs, change priority SLAs, converse with the client, or save protected internal administrative memos.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'email_sandbox' ? (
        /* TAB 5: RESPONSIVE EMAIL SANDBOX PREVIEWER */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start font-inter text-xs">
          
          {/* Template Selectors Panel (Columns 1-4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-5 rounded-2xl">
              <h3 className="font-sora font-extrabold text-sm text-slate-900 dark:text-white mb-4">Branded Transactional Templates</h3>
              
              <div className="space-y-2">
                {emailTemplates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedEmailType(tmpl.id)}
                    className={`w-full text-left p-3.5 rounded-xl border font-bold transition-all block ${
                      selectedEmailType === tmpl.id
                        ? 'bg-copper/5 text-copper border-copper'
                        : 'bg-transparent text-slate-400 border-slate-200 dark:border-navy-800 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Send Simulation Form */}
            <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-5 rounded-2xl">
              <h3 className="font-sora font-extrabold text-xs text-slate-900 dark:text-white mb-2">Simulate Deliverability</h3>
              <p className="text-[10px] text-slate-400 leading-normal mb-4">
                Execute a Resend & SMTP simulation to verify correct threading, plaintext compilation, and bounce resiliency.
              </p>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Target Test Recipient</label>
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="recipient@company.com"
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-copper font-bold"
                  />
                </div>

                <button
                  onClick={handleSendTestEmail}
                  disabled={sendingTestEmail || !testRecipient.trim()}
                  className="w-full py-3 bg-copper hover:bg-copper-hover active:bg-copper-600 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  {sendingTestEmail ? (
                    <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Dispatch Live Test Send
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Simulated Logs Feed */}
            {emailLogs.length > 0 && (
              <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-5 rounded-2xl">
                <h3 className="font-sora font-bold text-xs text-slate-900 dark:text-white mb-3">Email Logs Audit</h3>
                <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                  {emailLogs.map(log => (
                    <div key={log.id} className="p-2 bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-900 rounded-lg flex items-center justify-between text-[9px] gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{log.recipient_email}</div>
                        <div className="text-slate-400 mt-0.5 truncate">{log.subject}</div>
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-250 px-2 py-0.2 rounded font-bold uppercase tracking-wider">
                        {log.delivery_status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Frame Previewer Panel (Columns 5-12) */}
          <div className="lg:col-span-8 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-6 rounded-2xl flex flex-col min-h-[60vh]">
            
            {/* Device Switcher */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-850 pb-4 mb-6">
              <div>
                <h4 className="font-sora font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Template: {activeEmailTemplate.title}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Subject: {activeEmailTemplate.subject}</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-950 p-1 rounded-xl border border-slate-200 dark:border-navy-850">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-2 rounded-lg transition-all ${
                    previewDevice === 'desktop' ? 'bg-white dark:bg-navy text-copper shadow-sm' : 'text-slate-400'
                  }`}
                  title="Desktop Preview"
                >
                  <Laptop className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-2 rounded-lg transition-all ${
                    previewDevice === 'mobile' ? 'bg-white dark:bg-navy text-copper shadow-sm' : 'text-slate-400'
                  }`}
                  title="Mobile Preview"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Simulated Viewport Frame */}
            <div className="flex-1 flex items-center justify-center bg-slate-100/50 dark:bg-navy-950/20 p-6 rounded-2xl border border-slate-200/50 dark:border-navy-850/40">
              <div
                className={`transition-all duration-300 overflow-y-auto bg-slate-950 border border-slate-800 shadow-premium rounded-2xl ${
                  previewDevice === 'mobile' ? 'w-[360px] h-[520px]' : 'w-full max-w-[620px] h-[520px]'
                }`}
              >
                {/* Device Bezel UI details */}
                <div className="bg-slate-900 px-4 py-2 flex items-center gap-1.5 border-b border-slate-800/80">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div className="bg-slate-950 px-3 py-0.5 rounded text-[8px] text-slate-500 font-bold ml-4 truncate flex-1 max-w-[280px]">
                    {activeEmailTemplate.subject}
                  </div>
                </div>

                {/* Email HTML Body Render */}
                <div className="p-4" dangerouslySetInnerHTML={{ __html: activeEmailTemplate.html }} />
              </div>
            </div>

            {/* Plaintext Fallback section */}
            <div className="mt-6 border-t border-slate-100 dark:border-navy-850 pt-5">
              <h4 className="font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider text-[10px]">Plaintext Alternative Fallback</h4>
              <pre className="p-4 bg-slate-50 dark:bg-navy-950 border border-slate-150 dark:border-navy-900 rounded-xl whitespace-pre-wrap text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                {activeEmailTemplate.plaintext}
              </pre>
            </div>

          </div>
        </div>
      ) : activeTab === 'waitlist' ? (
        /* TAB 6: WAITLIST QUEUE */
        <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-950 border-b border-app-border dark:border-navy-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Applicant / Company</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Trade Discipline</th>
                  <th className="py-4 px-6">Submission Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border dark:divide-navy-800 text-xs text-slate-900 dark:text-white">
                {filteredWaitlist.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">No applicants in waitlist.</td>
                  </tr>
                ) : (
                  filteredWaitlist.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-950/40">
                      <td className="py-4 px-6">
                        <div className="font-bold">{w.name || '—'}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3.5 h-3.5" /> {w.company || 'No Company Listed'}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold">{w.email}</td>
                      <td className="py-4 px-6">
                        <span className="bg-copper/10 text-copper border border-copper/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase capitalize">
                          {w.trade || 'General'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400 font-semibold">{new Date(w.created_at).toLocaleDateString()}</td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleApproveWaitlist(w)}
                          className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] px-3.5 py-1.5 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                        >
                          Approve & Invite
                        </button>
                        <button
                          onClick={() => handleRemoveWaitlist(w.id)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                          title="Remove applicant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      ) : activeTab === 'feature_flags' ? (
        /* ═══════════════════════════════════════════════════
           TAB 7: FEATURE FLAGS & PLATFORM CONTROLS
        ═══════════════════════════════════════════════════ */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Flag className="w-4 h-4 text-copper" /> Feature Flag Registry
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Toggle platform capabilities per-organization. Changes apply instantly with no redeploy required.</p>
            </div>
            <button onClick={fetchFeatureFlags} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-950 rounded-xl transition-all text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {flagsLoading ? (
            <div className="h-40 flex items-center justify-center"><div className="w-7 h-7 border-4 border-copper border-t-transparent rounded-full animate-spin" /></div>
          ) : featureFlags.length === 0 ? (
            <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl p-12 text-center">
              <Flag className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-xs text-slate-400">No feature flags found. Run the latest migration to seed default flags.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featureFlags.map(flag => (
                <div key={flag.id} className={`bg-white dark:bg-navy border rounded-2xl p-5 transition-all shadow-card ${
                  flag.enabled_globally ? 'border-copper/30' : 'border-slate-200 dark:border-navy-800'
                }`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{flag.name}</span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                          flag.enabled_globally
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                            : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-navy-950 dark:border-navy-850'
                        }`}>
                          {flag.enabled_globally ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      {flag.description && (
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{flag.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleFeatureFlag(flag)}
                      className="flex-shrink-0 transition-all hover:scale-110"
                      title={flag.enabled_globally ? 'Disable flag' : 'Enable flag'}
                    >
                      {flag.enabled_globally
                        ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                        : <ToggleLeft className="w-7 h-7 text-slate-300 dark:text-slate-600" />}
                    </button>
                  </div>
                  <div className="border-t border-slate-100 dark:border-navy-900 pt-3 flex items-center justify-between text-[9px] text-slate-400 font-semibold">
                    <span>Rollout: {flag.rollout_percentage}%</span>
                    <span>Beta users: {flag.beta_users?.length ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : activeTab === 'ai_settings' ? (
        /* ═══════════════════════════════════════════════════
           TAB 8: AI USAGE LIMITS & CONTROLS
        ═══════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Bot className="w-4 h-4 text-copper" /> AI Usage Controls
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Configure monthly cost caps, rate limits, and inspect per-action AI consumption logs.</p>
            </div>
            <button onClick={() => { fetchAiSettings(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-950 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {aiSettingsLoading ? (
            <div className="h-40 flex items-center justify-center"><div className="w-7 h-7 border-4 border-copper border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Limits Card */}
              <div className="lg:col-span-1 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-sora font-extrabold text-xs text-slate-900 dark:text-white">Usage Limits</h3>
                  <button
                    onClick={() => setEditingAiLimit(!editingAiLimit)}
                    className="p-1.5 hover:bg-copper/10 text-slate-400 hover:text-copper rounded-lg transition-all"
                  >
                    {editingAiLimit ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {aiUsage ? (
                  <div className="space-y-4">
                    {/* Monthly Budget */}
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                        <span>Monthly Budget</span>
                        <span className="text-copper">${(aiUsage.monthly_usage_cents / 100).toFixed(2)} / ${(aiUsage.monthly_limit_cents / 100).toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-navy-950 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-copper to-amber-400 transition-all"
                          style={{ width: `${Math.min(100, (aiUsage.monthly_usage_cents / aiUsage.monthly_limit_cents) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1">{((aiUsage.monthly_usage_cents / aiUsage.monthly_limit_cents) * 100).toFixed(1)}% consumed this cycle</p>
                    </div>

                    {editingAiLimit ? (
                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Monthly Cap (cents)</label>
                          <input
                            type="number"
                            value={newMonthlyLimit}
                            onChange={e => setNewMonthlyLimit(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Max Requests / Minute</label>
                          <input
                            type="number"
                            value={newRpmLimit}
                            onChange={e => setNewRpmLimit(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                          />
                        </div>
                        <button
                          onClick={handleSaveAiLimits}
                          className="w-full py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" /> Save Limits
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-2 border-b border-slate-100 dark:border-navy-900">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold">Rate Limit</span>
                          <span className="font-bold text-slate-900 dark:text-white">{aiUsage.max_requests_per_minute} req/min</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100 dark:border-navy-900">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold">Last Reset</span>
                          <span className="font-bold text-slate-900 dark:text-white">{new Date(aiUsage.last_reset_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold">Req Counter</span>
                          <span className="font-bold text-slate-900 dark:text-white">{aiUsage.request_counter}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-6">No AI limit record found.</p>
                )}
              </div>

              {/* Right: Usage Logs */}
              <div className="lg:col-span-2 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-850 bg-slate-50 dark:bg-navy-950/25">
                  <h3 className="font-sora font-extrabold text-xs text-slate-900 dark:text-white">Recent AI Invocation Log</h3>
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-navy-850 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-5">Action</th>
                        <th className="py-3 px-5">Provider</th>
                        <th className="py-3 px-5">Tokens</th>
                        <th className="py-3 px-5">Cost</th>
                        <th className="py-3 px-5">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-900">
                      {aiUsageLogs.length === 0 ? (
                        <tr><td colSpan={5} className="py-12 text-center text-slate-400">No AI logs recorded yet.</td></tr>
                      ) : (
                        aiUsageLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-950/30">
                            <td className="py-3 px-5 font-bold text-slate-900 dark:text-white">{log.action}</td>
                            <td className="py-3 px-5">
                              <span className="bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{log.provider}</span>
                            </td>
                            <td className="py-3 px-5 text-slate-500 dark:text-slate-400 font-semibold">{(log.prompt_tokens || 0) + (log.completion_tokens || 0)}</td>
                            <td className="py-3 px-5 font-bold text-copper">${Number(log.cost || 0).toFixed(4)}</td>
                            <td className="py-3 px-5 text-slate-400">{new Date(log.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

      ) : activeTab === 'automation' ? (
        /* ═══════════════════════════════════════════════════
           TAB 9: AUTOMATION SCHEDULER & FINANCING CONFIG
        ═══════════════════════════════════════════════════ */
        <div className="space-y-8">
          {/* Campaign Rules Panel */}
          <div>
            <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-copper" /> Follow-up Campaign Scheduler
            </h2>
            <p className="text-[11px] text-slate-400 mb-5">Configure automated proposal follow-up timing, triggers, and email subjects. Rules persist per organization.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {campaignRules.map(rule => (
                <div
                  key={rule.id}
                  className={`bg-white dark:bg-navy border rounded-2xl p-5 shadow-card transition-all ${
                    rule.isActive ? 'border-copper/25' : 'border-slate-200 dark:border-navy-800 opacity-60'
                  }`}
                >
                  {editingRule?.id === rule.id ? (
                    /* Inline Edit Form */
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">Editing Rule</span>
                        <button onClick={() => setEditingRule(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-navy-950 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Rule Name</label>
                        <input
                          value={editingRule.name}
                          onChange={e => setEditingRule(prev => prev ? { ...prev, name: e.target.value } : null)}
                          className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Trigger Event</label>
                          <select
                            value={editingRule.triggerEvent}
                            onChange={e => setEditingRule(prev => prev ? { ...prev, triggerEvent: e.target.value as any } : null)}
                            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                          >
                            <option value="viewed">Viewed</option>
                            <option value="abandoned">Abandoned</option>
                            <option value="expired">Expired</option>
                            <option value="created">Created</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Delay (hours)</label>
                          <input
                            type="number"
                            value={editingRule.delayHours}
                            onChange={e => setEditingRule(prev => prev ? { ...prev, delayHours: Number(e.target.value) } : null)}
                            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Email Subject</label>
                        <input
                          value={editingRule.subject}
                          onChange={e => setEditingRule(prev => prev ? { ...prev, subject: e.target.value } : null)}
                          className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                        />
                      </div>
                      <button
                        onClick={handleSaveCampaignRule}
                        className="w-full py-2 bg-copper hover:bg-copper-hover text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Rule
                      </button>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{rule.name}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                              rule.isActive
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-navy-950 dark:border-navy-850'
                            }`}>
                              {rule.isActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Trigger: <strong className="text-slate-600 dark:text-slate-300">{rule.triggerEvent}</strong> → after <strong className="text-copper">{rule.delayHours}h</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => setEditingRule(rule)} className="p-1.5 hover:bg-copper/10 text-slate-400 hover:text-copper rounded-lg transition-all" title="Edit rule">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleToggleCampaignRule(rule.id)} className="transition-all hover:scale-110" title={rule.isActive ? 'Pause rule' : 'Activate rule'}>
                            {rule.isActive ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-slate-300 dark:text-slate-600" />}
                          </button>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-900 rounded-xl px-3 py-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                        Subject: "{rule.subject}"
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Financing Config Panel */}
          <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-sora font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-copper" /> Global Financing Configuration
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Configure interest rate, maximum term, and minimum qualifying estimate value.</p>
              </div>
              <button
                onClick={() => setEditingFinancing(!editingFinancing)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-navy-800 hover:border-copper text-slate-500 dark:text-slate-400 hover:text-copper rounded-xl text-xs font-bold transition-all"
              >
                {editingFinancing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {editingFinancing ? 'Cancel' : 'Edit Config'}
              </button>
            </div>

            {editingFinancing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Interest Rate (APR %)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={finForm.rate}
                      onChange={e => setFinForm(p => ({ ...p, rate: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl pl-3 pr-8 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Max Term (months)</label>
                  <input
                    type="number"
                    value={finForm.maxTerm}
                    onChange={e => setFinForm(p => ({ ...p, maxTerm: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Min Qualifying Amount ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input
                      type="number"
                      value={finForm.minAmount}
                      onChange={e => setFinForm(p => ({ ...p, minAmount: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl pl-6 pr-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Financing Module</label>
                  <button
                    onClick={() => setFinForm(p => ({ ...p, enabled: !p.enabled }))}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      finForm.enabled
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                        : 'bg-slate-100 dark:bg-navy-950 border-slate-200 dark:border-navy-850 text-slate-400'
                    }`}
                  >
                    {finForm.enabled ? <CircleCheck className="w-3.5 h-3.5" /> : <CircleX className="w-3.5 h-3.5" />}
                    {finForm.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <button
                    onClick={handleSaveFinancingSettings}
                    className="px-6 py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Financing Config
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {[
                  { label: 'APR Interest Rate', value: `${systemSettings?.financing_interest_rate ?? '9.99'}%`, icon: Percent },
                  { label: 'Max Term', value: `${systemSettings?.financing_max_term_months ?? '120'} months`, icon: Timer },
                  { label: 'Minimum Amount', value: `$${Number(systemSettings?.financing_min_amount ?? 1000).toLocaleString()}`, icon: DollarSign },
                  { label: 'Module Status', value: systemSettings?.financing_enabled ? 'Active' : 'Disabled', icon: systemSettings?.financing_enabled ? CircleCheck : CircleX }
                ].map(stat => {
                  const StatIcon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-900 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <StatIcon className="w-3.5 h-3.5 text-copper" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</span>
                      </div>
                      <span className="font-sora font-extrabold text-slate-900 dark:text-white text-sm">{stat.value}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      ) : activeTab === 'templates' ? (
        /* ═══════════════════════════════════════════════════
           TAB 10: GLOBAL TEMPLATES LIBRARY MANAGER
        ═══════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Template List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-copper" /> Assembly Templates
              </h2>
              <button
                onClick={() => { setShowNewTemplateForm(!showNewTemplateForm); setSelectedTemplate(null); setTemplateItems([]); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all border ${
                  showNewTemplateForm ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-copper/10 border-copper/20 text-copper hover:bg-copper hover:text-white'
                }`}
              >
                {showNewTemplateForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showNewTemplateForm ? 'Cancel' : 'New Template'}
              </button>
            </div>

            {/* New Template Form */}
            {showNewTemplateForm && (
              <form onSubmit={handleCreateTemplate} className="bg-white dark:bg-navy border border-copper/25 shadow-card rounded-2xl p-5 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white">Create New Template</h4>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Template Name *</label>
                  <input
                    required
                    value={newTemplate.name}
                    onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Standard Panel Upgrade"
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Trade</label>
                  <select
                    value={newTemplate.trade}
                    onChange={e => setNewTemplate(p => ({ ...p, trade: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-copper"
                  >
                    {['electrical','roofing','hvac','painting','plumbing','drain','general','other'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={newTemplate.description}
                    onChange={e => setNewTemplate(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of scope..."
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-copper resize-none"
                  />
                </div>
                <button type="submit" className="w-full py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl font-bold transition-all">
                  Create Template
                </button>
              </form>
            )}

            {/* Template List */}
            {templatesLoading ? (
              <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-4 border-copper border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
                {templates.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <Package className="w-7 h-7 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    No templates found.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-navy-900">
                    {templates.map(tmpl => (
                      <div
                        key={tmpl.id}
                        onClick={() => { setSelectedTemplate(tmpl); fetchTemplateItems(tmpl.id); setShowNewTemplateForm(false); }}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedTemplate?.id === tmpl.id
                            ? 'bg-copper/5 border-l-2 border-copper'
                            : 'hover:bg-slate-50/50 dark:hover:bg-navy-950/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{tmpl.name}</span>
                          {tmpl.is_global && (
                            <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold text-copper bg-copper/10 border border-copper/20 px-1.5 py-0.5 rounded">
                              <Globe className="w-2.5 h-2.5" /> Global
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400 bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 px-1.5 py-0.5 rounded">{tmpl.trade}</span>
                          {tmpl.description && <p className="text-[9px] text-slate-400 truncate">{tmpl.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Template Items Detail */}
          <div className="lg:col-span-8">
            {selectedTemplate ? (
              <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-850 bg-slate-50 dark:bg-navy-950/25 flex items-center justify-between">
                  <div>
                    <h3 className="font-sora font-extrabold text-sm text-slate-900 dark:text-white">{selectedTemplate.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{selectedTemplate.trade} • {selectedTemplate.is_global ? 'Global Template' : 'Organization Template'}</p>
                  </div>
                  {!selectedTemplate.is_global && (
                    <button
                      onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-bold transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-navy-850 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-5">Description</th>
                        <th className="py-3 px-5">Qty</th>
                        <th className="py-3 px-5">Unit</th>
                        <th className="py-3 px-5">Unit Price</th>
                        <th className="py-3 px-5">Category</th>
                        <th className="py-3 px-5">Markup</th>
                        <th className="py-3 px-5">Ext. Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-900">
                      {templateItems.length === 0 ? (
                        <tr><td colSpan={7} className="py-10 text-center text-slate-400">No items in this template.</td></tr>
                      ) : (
                        templateItems.map(item => {
                          const ext = item.quantity * item.unit_price * (1 + item.markup / 100);
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-950/30">
                              <td className="py-3 px-5 font-semibold text-slate-900 dark:text-white">{item.description}</td>
                              <td className="py-3 px-5 text-slate-500 dark:text-slate-400">{item.quantity}</td>
                              <td className="py-3 px-5 text-slate-500 dark:text-slate-400">{item.unit}</td>
                              <td className="py-3 px-5 font-bold text-slate-900 dark:text-white">${Number(item.unit_price).toFixed(2)}</td>
                              <td className="py-3 px-5">
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                  item.category === 'labor' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
                                  : item.category === 'material' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-navy-950 dark:border-navy-850'
                                }`}>{item.category}</span>
                              </td>
                              <td className="py-3 px-5 text-slate-500 dark:text-slate-400">{item.markup}%</td>
                              <td className="py-3 px-5 font-bold text-copper">${ext.toFixed(2)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {templateItems.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-copper/20 bg-slate-50 dark:bg-navy-950/50">
                          <td colSpan={6} className="py-3 px-5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Template Estimated Total</td>
                          <td className="py-3 px-5 font-sora font-extrabold text-copper text-sm">
                            ${templateItems.reduce((sum, item) => sum + item.quantity * item.unit_price * (1 + item.markup / 100), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-12 rounded-2xl text-center">
                <LayoutTemplate className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="font-sora font-extrabold text-sm text-slate-800 dark:text-white">Template Inspector</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">Select a template from the left to inspect its line items, material costs, and estimated totals.</p>
              </div>
            )}
          </div>
        </div>

      ) : activeTab === 'audit_logs' ? (
        /* ═══════════════════════════════════════════════════
           TAB 11: IMMUTABLE AUDIT LOG VIEWER
        ═══════════════════════════════════════════════════ */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-copper" /> Security Audit Log
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Immutable, append-only record of all security-sensitive operations. Paginated {AUDIT_PAGE_SIZE} per page.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setAuditPage(p => Math.max(1, p - 1)); fetchAuditLogs(Math.max(1, auditPage - 1)); }}
                disabled={auditPage === 1}
                className="px-3 py-1.5 text-[10px] font-bold border border-slate-200 dark:border-navy-800 rounded-xl hover:border-copper hover:text-copper disabled:opacity-40 transition-all text-slate-400"
              >
                ← Prev
              </button>
              <span className="text-[10px] font-bold text-slate-400 px-2">Page {auditPage}</span>
              <button
                onClick={() => { setAuditPage(p => p + 1); fetchAuditLogs(auditPage + 1); }}
                disabled={auditLogs.length < AUDIT_PAGE_SIZE}
                className="px-3 py-1.5 text-[10px] font-bold border border-slate-200 dark:border-navy-800 rounded-xl hover:border-copper hover:text-copper disabled:opacity-40 transition-all text-slate-400"
              >
                Next →
              </button>
              <button onClick={() => fetchAuditLogs(auditPage)} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-950 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {auditLogsLoading ? (
            <div className="h-40 flex items-center justify-center"><div className="w-7 h-7 border-4 border-copper border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left min-w-[900px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-800 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-5">Timestamp</th>
                      <th className="py-3.5 px-5">Actor</th>
                      <th className="py-3.5 px-5">Action Type</th>
                      <th className="py-3.5 px-5">Entity</th>
                      <th className="py-3.5 px-5">Entity ID</th>
                      <th className="py-3.5 px-5">IP Address</th>
                      <th className="py-3.5 px-5">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-900">
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan={7} className="py-16 text-center text-slate-400">
                        <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                        No audit events recorded yet.
                      </td></tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/40 dark:hover:bg-navy-950/30 align-top">
                          <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
                            {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400">{log.actor_id ? log.actor_id.slice(0, 12) + '…' : 'System'}</span>
                          </td>
                          <td className="py-3.5 px-5">
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${
                              log.action_type.includes('delete') || log.action_type.includes('revoke')
                                ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30'
                                : log.action_type.includes('create') || log.action_type.includes('insert')
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                                : 'bg-copper/10 text-copper border-copper/20'
                            }`}>
                              {log.action_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-white capitalize">{log.entity_type}</td>
                          <td className="py-3.5 px-5">
                            {log.entity_id ? <span className="font-mono text-[9px] text-slate-400">{log.entity_id.slice(0, 10)}…</span> : '—'}
                          </td>
                          <td className="py-3.5 px-5">
                            {log.ip_address ? <span className="font-mono text-[9px] text-slate-500">{log.ip_address}</span> : '—'}
                          </td>
                          <td className="py-3.5 px-5 max-w-[200px]">
                            {Object.keys(log.new_value || {}).length > 0 ? (
                              <details className="text-[9px]">
                                <summary className="cursor-pointer text-copper font-bold hover:underline">View diff</summary>
                                <pre className="mt-1.5 p-2 bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-900 rounded-lg text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-all leading-relaxed max-h-24 overflow-y-auto">{JSON.stringify(log.new_value, null, 2)}</pre>
                              </details>
                            ) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      ) : activeTab === 'system_logs' ? (
        /* ═══════════════════════════════════════════════════
           TAB 12: SYSTEM & SUBSCRIPTION TRACKER
        ═══════════════════════════════════════════════════ */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-copper" /> System & Subscription Status
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Monitor wire transfer payments, active usage metrics, and storage consumption.</p>
            </div>
            <button onClick={fetchSystemLogs} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-950 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {sysLoading ? (
            <div className="h-40 flex items-center justify-center"><div className="w-7 h-7 border-4 border-copper border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Wire Transfer Payment Card */}
              <div className="lg:col-span-1 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl p-6">
                <h3 className="font-sora font-extrabold text-xs text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-copper" /> Wire Transfer Payment
                </h3>
                {subscription ? (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-navy-900">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Status</span>
                      <span className={`font-extrabold px-2.5 py-1 rounded-xl border text-[10px] uppercase tracking-wider ${
                        (subscription.status as string) === 'active'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                          : (subscription.status as string) === 'pending_wire'
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : (subscription.status as string) === 'past_due'
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-rose-50 text-rose-600 border-rose-200'
                      }`}>
                        {(subscription.status as string) === 'pending_wire' ? '⏳ Pending Wire' : subscription.status}
                      </span>
                    </div>
                    {(subscription as any).wire_reference && (
                      <div className="flex justify-between py-2 border-b border-slate-100 dark:border-navy-900">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Wire Ref</span>
                        <span className="font-mono text-[9px] text-slate-400 truncate max-w-[140px]">{(subscription as any).wire_reference}</span>
                      </div>
                    )}
                    {(subscription as any).wire_submitted_at && (
                      <div className="flex justify-between py-2 border-b border-slate-100 dark:border-navy-900">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Submitted</span>
                        <span className="font-bold text-slate-900 dark:text-white">{new Date((subscription as any).wire_submitted_at).toLocaleDateString()}</span>
                      </div>
                    )}
                    {subscription.current_period_end && (
                      <div className="flex justify-between py-2 border-b border-slate-100 dark:border-navy-900">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Active Until</span>
                        <span className="font-bold text-slate-900 dark:text-white">{new Date(subscription.current_period_end).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-navy-900">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Registered</span>
                      <span className="font-bold text-slate-900 dark:text-white">{new Date(subscription.created_at).toLocaleDateString()}</span>
                    </div>
                    {/* Admin Approve Button */}
                    {(subscription.status as string) === 'pending_wire' && (
                      <button
                        onClick={async () => {
                          const periodEnd = new Date();
                          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                          await supabase.from('subscriptions').update({
                            status: 'active',
                            current_period_end: periodEnd.toISOString(),
                          }).eq('organization_id', subscription.organization_id);
                          await supabase.from('organizations').update({ billing_tier: 'pro' })
                            .eq('id', subscription.organization_id);
                          fetchSystemLogs();
                          toast.success('Wire payment approved — account upgraded to Pro!');
                        }}
                        className="w-full mt-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        ✓ Approve Wire & Activate Pro
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CreditCard className="w-7 h-7 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No subscription record found.</p>
                  </div>
                )}
              </div>

              {/* Usage Metrics Cards */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-sora font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-copper" /> Usage Period Metrics
                </h3>

                {usageStats.length === 0 ? (
                  <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl p-10 text-center">
                    <Activity className="w-7 h-7 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No usage data recorded yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {['proposals_sent', 'ai_prompts', 'storage_bytes'].map(metric => {
                      const record = usageStats.find(u => u.metric_name === metric);
                      const icons: Record<string, any> = { proposals_sent: FileText, ai_prompts: Bot, storage_bytes: Database };
                      const MetricIcon = icons[metric] || Activity;
                      const labels: Record<string, string> = { proposals_sent: 'Proposals Sent', ai_prompts: 'AI Prompts Used', storage_bytes: 'Storage Used' };
                      const formatValue = (m: string, v: number) => {
                        if (m === 'storage_bytes') return v > 1048576 ? `${(v / 1048576).toFixed(1)} MB` : `${(v / 1024).toFixed(1)} KB`;
                        return v.toLocaleString();
                      };
                      return (
                        <div key={metric} className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-copper/10 border border-copper/20 flex items-center justify-center">
                              <MetricIcon className="w-4 h-4 text-copper" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{labels[metric]}</span>
                          </div>
                          <span className="font-sora font-extrabold text-xl text-slate-900 dark:text-white">
                            {record ? formatValue(metric, record.count) : '0'}
                          </span>
                          {record?.billing_period_start && (
                            <p className="text-[9px] text-slate-400 mt-1">
                              Since {new Date(record.billing_period_start).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Raw usage table */}
                {usageStats.length > 0 && (
                  <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-navy-850 bg-slate-50 dark:bg-navy-950/25">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">All Usage Periods</span>
                    </div>
                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-navy-850 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            <th className="py-3 px-5">Metric</th>
                            <th className="py-3 px-5">Count</th>
                            <th className="py-3 px-5">Period Start</th>
                            <th className="py-3 px-5">Period End</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-900">
                          {usageStats.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-950/30">
                              <td className="py-3 px-5 font-bold capitalize text-slate-900 dark:text-white">{u.metric_name.replace('_', ' ')}</td>
                              <td className="py-3 px-5 text-copper font-extrabold">{u.count.toLocaleString()}</td>
                              <td className="py-3 px-5 text-slate-400">{new Date(u.billing_period_start).toLocaleDateString()}</td>
                              <td className="py-3 px-5 text-slate-400">{u.billing_period_end ? new Date(u.billing_period_end).toLocaleDateString() : 'Ongoing'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      ) : null}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy border border-slate-200 dark:border-navy-800 rounded-2xl p-6 max-w-md w-full shadow-premium animate-scale-in text-left">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-slate-100 dark:bg-navy-950 rounded-2xl flex items-center justify-center text-slate-900 dark:text-white flex-shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-sora font-extrabold text-slate-900 dark:text-white">Send Enterprise Invitation</h3>
                <p className="text-slate-400 text-[10px] mt-0.5">Sends a secure onboarding setup link directly to their inbox.</p>
              </div>
            </div>

            <form onSubmit={handleInvite} className="space-y-4 font-inter text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Recipient Email <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="contractor@company.com"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-copper"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-copper"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={inviteCompany}
                  onChange={e => setInviteCompany(e.target.value)}
                  placeholder="Smith Roofing LLC"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-copper"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-app-border dark:border-navy-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="bg-copper hover:bg-copper-hover disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5"
                >
                  {inviting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Send Magic Link'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
