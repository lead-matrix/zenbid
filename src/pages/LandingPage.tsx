import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle, X, Zap, Star, Shield,
  ChevronRight, Play, TrendingUp, Clock, Smartphone,
  FileText, Users, Award, BarChart3, Camera, Hammer,
  MousePointer, Pen, Trophy, Plus, Minus
} from 'lucide-react';
import { supabase } from '../api/supabase';
import { toast } from 'sonner';

/* ─── Brand Logo ─────────────────────────────────────────────── */
function PeakLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="#0F172A"/>
      <polygon points="32,8 6,56 58,56" fill="none" stroke="#C58B5C" strokeWidth="2.5" strokeLinejoin="round"/>
      <polyline points="18,50 26,28 32,40 38,28 46,50" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="36" y1="16" x2="52" y2="30" stroke="#C58B5C" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="52" cy="30" r="3" fill="#C58B5C"/>
    </svg>
  );
}

/* ─── Animated Counter ───────────────────────────────────────── */
function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1800;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) { setCount(target); clearInterval(timer); }
          else setCount(Math.floor(current));
        }, duration / steps);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

/* ─── Live Proposal Simulator ────────────────────────────────── */
function ProposalSimulator() {
  const [selectedTier, setSelectedTier] = useState<'good' | 'better' | 'best'>('better');
  const [upsell1, setUpsell1] = useState(false);
  const [upsell2, setUpsell2] = useState(false);
  const [showFinancing, setShowFinancing] = useState(false);

  interface SimulatorTier {
    label: string;
    price: number;
    color: string;
    ring: string;
    desc: string;
    popular?: boolean;
  }

  const tiers: Record<'good' | 'better' | 'best', SimulatorTier> = {
    good:   { label: 'Good',   price: 8800,  color: 'from-slate-600 to-slate-800',   ring: 'ring-slate-400', desc: 'Essential coverage, standard materials' },
    better: { label: 'Better', price: 13500, color: 'from-amber-600 to-orange-700',  ring: 'ring-amber-400', desc: 'Premium materials + 5-yr warranty', popular: true },
    best:   { label: 'Best',   price: 19800, color: 'from-violet-600 to-indigo-700', ring: 'ring-violet-400', desc: 'Elite materials + 10-yr + priority service' },
  };

  const base = tiers[selectedTier].price;
  const total = base + (upsell1 ? 1200 : 0) + (upsell2 ? 2400 : 0);
  const monthly = Math.round((total * (1 + (9.99 / 100 / 12) * 60) / 60));

  return (
    <div className="w-full max-w-lg mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      {/* Proposal header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-copper/20 flex items-center justify-center">
            <PeakLogo size={20} />
          </div>
          <div>
            <div className="text-white text-xs font-bold font-sora">Smith Electric LLC</div>
            <div className="text-white/40 text-[10px]">Panel Upgrade Proposal · 3 options</div>
          </div>
        </div>
        <div className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold">
          ● Live Preview
        </div>
      </div>

      {/* Tier selector */}
      <div className="p-4 grid grid-cols-3 gap-2">
        {(Object.entries(tiers) as [keyof typeof tiers, SimulatorTier][]).map(([key, t]) => (
          <button
            key={key}
            onClick={() => setSelectedTier(key)}
            className={`relative rounded-2xl p-3 border-2 transition-all duration-200 text-left ${
              selectedTier === key
                ? `bg-gradient-to-br ${t.color} border-transparent shadow-lg scale-[1.02]`
                : 'bg-white/5 border-white/10 hover:border-white/20'
            }`}
          >
            {'popular' in t && t.popular && selectedTier === key && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                ⭐ Popular
              </div>
            )}
            <div className="text-white font-bold text-xs font-sora">{t.label}</div>
            <div className="text-white/70 font-extrabold text-sm font-sora mt-0.5">
              ${t.price.toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="px-4 pb-3">
        <p className="text-white/50 text-[11px] font-inter">{tiers[selectedTier].desc}</p>
      </div>

      {/* Upsells */}
      <div className="px-4 pb-3 space-y-2">
        <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1">Optional Add-ons</div>
        {[
          { label: 'Surge Protection Package', price: 1200, state: upsell1, toggle: () => setUpsell1(p => !p) },
          { label: 'Extended 10-Year Warranty', price: 2400, state: upsell2, toggle: () => setUpsell2(p => !p) },
        ].map(u => (
          <button
            key={u.label}
            onClick={u.toggle}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
              u.state
                ? 'bg-copper/20 border-copper/40 text-white'
                : 'bg-white/5 border-white/10 hover:border-white/20 text-white/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors ${u.state ? 'bg-copper border-copper' : 'border-white/30'}`}>
                {u.state && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs font-medium">{u.label}</span>
            </div>
            <span className="text-xs font-bold text-copper">+${u.price.toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Total & financing */}
      <div className="mx-4 mb-4 p-4 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/60 text-xs">Total Investment</span>
          <button
            onClick={() => setShowFinancing(p => !p)}
            className="text-[10px] text-copper hover:text-copper/80 font-semibold transition-colors"
          >
            {showFinancing ? 'Show total' : '💳 Show monthly'}
          </button>
        </div>
        {showFinancing ? (
          <div>
            <div className="text-2xl font-extrabold text-white font-sora">${monthly}/mo</div>
            <div className="text-white/40 text-[10px] mt-0.5">60 months @ 9.99% APR · Total ${total.toLocaleString()}</div>
          </div>
        ) : (
          <div className="text-2xl font-extrabold text-white font-sora">${total.toLocaleString()}</div>
        )}
        <button className="mt-3 w-full py-2.5 bg-copper hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5">
          <Pen className="w-3.5 h-3.5" /> Approve & Sign Now
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('waitlist').insert({
      email: email.trim().toLowerCase(),
      name: name.trim() || null,
      trade: trade || null,
    });
    if (error) {
      if (error.code === '23505') { toast.info("You're already on the list!"); setJoined(true); }
      else toast.error('Something went wrong. Please try again.');
    } else {
      setJoined(true);
      toast.success("You're on the list! We'll reach out personally.");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#060B14] text-white font-inter overflow-x-hidden scroll-smooth selection:bg-copper/20 selection:text-copper">

      {/* ── SEO Meta (injected by index.html) ── */}

      {/* ── NAV ──────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-[#060B14]/90 border-b border-white/5 backdrop-blur-xl shadow-2xl' : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PeakLogo size={32} />
            <span className="font-sora font-bold text-base text-white hidden sm:block">
              Peak<span className="text-copper">Estimator</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="text-sm text-white/60 hover:text-white transition-colors px-3 py-2 hidden sm:block"
            >
              Sign In
            </Link>
            <button
              onClick={() => setShowDemoModal(true)}
              className="bg-copper hover:bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5"
            >
              Book Demo <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Background layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#060B14] via-[#0D1526] to-[#060B14]" />
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-copper/8 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/8 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full py-20 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[11px] font-semibold text-copper uppercase tracking-widest mb-8">
                <Zap className="w-3 h-3" /> Modern Proposal Platform for Contractors
              </div>

              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-sora font-extrabold leading-[1.08] tracking-tight mb-6">
                Modern Proposals<br />
                That Help Contractors<br />
                <span className="bg-gradient-to-r from-copper to-amber-400 bg-clip-text text-transparent">
                  Win More Jobs.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-white/60 leading-relaxed max-w-xl mb-10">
                Create beautiful estimates, present Good&nbsp;/&nbsp;Better&nbsp;/&nbsp;Best options, and deliver a homeowner experience that closes jobs faster — before you leave the driveway.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <button
                  id="hero-book-demo-btn"
                  onClick={() => setShowDemoModal(true)}
                  className="inline-flex items-center justify-center gap-2 bg-copper hover:bg-amber-600 text-white font-bold text-base px-7 py-4 rounded-xl transition-all shadow-xl shadow-copper/20 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Book Demo <ArrowRight className="w-5 h-5" />
                </button>
                <a
                  href="#simulator"
                  id="hero-view-proposal-btn"
                  className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 text-white font-bold text-base px-7 py-4 rounded-xl border border-white/10 transition-all"
                >
                  <Play className="w-4 h-4 text-copper" /> View Interactive Proposal
                </a>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['🧑‍🔧','👷','🧑‍💼','👩‍🔧'].map((e, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border-2 border-[#060B14] flex items-center justify-center text-sm">{e}</div>
                  ))}
                </div>
                <div className="text-sm text-white/50">
                  <span className="text-white font-semibold">500+</span> contractors closing more jobs
                </div>
              </div>
            </div>

            {/* Hero Visual – Live Simulator */}
            <div id="simulator" className="flex justify-center">
              <ProposalSimulator />
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST METRICS STRIP ──────────────────────────────── */}
      <section className="py-12 border-y border-white/5 bg-white/[0.02] backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: 40, suffix: '%', label: 'Higher Close Rate', icon: TrendingUp },
              { value: 5,  suffix: 'min', prefix: '<', label: 'Estimate Creation', icon: Clock },
              { value: 35, suffix: '%', label: 'Larger Avg. Ticket', icon: BarChart3 },
              { value: 94, suffix: '%', label: 'Homeowner Engagement', icon: Users },
            ].map(({ value, suffix, prefix = '', label, icon: Icon }) => (
              <div key={label} className="group">
                <div className="flex items-center justify-center mb-2">
                  <Icon className="w-4 h-4 text-copper opacity-60" />
                </div>
                <div className="text-3xl sm:text-4xl font-sora font-extrabold text-white mb-1">
                  <AnimatedCounter target={value} suffix={suffix} prefix={prefix} />
                </div>
                <div className="text-xs text-white/40 font-medium uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY CONTRACTORS SWITCH ────────────────────────────── */}
      <section className="py-24 sm:py-32 relative overflow-hidden bg-[#080D1A]">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-copper/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[11px] text-white/60 font-semibold uppercase tracking-widest mb-5">
              Why Contractors Switch
            </div>
            <h2 className="text-3xl sm:text-4xl font-sora font-extrabold text-white mb-4">
              A New Standard for <span className="text-copper">Contractor Proposals</span>
            </h2>
            <p className="text-white/50 text-base max-w-xl mx-auto">The gap between winning and losing a job is often the first impression — your proposal.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Old way */}
            <div className="rounded-3xl border border-red-900/30 bg-red-950/10 p-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-red-900/40 flex items-center justify-center">
                  <X className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Traditional Software</span>
              </div>
              <ul className="space-y-3.5">
                {[
                  'Generic PDFs that look like 2005',
                  'One price, take it or leave it',
                  'Slow to build, slow to send',
                  'Complex setup and training',
                  'Operations-heavy, sales-weak',
                  'No homeowner engagement metrics',
                  'Clients wait 2-3 days for a quote',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/50">
                    <X className="w-4 h-4 text-red-500/60 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* PeakEstimator */}
            <div className="rounded-3xl border border-copper/20 bg-gradient-to-br from-copper/8 to-amber-500/5 p-8 relative overflow-hidden">
              <div className="absolute top-3 right-3 bg-copper text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                PeakEstimator
              </div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-copper/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-copper" />
                </div>
                <span className="text-sm font-bold text-copper uppercase tracking-wider">Modern Approach</span>
              </div>
              <ul className="space-y-3.5">
                {[
                  'Interactive web proposals on any device',
                  'Good / Better / Best option tiers',
                  'Estimate done in under 5 minutes',
                  'Up and running in an afternoon',
                  'Built purely for winning more jobs',
                  'Real-time homeowner engagement alerts',
                  'Clients approve the same day',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white">
                    <CheckCircle className="w-4 h-4 text-copper shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOMEOWNER EXPERIENCE ──────────────────────────────── */}
      <section className="py-24 sm:py-32 bg-[#060B14] relative overflow-hidden">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/6 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            {/* Mobile phone mockup */}
            <div className="flex justify-center order-2 lg:order-1">
              <div className="relative">
                {/* Glow */}
                <div className="absolute inset-0 bg-copper/15 rounded-[3rem] blur-2xl scale-95" />
                {/* Phone shell */}
                <div className="relative w-64 bg-[#0D1526] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                  <div className="bg-[#0A1020] px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <div className="text-white/70 text-xs font-semibold font-sora">Your Proposal</div>
                    <div className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full">● Open</div>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Tier badges */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { l: 'Good', p: '$8,800', c: 'bg-slate-700' },
                        { l: 'Better', p: '$13,500', c: 'bg-copper', sel: true },
                        { l: 'Best', p: '$19,800', c: 'bg-violet-700' },
                      ].map(t => (
                        <div key={t.l} className={`${t.c} rounded-xl p-2 text-center ${t.sel ? 'ring-2 ring-amber-400 scale-105' : 'opacity-60'}`}>
                          <div className="text-[9px] text-white font-bold">{t.l}</div>
                          <div className="text-[10px] text-white font-extrabold mt-0.5">{t.p}</div>
                        </div>
                      ))}
                    </div>
                    {/* Items */}
                    {['200A Panel Upgrade', 'AFCI Breakers x12', 'Permit & Inspection'].map(item => (
                      <div key={item} className="flex items-center gap-2 text-[10px] text-white/70">
                        <CheckCircle className="w-3 h-3 text-copper shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                    {/* Financing */}
                    <div className="bg-copper/15 rounded-xl p-3 border border-copper/20">
                      <div className="text-[9px] text-copper font-bold uppercase tracking-wider mb-1">Financing Available</div>
                      <div className="text-white font-extrabold text-sm">$228/mo</div>
                      <div className="text-white/40 text-[9px]">60 months @ 9.99% APR</div>
                    </div>
                    {/* Sign button */}
                    <button className="w-full bg-copper text-white text-[11px] font-bold py-2.5 rounded-xl flex items-center justify-center gap-1">
                      <Pen className="w-3 h-3" /> Approve & Sign
                    </button>
                    <div className="text-[9px] text-white/30 text-center">Homeowner signs digitally in seconds</div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -right-8 top-16 bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-xl rotate-6">
                  ✓ Signed!
                </div>
                <div className="absolute -left-10 bottom-20 bg-[#0D1526] border border-white/10 text-[10px] px-3 py-2 rounded-xl shadow-xl -rotate-3">
                  <div className="text-white/60 text-[9px]">Notification</div>
                  <div className="text-white font-semibold">🎉 Proposal approved</div>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[11px] text-white/60 font-semibold uppercase tracking-widest mb-6">
                <Smartphone className="w-3 h-3" /> Homeowner Experience
              </div>
              <h2 className="text-3xl sm:text-4xl font-sora font-extrabold text-white mb-5 leading-tight">
                Your Proposal Is<br />
                <span className="text-copper">Your Salesperson.</span>
              </h2>
              <p className="text-white/60 text-base leading-relaxed mb-8">
                Homeowners don't open PDF attachments. They open a beautiful, interactive web page on their phone — where they can compare options, toggle add-ons, see financing, and sign digitally in seconds.
              </p>
              <ul className="space-y-4">
                {[
                  { icon: MousePointer, title: 'Interactive Option Selection', desc: 'Homeowners choose between tiers instead of negotiating price' },
                  { icon: BarChart3, title: 'Live Financing Preview', desc: 'Monthly payment estimates reduce sticker shock and increase close rates' },
                  { icon: Pen, title: 'Digital Signature in One Tap', desc: 'No paperwork, no back-and-forth — the signature comes to you' },
                  { icon: Zap, title: 'Instant Approval Notifications', desc: 'Know the moment they approve so you can lock in the schedule' },
                ].map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-copper/15 border border-copper/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-copper" />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm mb-0.5">{title}</div>
                      <div className="text-white/50 text-xs leading-relaxed">{desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── WORKFLOW ──────────────────────────────────────────── */}
      <section className="py-24 sm:py-32 bg-[#080D1A]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[11px] text-white/60 font-semibold uppercase tracking-widest mb-5">
              <Clock className="w-3 h-3" /> Workflow
            </div>
            <h2 className="text-3xl sm:text-4xl font-sora font-extrabold text-white mb-4">
              From Inspection to Approval<br />
              <span className="text-copper">in Minutes.</span>
            </h2>
            <p className="text-white/50 text-base max-w-lg mx-auto">The entire sales cycle — from walking the job to collecting a signature — happens faster than your competitor sends a quote.</p>
          </div>

          {/* Workflow steps */}
          <div className="relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-copper/30 to-transparent z-0" />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
              {[
                { icon: Camera, step: '01', title: 'Take Photos', desc: 'Document the job on-site', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
                { icon: FileText, step: '02', title: 'Build Estimate', desc: 'Tap items from your price book', color: 'text-copper', bg: 'bg-copper/10 border-copper/20' },
                { icon: Star, step: '03', title: 'Present Options', desc: 'Good / Better / Best tiers', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
                { icon: MousePointer, step: '04', title: 'Client Approves', desc: 'Digital signature on their phone', color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/20' },
                { icon: Trophy, step: '05', title: 'Job Won', desc: 'Notification + job locked in', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
              ].map(({ icon: Icon, step, title, desc, color, bg }, i) => (
                <div key={step} className="flex flex-col items-center text-center group">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border ${bg} flex items-center justify-center mb-4 transition-transform group-hover:-translate-y-1 duration-300 shadow-lg`}>
                    <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${color}`} />
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${color} mb-1`}>Step {step}</div>
                  <div className="text-white font-bold text-sm mb-1 font-sora">{title}</div>
                  <div className="text-white/40 text-xs leading-relaxed">{desc}</div>
                  {i < 4 && (
                    <div className="md:hidden mt-3 text-white/20">
                      <ChevronRight className="w-4 h-4 mx-auto rotate-90" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-3 text-sm text-emerald-300 font-semibold">
              <Trophy className="w-4 h-4" /> Average time from site visit to signature: <strong className="text-emerald-200 ml-1">under 8 minutes</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ── GOOD / BETTER / BEST FEATURE ──────────────────────── */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#060B14] to-[#0A0F1E]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-copper/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[11px] text-white/60 font-semibold uppercase tracking-widest mb-5">
              <BarChart3 className="w-3 h-3" /> The Close Rate Secret
            </div>
            <h2 className="text-3xl sm:text-4xl font-sora font-extrabold text-white mb-5 leading-tight">
              Give Homeowners Options Instead<br />
              <span className="text-copper">of One Expensive Number.</span>
            </h2>
            <p className="text-white/50 text-base max-w-2xl mx-auto">
              When you present a single quote, homeowners compare you to competitors. When you present three tiers, they compare your options to each other — and almost always pick the middle one.
            </p>
          </div>

          {/* Tier cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              {
                tier: 'Good', icon: Shield, price: '$8,800', gradient: 'from-slate-600 to-slate-800',
                badge: null, features: ['Standard materials', '1-year workmanship warranty', 'Basic permit filing', 'Standard timeline'],
              },
              {
                tier: 'Better', icon: Star, price: '$13,500', gradient: 'from-amber-600 to-orange-700',
                badge: '⭐ Most Selected', features: ['Premium materials', '5-year warranty', 'Priority scheduling', 'Dedicated contact', 'Financing available'],
                highlight: true,
              },
              {
                tier: 'Best', icon: Zap, price: '$19,800', gradient: 'from-violet-600 to-indigo-700',
                badge: null, features: ['Elite materials', '10-year warranty', 'Same-week scheduling', 'White-glove service', 'Surge protection included'],
              },
            ].map(({ tier, icon: Icon, price, gradient, badge, features, highlight }) => (
              <div
                key={tier}
                className={`relative rounded-3xl overflow-hidden border transition-all duration-300 hover:-translate-y-1 ${
                  highlight
                    ? 'border-copper/40 shadow-xl shadow-copper/10 scale-[1.02]'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {badge && (
                  <div className="bg-copper text-white text-[10px] font-black text-center py-2 tracking-widest uppercase">
                    {badge}
                  </div>
                )}
                <div className={`bg-gradient-to-br ${gradient} px-6 pt-6 pb-8`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-5 h-5 text-white/70" />
                    <span className="text-white/70 text-xs font-bold uppercase tracking-widest">{tier}</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white font-sora">{price}</div>
                </div>
                <div className="bg-[#0D1526] p-6">
                  <ul className="space-y-2.5">
                    {features.map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Benefit callouts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: TrendingUp, stat: '+35%', label: 'Larger average ticket', desc: 'Upsells and premium tiers naturally lift your project value' },
              { icon: MousePointer, stat: '+40%', label: 'Higher close rate', desc: 'Homeowners say yes faster when they choose, not react' },
              { icon: Users, stat: '94%', label: 'Engagement rate', desc: 'Clients actually read and interact with your proposal' },
            ].map(({ icon: Icon, stat, label, desc }) => (
              <div key={label} className="bg-white/3 border border-white/8 rounded-2xl p-6 text-center hover:bg-white/5 transition-colors">
                <Icon className="w-6 h-6 text-copper mx-auto mb-3" />
                <div className="text-2xl font-extrabold text-white font-sora mb-1">{stat}</div>
                <div className="text-sm font-bold text-white mb-1">{label}</div>
                <div className="text-xs text-white/40 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SIMPLE SETUP ─────────────────────────────────────── */}
      <section className="py-24 sm:py-32 bg-[#080D1A]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[11px] text-white/60 font-semibold uppercase tracking-widest mb-5">
              <Hammer className="w-3 h-3" /> Setup
            </div>
            <h2 className="text-3xl sm:text-4xl font-sora font-extrabold text-white mb-4">
              Start Sending Modern Proposals<br />
              <span className="text-copper">Without Enterprise Complexity.</span>
            </h2>
            <p className="text-white/50 text-base max-w-xl mx-auto">No IT team needed. No 3-month onboarding. Just upload your logo and you're closing jobs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { num: '1', icon: Award, title: 'Add Your Branding', desc: 'Upload your logo in 30 seconds. Your proposals instantly look like yours — not a template.', time: '30 seconds' },
              { num: '2', icon: FileText, title: 'Load Your Pricing', desc: 'Import from your spreadsheet or use our 93+ pre-loaded trade price book items. No manual typing.', time: '5 minutes' },
              { num: '3', icon: Trophy, title: 'Send & Win Jobs', desc: 'Tap to build an estimate from any job site. Send the link. Collect the signature.', time: 'Under 5 min' },
            ].map(({ num, icon: Icon, title, desc, time }) => (
              <div key={num} className="relative bg-white/3 border border-white/8 rounded-3xl p-8 hover:bg-white/5 hover:border-white/15 transition-all hover:-translate-y-1 group">
                <div className="w-12 h-12 rounded-2xl bg-copper/15 border border-copper/20 flex items-center justify-center mb-5 group-hover:bg-copper/25 transition-colors">
                  <Icon className="w-5 h-5 text-copper" />
                </div>
                <div className="text-5xl font-sora font-extrabold text-white/5 absolute top-6 right-6">{num}</div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-3">
                  <Clock className="w-3 h-3" /> {time}
                </div>
                <h3 className="text-white font-bold text-base font-sora mb-2">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="py-24 sm:py-32 bg-[#060B14] relative overflow-hidden">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[400px] h-[600px] bg-copper/4 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[11px] text-white/60 font-semibold uppercase tracking-widest mb-5">
              <Users className="w-3 h-3" /> Contractor Stories
            </div>
            <h2 className="text-3xl sm:text-4xl font-sora font-extrabold text-white mb-4">
              Contractors Are <span className="text-copper">Closing More Jobs.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Mike R.', trade: '⚡ Electrical', location: 'Phoenix, AZ',
                quote: 'Clients immediately noticed the difference. We sent our first PeakEstimator proposal and the homeowner called back same day to approve. That never happened with our old PDFs.',
                result: '+38% close rate',
              },
              {
                name: 'Sarah K.', trade: '🏠 Roofing', location: 'Denver, CO',
                quote: 'We started closing higher-ticket jobs. The Better tier upgrade happens almost automatically — homeowners just pick it because it looks so compelling. Our average ticket jumped $4K.',
                result: '$4,200 avg ticket increase',
                highlight: true,
              },
              {
                name: 'James T.', trade: '❄️ HVAC', location: 'Dallas, TX',
                quote: 'Way easier than our previous system. I trained my whole team in an afternoon. Now we send proposals from the truck before we even drive away. It pays for itself every week.',
                result: 'Setup in under an hour',
              },
            ].map(({ name, trade, location, quote, result, highlight }) => (
              <div
                key={name}
                className={`rounded-3xl p-7 border transition-all hover:-translate-y-1 ${
                  highlight
                    ? 'bg-gradient-to-br from-copper/10 to-amber-500/5 border-copper/25 shadow-xl shadow-copper/8'
                    : 'bg-white/3 border-white/8 hover:border-white/15 hover:bg-white/5'
                }`}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-white/80 text-sm leading-relaxed mb-6 italic">"{quote}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold text-sm">{name}</div>
                    <div className="text-white/40 text-xs">{trade} · {location}</div>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1.5 rounded-lg text-right">
                    {result}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D1526] via-[#111827] to-[#0D1526]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-copper/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-copper/15 border border-copper/25 rounded-full px-5 py-2 text-copper text-xs font-bold uppercase tracking-widest mb-8">
            <Trophy className="w-3.5 h-3.5" /> Join 500+ Winning Contractors
          </div>

          <h2 className="text-4xl sm:text-5xl xl:text-6xl font-sora font-extrabold text-white mb-6 leading-[1.08] tracking-tight">
            Win More Jobs With a Proposal<br />
            <span className="bg-gradient-to-r from-copper to-amber-400 bg-clip-text text-transparent">
              Experience Homeowners Remember.
            </span>
          </h2>

          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Modern estimating and proposal workflows built for contractors who want to stand out, close faster, and grow their average ticket.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button
              id="final-book-demo-btn"
              onClick={() => setShowDemoModal(true)}
              className="inline-flex items-center justify-center gap-2 bg-copper hover:bg-amber-600 text-white font-bold text-base px-8 py-4 rounded-xl transition-all shadow-2xl shadow-copper/25 hover:-translate-y-0.5 active:translate-y-0"
            >
              Book Demo <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#simulator"
              id="final-view-proposal-btn"
              className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 text-white font-bold text-base px-8 py-4 rounded-xl border border-white/10 transition-all"
            >
              <Play className="w-4 h-4 text-copper" /> See Interactive Proposal
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            {['No setup fees', 'Mobile-first', 'Up and running today', 'Cancel anytime'].map(item => (
              <span key={item} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#060B14] py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <PeakLogo size={30} />
              <div>
                <div className="text-sm font-sora font-bold text-white">Peak<span className="text-copper">Estimator</span></div>
                <div className="text-xs text-white/30">Modern proposals. More closed jobs.</div>
              </div>
            </div>
            <div className="text-white/25 text-xs">© {new Date().getFullYear()} PeakEstimator. All rights reserved.</div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-xs text-white/40 hover:text-white transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ── BOOK DEMO / WAITLIST MODAL ────────────────────────── */}
      {showDemoModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={e => { if (e.target === e.currentTarget) setShowDemoModal(false); }}
        >
          <div className="bg-[#0D1526] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-7 py-5 border-b border-white/8 flex items-center justify-between">
              <div>
                <div className="text-white font-bold font-sora text-lg">Book Your Demo</div>
                <div className="text-white/40 text-xs mt-0.5">We'll reach out personally within 24 hours</div>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="p-2 rounded-xl hover:bg-white/8 text-white/40 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-7">
              {joined ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">🎉</div>
                  <h3 className="text-xl font-sora font-extrabold text-white mb-3">You're in!</h3>
                  <p className="text-white/50 text-sm leading-relaxed">We'll reach out personally within 24 hours to schedule your walkthrough. Keep building great work!</p>
                </div>
              ) : (
                <form onSubmit={handleWaitlist} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">Your Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Mike Johnson"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white placeholder-white/25 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-copper/50 focus:border-copper/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">Work Email <span className="text-copper">*</span></label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="mike@yourcompany.com"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white placeholder-white/25 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-copper/50 focus:border-copper/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">Your Trade</label>
                    <select
                      value={trade}
                      onChange={e => setTrade(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-copper/50 focus:border-copper/40 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-slate-900">Select your trade…</option>
                      <option value="electrical" className="bg-slate-900">⚡ Electrical</option>
                      <option value="roofing" className="bg-slate-900">🏠 Roofing</option>
                      <option value="hvac" className="bg-slate-900">❄️ HVAC</option>
                      <option value="painting" className="bg-slate-900">🎨 Painting</option>
                      <option value="plumbing" className="bg-slate-900">🔧 Plumbing</option>
                      <option value="drain" className="bg-slate-900">🚿 Drain & Sewer</option>
                      <option value="general" className="bg-slate-900">🏗️ General Contracting</option>
                    </select>
                  </div>
                  <button
                    id="demo-submit-btn"
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-copper hover:bg-amber-600 text-white font-bold text-base rounded-xl transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                  >
                    {submitting ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting…</>
                    ) : (
                      <>Book My Demo <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                  <div className="flex items-center justify-center gap-4 pt-1 flex-wrap">
                    {['No spam', 'Personal onboarding', 'Cancel anytime'].map(t => (
                      <span key={t} className="flex items-center gap-1 text-[11px] text-white/30">
                        <CheckCircle className="w-3 h-3 text-white/30" /> {t}
                      </span>
                    ))}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Corner watermark ──────────────────────────────────── */}
      <div style={{ position:'fixed', bottom:'14px', right:'18px', opacity:0.22, zIndex:9999, pointerEvents:'none',
        transform:'rotate(-1.5deg)', fontFamily:"'Courier New', Courier, monospace", fontSize:'10px',
        fontStyle:'italic', letterSpacing:'0.08em', color:'#C58B5C', lineHeight:1.4, textAlign:'right', userSelect:'none' }}>
        <span style={{ display:'block', fontSize:'7px', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:'2px', color:'#D9A679' }}>built by</span>
        MAHMUD R B
      </div>
    </div>
  );
}
