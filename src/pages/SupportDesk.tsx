import { useState, useEffect, useRef } from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from '../providers/AuthProvider';
import { useEventBus } from '../hooks/useEventBus';
import {
  HelpCircle, LifeBuoy, AlertCircle, Clock, Send, Plus,
  FileText, ShieldCheck, CheckCircle2, ChevronRight, X, ArrowLeft, MessageSquare, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import type { SupportTicket, TicketResponse } from '../types';

export default function SupportDesk() {
  const { profile } = useAuth();
  const { triggerEvent } = useEventBus();
  
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

  // New ticket modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'billing' | 'technical' | 'bug' | 'feature' | 'other'>('technical');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [message, setMessage] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  
  // Roadmap states
  const [activeTab, setActiveTab] = useState<'tickets' | 'roadmap'>('tickets');
  const [votedFeatures, setVotedFeatures] = useState<string[]>([]);
  const [votingLoading, setVotingLoading] = useState<string | null>(null);
  
  const responsesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTickets();
    fetchRoadmapVotes();
  }, []);

  const fetchRoadmapVotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('integration_requests')
        .select('business_need')
        .eq('user_id', user.id)
        .eq('desired_workflow', 'User voted interest from roadmap panel');

      if (!error && data) {
        setVotedFeatures(data.map(item => item.business_need));
      }
    } catch (e) {
      console.error('Failed to fetch roadmap votes:', e);
    }
  };

  const handleVoteRoadmap = async (featureName: string) => {
    if (votedFeatures.includes(featureName)) return;
    
    setVotingLoading(featureName);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthenticated user. Please log in.');

      const { data: reqData, error: reqErr } = await supabase
        .from('integration_requests')
        .insert({
          user_id: user.id,
          business_need: featureName,
          desired_workflow: "User voted interest from roadmap panel",
          urgency: 'medium',
          status: 'pending review',
          priority: 'medium'
        })
        .select()
        .single();

      if (reqErr) throw reqErr;

      await triggerEvent({
        entityType: 'integration',
        entityId: reqData?.id,
        actionType: 'requested',
        title: `Roadmap Vote: ${featureName}`,
        description: `Voted interest in upcoming roadmap feature: "${featureName}".`,
        sendNotification: true,
        notificationType: 'info'
      });

      toast.success(`Thank you for your feedback! Interest registered for "${featureName}".`);
      setVotedFeatures(prev => [...prev, featureName]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to register vote. Please try again.');
    } finally {
      setVotingLoading(null);
    }
  };

  const ROADMAP_FEATURES = [
    {
      name: "Stripe Deposit Collection in Proposal",
      desc: "Enable contractors to collect upfront deposits securely via Stripe directly inside the client proposal portal."
    },
    {
      name: "SMS / WhatsApp Proposal Delivery",
      desc: "Dispatch proposal notifications, updates, and direct links via SMS or WhatsApp messages for high-speed engagement."
    },
    {
      name: "Win/Loss Reason Tracking",
      desc: "Track and analyze exact reasons why estimates were accepted or declined to optimize bidding and pricing intelligence."
    },
    {
      name: "Contractor Referral Program",
      desc: "Incentivize and track client/contractor peer-to-peer sharing with dynamic tier rewards."
    },
    {
      name: "Post-Approval Calendar Scheduling",
      desc: "Instantly schedule job kick-off dates and site walkthroughs directly on the contractor's calendar post-approval."
    },
    {
      name: "Per-Project Photo Gallery & Job Binder",
      desc: "Capture, markup, and organize on-site photos and specifications inside a centralized digital job binder."
    },
    {
      name: "Win Rate & Performance Analytics",
      desc: "Monitor precise win-rates, lead response velocities, and individual estimator performance dashboards."
    },
    {
      name: "Proposal Expiry Countdown Timer (Client-facing)",
      desc: "Drive client urgency with elegant, real-time expiry clocks on the public-facing proposal portal."
    },
    {
      name: "Multi-Contact / Household CC on Proposals",
      desc: "Keep multiple stakeholders (spouses, project managers, property owners) auto-carbon-copied on proposals."
    },
    {
      name: "AI Margin Suggestion Based on Past Wins",
      desc: "Auto-generate predictive profit margin optimizations by analyzing historical bids and local market data."
    },
    {
      name: "Post-Job Google Review Request",
      desc: "Trigger automated, brand-curated Google Review links immediately upon marked project completion."
    },
    {
      name: "Side-by-Side Tier Comparison Table (Client Portal)",
      desc: "Allow clients to toggle or compare multiple estimation tiers (Good/Better/Best) side-by-side."
    },
    {
      name: "Public Contractor Profile Page",
      desc: "Display a beautiful, public-facing company profile, verified project galleries, and verified client testimonials."
    },
    {
      name: "Invoice & Change Order Generation",
      desc: "Turn approved proposals into professional invoices and manage change orders dynamically with single-click updates."
    }
  ];

  useEffect(() => {
    if (selectedTicket) {
      fetchResponses(selectedTicket.id);

      // Real-time responses channel
      const channel = supabase
        .channel(`ticket_responses:${selectedTicket.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'ticket_responses',
          filter: `ticket_id=eq.${selectedTicket.id}`
        }, () => {
          fetchResponses(selectedTicket.id);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedTicket]);

  useEffect(() => {
    responsesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [responses]);

  const fetchTickets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTickets(data as SupportTicket[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('ticket_responses')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('is_internal', false) // Only standard customer-visible responses
        .order('created_at', { ascending: true });

      if (!error && data) {
        setResponses(data as TicketResponse[]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Please enter subject and message details');
      return;
    }

    setCreatingTicket(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthenticated user');

      // SLA hours map: urgent = 4h, high = 8h, medium = 16h, low = 24h
      const slaMap = { urgent: 4, high: 8, medium: 16, low: 24 };
      const slaTimer = new Date(Date.now() + slaMap[priority] * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          category,
          subject,
          message,
          priority,
          status: 'open',
          attachment_url: attachmentUrl || null,
          sla_timer: slaTimer
        })
        .select()
        .single();

      if (error) throw error;

      // Event bus Dispatch
      await triggerEvent({
        entityType: 'support',
        entityId: data?.id,
        actionType: 'opened',
        title: 'New Support Incident Registered',
        description: `Support Ticket #${data?.id.slice(0, 5)} opened. SLA response target: ${priority.toUpperCase()} (${slaMap[priority]} Hours)`,
        sendNotification: true,
        notificationType: 'support',
        sendEmail: true,
        emailType: 'ticket_received',
        recipientEmail: user.email || '',
        emailSubject: `Support Ticket Received: [Ref: #${data?.id.slice(0, 5)}]`
      });

      toast.success('Support incident registered successfully!');
      setShowNewModal(false);
      setSubject('');
      setMessage('');
      setAttachmentUrl('');
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Incident creation failed');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;

    setSendingResponse(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthenticated');

      const { error } = await supabase
        .from('ticket_responses')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: newMessage,
          is_internal: false
        });

      if (error) throw error;

      // Update ticket updated_at
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

      // Dispatch to Event Bus
      await triggerEvent({
        entityType: 'support',
        entityId: selectedTicket.id,
        actionType: 'replied',
        title: 'Support Ticket response sent',
        description: `Client response added on Ticket #${selectedTicket.id.slice(0, 5)}.`
      });

      setNewMessage('');
      fetchResponses(selectedTicket.id);
      fetchTickets();
    } catch (err: any) {
      toast.error('Failed to submit message');
    } finally {
      setSendingResponse(false);
    }
  };

  const getSlaIndicator = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { label: '4h SLA Urgent', color: 'text-rose-500 border-rose-500/20 bg-rose-500/5' };
      case 'high':
        return { label: '8h SLA High', color: 'text-amber-500 border-amber-500/20 bg-amber-500/5' };
      case 'medium':
        return { label: '16h SLA Standard', color: 'text-indigo-500 border-indigo-500/20 bg-indigo-500/5' };
      default:
        return { label: '24h SLA Low', color: 'text-slate-500 border-slate-500/20 bg-slate-500/5' };
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-950';
      case 'in progress':
        return 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border-blue-100 dark:border-blue-950';
      default:
        return 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100 dark:border-amber-950';
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in font-inter select-none flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-sora font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-copper" />
            Support Center
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs mt-0.5">SLA-Driven operational ticketing & resolution workspace</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl font-bold text-xs transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          Raise Ticket
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-6 flex-shrink-0 border-b border-app-border dark:border-navy-800 pb-2">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'tickets'
              ? 'bg-slate-100 dark:bg-navy-950 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-navy-800'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Support Tickets
        </button>
        <button
          onClick={() => setActiveTab('roadmap')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'roadmap'
              ? 'bg-copper/10 text-copper shadow-sm border border-copper/20'
              : 'text-slate-400 hover:text-copper dark:hover:text-copper'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Feature Roadmap
        </button>
      </div>

      {activeTab === 'tickets' ? (
        <div className="flex-1 flex gap-6 overflow-hidden min-h-0 bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl shadow-card">
        
        {/* Left Side: Ticket List */}
        <div className={`w-full lg:w-96 flex flex-col border-r border-app-border dark:border-navy-800 flex-shrink-0 ${
          selectedTicket ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="px-5 py-4 border-b border-app-border dark:border-navy-800 bg-slate-50 dark:bg-navy-950/25">
            <span className="font-sora font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider block">Your Open Incidents</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-app-border dark:divide-navy-850 scrollbar-thin">
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-copper border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="py-16 text-center px-6">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-900 dark:text-white text-xs font-bold">All systems healthy</p>
                <p className="text-slate-400 text-[10px] mt-0.5">Raise a ticket to report issues or ask questions.</p>
              </div>
            ) : (
              tickets.map(t => {
                const sla = getSlaIndicator(t.priority);
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-4 transition-colors cursor-pointer flex flex-col gap-2 relative ${
                      selectedTicket?.id === t.id 
                        ? 'bg-slate-50/80 dark:bg-navy-950/45 border-l-2 border-copper' 
                        : 'bg-transparent hover:bg-slate-50/40 dark:hover:bg-navy-950/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">#{t.id.slice(0, 5)}</span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${getStatusStyle(t.status)}`}>
                        {t.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate pr-6">{t.subject}</h4>
                    
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold mt-1">
                      <span>Updated {new Date(t.updated_at).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 border rounded-md font-bold tracking-wider uppercase ${sla.color}`}>
                        {sla.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Conversation workspace */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-slate-50/25 dark:bg-navy-950/10 ${
          selectedTicket ? 'flex' : 'hidden lg:flex items-center justify-center p-8'
        }`}>
          {selectedTicket ? (
            <>
              {/* Workspace Header */}
              <div className="px-6 py-4.5 border-b border-app-border dark:border-navy-800 bg-white dark:bg-navy flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedTicket(null)}
                    className="lg:hidden p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg text-slate-400 hover:text-slate-700"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-sora pr-2">{selectedTicket.subject}</h3>
                      <span className={`text-[9px] font-extrabold uppercase px-2 border rounded ${getStatusStyle(selectedTicket.status)}`}>
                        {selectedTicket.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Ref Incident ID: #{selectedTicket.id}
                    </p>
                  </div>
                </div>

                <div className={`px-2.5 py-1 border rounded-xl text-[10px] font-bold uppercase tracking-wider ${getSlaIndicator(selectedTicket.priority).color}`}>
                  {getSlaIndicator(selectedTicket.priority).label}
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                {/* Initial Ticket Question Description */}
                <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800/60 p-4.5 rounded-2xl max-w-2xl shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-850 pb-2 mb-3">
                    <span className="text-[10px] font-extrabold text-slate-800 dark:text-white">
                      {profile?.company_name || 'Client Account'} (Author)
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Opened {new Date(selectedTicket.created_at).toLocaleDateString()} at {new Date(selectedTicket.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.message}
                  </p>
                  {selectedTicket.attachment_url && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-navy-850 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-copper" />
                      <a href={selectedTicket.attachment_url} target="_blank" rel="noreferrer" className="text-[10px] text-copper font-bold hover:underline">
                        View Attached Resource / Screenshot
                      </a>
                    </div>
                  )}
                </div>

                {/* Response Thread logs */}
                {responses.map(res => {
                  const isCurrentUser = res.user_id === profile?.id;
                  return (
                    <div 
                      key={res.id} 
                      className={`flex flex-col max-w-[85%] ${
                        isCurrentUser ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div className={`p-4.5 rounded-2xl shadow-sm text-xs leading-relaxed ${
                        isCurrentUser 
                          ? 'bg-copper text-white' 
                          : 'bg-white dark:bg-navy border border-app-border dark:border-navy-800 text-slate-700 dark:text-slate-200'
                      }`}>
                        <p className="whitespace-pre-wrap">{res.message}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 px-2 font-semibold">
                        {isCurrentUser ? 'You' : 'Success Manager'} • {new Date(res.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
                <div ref={responsesEndRef} />
              </div>

              {/* Chat Input panel */}
              {['open', 'in progress'].includes(selectedTicket.status) ? (
                <form onSubmit={handleSendResponse} className="px-5 py-4 border-t border-app-border dark:border-navy-800 bg-white dark:bg-navy flex items-center gap-3 flex-shrink-0">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Provide reply detail or operational insight..."
                    className="flex-1 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white transition-all focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingResponse || !newMessage.trim()}
                    className="p-3 bg-copper hover:bg-copper-hover disabled:opacity-50 text-white rounded-xl transition-all shadow-md flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="p-4 border-t border-app-border dark:border-navy-850 bg-slate-100/50 dark:bg-navy-950/20 text-center flex-shrink-0 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  This support ticket is resolved and closed.
                </div>
              )}
            </>
          ) : (
            <div className="text-center max-w-sm px-6">
              <LifeBuoy className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <h3 className="font-sora font-extrabold text-sm text-slate-800 dark:text-white">Incident Conversation View</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Select a ticket from the left panel to review live logs, escalation statuses, assigned manager metrics, or to converse directly with support.
              </p>
            </div>
          )}
        </div>

      </div>
      ) : (
        /* Feature Roadmap Grid */
        <div className="flex-1 overflow-y-auto min-h-0 p-6 bg-slate-50/50 dark:bg-navy-950/20 border border-app-border dark:border-navy-800 rounded-2xl shadow-card scrollbar-thin">
          <div className="max-w-4xl mx-auto mb-8 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-copper/10 border border-copper/20 rounded-full text-[10px] font-bold text-copper uppercase tracking-wider mb-3">
              🚀 Peak Roadmap
            </span>
            <h2 className="text-xl sm:text-2xl font-sora font-extrabold text-slate-900 dark:text-white leading-tight">
              SaaS Operational Feature Pipeline
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 max-w-xl mx-auto leading-relaxed">
              We build around your direct feedback. Review upcoming trade automation upgrades below. Click "Notify Me" to register your operational interest and prioritize development.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-7xl mx-auto">
            {ROADMAP_FEATURES.map((feat) => {
              const hasVoted = votedFeatures.includes(feat.name);
              const isVoting = votingLoading === feat.name;
              return (
                <div
                  key={feat.name}
                  className="bg-white dark:bg-navy border border-app-border dark:border-navy-800/80 p-5 rounded-2xl flex flex-col justify-between hover:border-copper hover:shadow-premium transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute right-0 top-0 w-24 h-24 bg-[radial-gradient(circle_at_top_right,rgba(192,120,64,0.05),transparent)] pointer-events-none" />
                  
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="bg-slate-100 dark:bg-navy-950 text-slate-500 dark:text-slate-400 px-2 py-0.5 border border-slate-200/60 dark:border-navy-850 rounded text-[9px] font-bold uppercase tracking-wider">
                        Coming Soon
                      </span>
                      {hasVoted && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 rounded-md">
                          Voted ✓
                        </span>
                      )}
                    </div>

                    <h3 className="font-sora font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-copper transition-colors leading-tight mb-2">
                      {feat.name}
                    </h3>
                    
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs leading-relaxed mb-6 font-semibold">
                      {feat.desc}
                    </p>
                  </div>

                  <button
                    onClick={() => handleVoteRoadmap(feat.name)}
                    disabled={hasVoted || isVoting}
                    className={`w-full py-2.5 rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                      hasVoted
                        ? 'bg-slate-50 dark:bg-navy-950/45 text-slate-400 dark:text-slate-600 border border-slate-200/40 dark:border-navy-900 cursor-not-allowed'
                        : 'bg-copper hover:bg-copper-hover disabled:opacity-50 text-white hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                    }`}
                  >
                    {isVoting ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : hasVoted ? (
                      <>Interested ✓</>
                    ) : (
                      <>Notify Me</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Raise Ticket Modal ──────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-premium p-6 rounded-2xl max-w-lg w-full animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-850 pb-3 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4.5 h-4.5 text-copper" />
                <h3 className="font-sora font-extrabold text-sm text-slate-900 dark:text-white">Report New Incident</h3>
              </div>
              <button 
                onClick={() => setShowNewModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin text-xs font-inter">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Subject / Brief Summary</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Summarize the core operational bottleneck"
                  className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="technical">Technical Support</option>
                    <option value="billing">Billing & Subscriptions</option>
                    <option value="bug">Report System Bug</option>
                    <option value="feature">Request Feature Upgrade</option>
                    <option value="other">General Operational Query</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Urgency SLA</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none font-bold"
                  >
                    <option value="low">Low Priority (24 Hour Response)</option>
                    <option value="medium">Medium Priority (16 Hour Response)</option>
                    <option value="high">High Priority (8 Hour Response)</option>
                    <option value="urgent">Urgent Escalation (4 Hour SLA)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Detailed Breakdown</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide precise descriptions of your issue, markup equations, or workflow targets to facilitate exact, immediate engineer guidance."
                  className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none resize-none leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Attach Resource Link / Screenshot URL</label>
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="Paste secure link to image, logs, or pricing document"
                  className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 focus:border-copper rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 dark:bg-navy-950/45 border border-slate-200 dark:border-navy-850 p-3 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4.5 h-4.5 text-copper mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  All requests sync immediately with our on-call developer engineering queue. Review response statuses live in your support thread.
                </p>
              </div>

              <button
                type="submit"
                disabled={creatingTicket}
                className="w-full py-3.5 bg-copper hover:bg-copper-hover disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-1.5 flex-shrink-0"
              >
                {creatingTicket ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    Commit Support Ticket
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
