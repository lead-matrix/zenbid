import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, CheckCircle, Mountain, Zap, FileText, Phone, Shield, TrendingUp, Clock, Twitter, Linkedin } from 'lucide-react';
import { supabase } from '../api/supabase';
import { toast } from 'sonner';

const TRADES = ['⚡ Electrical','🏠 Roofing','❄️ HVAC','🎨 Painting','🔧 Plumbing','🚿 Drain & Sewer','🏗️ General'];

const FEATURES = [
  { icon: <FileText className="w-5 h-5" />, title: 'Pre-Loaded Trade Price Books', desc: '93+ items across 7 trades ready on day one. Tap to build — no typing, no guessing, no spreadsheets.' },
  { icon: <TrendingUp className="w-5 h-5" />, title: 'Profit Built Into Every Bid', desc: 'Configure your overhead once per trade. PeakEstimator locks in your margins automatically, every single time.' },
  { icon: <Phone className="w-5 h-5" />, title: 'Branded Mobile Proposals', desc: 'Clients open a clean, professional proposal on their phone — not a PDF attachment buried in email.' },
  { icon: <Zap className="w-5 h-5" />, title: 'Signature Comes to You', desc: "The moment a client approves, you're notified. No chasing. No callbacks. No guessing." },
  { icon: <Clock className="w-5 h-5" />, title: 'Built for the Truck', desc: 'Walk the job, build the bid, send the link — all in under 5 minutes before you pull out of the driveway.' },
  { icon: <Shield className="w-5 h-5" />, title: 'Your Pricing Stays Yours', desc: 'Bank-grade encryption. Your rates, your clients, your margins — never shared, never sold, never visible to anyone else.' },
];

// Logo mark component
function PeakLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="#1C2B5C"/>
      <polygon points="32,8 6,56 58,56" fill="none" stroke="#C07840" strokeWidth="2.5" strokeLinejoin="round"/>
      <polyline points="18,50 26,28 32,40 38,28 46,50" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="36" y1="16" x2="52" y2="30" stroke="#C07840" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="52" cy="30" r="3" fill="#C07840"/>
    </svg>
  );
}

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
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

  const shareText = encodeURIComponent('Just discovered PeakEstimator — professional contractor bids in under 5 minutes. Invite-only. Worth a look:');
  const shareUrl  = encodeURIComponent('https://lmtrx.us');

  return (
    <div className="min-h-screen bg-white font-inter overflow-x-hidden">

      {/* ── NAV ──────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-100' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PeakLogo size={34} />
            <span className="font-bold text-lg text-slate-900 hidden sm:block">
              Peak<span className="text-copper-600">Estimator</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors px-3 py-2">
              Member Sign In
            </Link>
            <a href="#waitlist" className="bg-copper-500 hover:bg-copper-600 text-white text-sm font-semibold px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all shadow-copper hover:-translate-y-0.5 whitespace-nowrap">
              Get Early Access
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="pt-24 pb-20 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #0A1024 0%, #1C2B5C 45%, #0F1A3A 100%)' }}>
        {/* Ambient glows */}
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-copper-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-navy-600/20 rounded-full blur-3xl pointer-events-none" />
        {/* Mountain silhouette */}
        <svg className="absolute bottom-0 left-0 right-0 w-full opacity-5 pointer-events-none" viewBox="0 0 1440 200" preserveAspectRatio="none">
          <polygon points="0,200 360,40 720,120 1080,20 1440,200" fill="white"/>
        </svg>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative">
          <div className="inline-flex items-center gap-2 bg-copper-500/20 border border-copper-400/30 rounded-full px-4 py-1.5 text-copper-300 text-sm font-semibold mb-8 animate-slide-up">
            <Lock className="w-3.5 h-3.5" />
            Invite-Only Platform · Waitlist Now Open
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white leading-[1.05] mb-6 tracking-tight animate-slide-up">
            The Bid You Build in{' '}
            <span className="relative inline-block">
              <span style={{ background: 'linear-gradient(135deg, #D2914C, #C07840)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                5 Minutes
              </span>
            </span>
            <br className="hidden sm:block" />
            {' '}Wins the Job They Quoted in 2 Days.
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            PeakEstimator auto-populates professional estimates from your pre-loaded trade price book.
            Send a branded client link. Collect a digital signature{' '}
            <strong className="text-white">before you're back in the truck.</strong>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <a href="#waitlist" id="hero-cta-btn" className="inline-flex items-center gap-2.5 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-xl hover:-translate-y-1 w-full sm:w-auto justify-center" style={{ background: 'linear-gradient(135deg, #C07840, #D2914C)' }}>
              Request Early Access <ArrowRight className="w-5 h-5" />
            </a>
            <Link to="/login" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">
              Already a member? Sign in →
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {TRADES.map(t => (
              <span key={t} className="bg-white/8 border border-white/10 text-white/70 text-xs sm:text-sm px-3 py-1.5 rounded-full backdrop-blur-sm">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ─────────────────────────────────── */}
      <section className="py-8 bg-navy-600 border-y border-navy-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { val: '93+', label: 'Price Book Items' },
            { val: '7',   label: 'Trades Covered' },
            { val: '<5m', label: 'Avg. Bid Time' },
            { val: '100%', label: 'Mobile-Optimized' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl sm:text-3xl font-black text-copper-400">{s.val}</div>
              <div className="text-xs text-slate-300 mt-1 font-medium uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── THE PRECISION EDGE ──────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-copper-100 text-copper-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
              The Precision Edge
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 leading-tight">
              Your Work Is Elite.<br />
              <span style={{ background: 'linear-gradient(135deg, #C07840, #D2914C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Your Proposals Should Match.
              </span>
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Homeowners can't evaluate craftsmanship until the job is done. They evaluate your proposal the second it lands. A polished, professional bid — sent in minutes — signals quality before a single nail is driven.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { num: '01', heading: 'First Impression Is Everything', body: 'The contractor with the cleaner proposal wins — even when their price is higher. Perception is the pitch.' },
              { num: '02', heading: 'Speed Signals Confidence', body: 'When your estimate lands in 5 minutes and theirs takes 3 days, clients already know who runs a tighter operation.' },
              { num: '03', heading: 'Margins Don\'t Lie', body: 'Guessing your markup on a $40K job can cost you $8K in a single miscalculation. Precision protects your profit.' },
            ].map(item => (
              <div key={item.num} className="bg-white rounded-3xl p-7 border border-slate-100 shadow-card hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-4xl font-black text-copper-200 mb-3">{item.num}</div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{item.heading}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-navy-50 text-navy-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
              Three Steps. One Signed Contract.
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">Walk the Job. Send the Link. Cash the Check.</h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">The entire process from walkthrough to approved proposal — under 5 minutes.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', emoji: '🔨', title: 'Walk the Job, Not a Spreadsheet', desc: 'Your pre-loaded trade price book has 93+ items ready. Tap to add materials and labor — no typing, no guessing, no back-office.' },
              { step: '02', emoji: '📱', title: 'Send a Link, Not a PDF', desc: 'One tap. Your client gets a clean, branded proposal on their phone. They can read it, review it, and sign it right there.' },
              { step: '03', emoji: '✅', title: 'The Signature Comes to You', desc: 'The moment they approve, your dashboard lights up. The job is locked. Drive to the next one.' },
            ].map(item => (
              <div key={item.step} className="group relative bg-white rounded-3xl p-8 border border-slate-100 shadow-card hover:shadow-navy hover:-translate-y-1 transition-all overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(225deg, rgba(28,43,92,0.06), transparent)' }} />
                <div className="text-4xl mb-4">{item.emoji}</div>
                <div className="text-xs font-bold text-copper-500 mb-2 tracking-widest uppercase">Step {item.step}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-copper-100 text-copper-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
              What's Inside
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">Precision Built In. Profit Locked In.</h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">Not a bloated dispatching tool. A dedicated sales engine for contractors who compete at the top.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-navy-200 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all text-copper-600 group-hover:text-white" style={{ background: 'linear-gradient(135deg, #F5E4CE, #EDD4B8)' }} onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #C07840, #D2914C)'} onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #F5E4CE, #EDD4B8)'}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NOT FOR EVERYONE ────────────────────────────── */}
      <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #0A1024 0%, #1C2B5C 100%)' }}>
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '36px 36px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-48 bg-copper-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative">
          <div className="inline-flex items-center gap-2 bg-copper-500/20 border border-copper-400/30 rounded-full px-4 py-1.5 text-copper-300 text-sm font-medium mb-8">
            <Mountain className="w-3.5 h-3.5" />
            Not Built for Everyone
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6 leading-tight">
            We Handpick Every Contractor.<br />
            <span style={{ background: 'linear-gradient(135deg, #D2914C, #C07840)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              That's the Point.
            </span>
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-6">
            PeakEstimator runs on an invitation-only model because we work directly with every contractor we bring on. We dial in your price book, configure your profit margins, and stay with you until the platform is genuinely making you money.
          </p>
          <p className="text-slate-400 text-base leading-relaxed">
            This isn't a free tool with hidden upsells. It's a <strong className="text-white">paid professional platform</strong> — and every seat is earned. When your spot opens, you'll hear from us personally.
          </p>
        </div>
      </section>

      {/* ── WAITLIST ─────────────────────────────────────── */}
      <section id="waitlist" className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #C07840, #A0622C)' }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="max-w-lg mx-auto px-4 sm:px-6 relative">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">Claim Your Spot at the Top</h2>
            <p className="text-orange-100 text-lg">Tell us about your trade. We'll reach out personally when your spot is available.</p>
          </div>

          {joined ? (
            <div className="bg-white/15 border border-white/25 backdrop-blur-sm rounded-3xl p-10 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-2xl font-black text-white mb-3">You're on the list!</h3>
              <p className="text-orange-100 text-base leading-relaxed">We'll review your request and reach out personally when your spot is ready. Keep building great work — we'll be in touch.</p>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="bg-white/15 border border-white/25 backdrop-blur-sm rounded-3xl p-6 sm:p-8 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-orange-100 mb-1.5">Your Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Mike Johnson"
                  className="w-full px-4 py-3 bg-white/15 border border-white/25 text-white placeholder-orange-200/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/40 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-orange-100 mb-1.5">Work Email <span className="text-orange-200">*</span></label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="mike@yourcompany.com"
                  className="w-full px-4 py-3 bg-white/15 border border-white/25 text-white placeholder-orange-200/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/40 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-orange-100 mb-1.5">Your Trade</label>
                <select value={trade} onChange={e => setTrade(e.target.value)}
                  className="w-full px-4 py-3 bg-white/15 border border-white/25 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/40 transition-all appearance-none">
                  <option value="" className="text-slate-800">Select your trade…</option>
                  <option value="electrical" className="text-slate-800">⚡ Electrical</option>
                  <option value="roofing" className="text-slate-800">🏠 Roofing</option>
                  <option value="hvac" className="text-slate-800">❄️ HVAC</option>
                  <option value="painting" className="text-slate-800">🎨 Painting</option>
                  <option value="plumbing" className="text-slate-800">🔧 Plumbing</option>
                  <option value="drain" className="text-slate-800">🚿 Drain & Sewer</option>
                  <option value="general" className="text-slate-800">🏗️ General Contracting</option>
                </select>
              </div>
              <button id="waitlist-submit-btn" type="submit" disabled={submitting}
                className="w-full py-4 bg-white text-copper-600 font-bold text-base rounded-xl hover:bg-orange-50 transition-all shadow-xl hover:-translate-y-0.5 disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                {submitting ? (
                  <><span className="w-4 h-4 border-2 border-copper-600 border-t-transparent rounded-full animate-spin" />Submitting…</>
                ) : (
                  <>Request My Spot <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
              <div className="flex items-center justify-center gap-4 pt-1 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-orange-100"><CheckCircle className="w-3.5 h-3.5 text-white" />No spam, ever</span>
                <span className="flex items-center gap-1.5 text-xs text-orange-100"><CheckCircle className="w-3.5 h-3.5 text-white" />Personal onboarding</span>
                <span className="flex items-center gap-1.5 text-xs text-orange-100"><CheckCircle className="w-3.5 h-3.5 text-white" />Cancel anytime</span>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="py-10 border-t border-slate-100" style={{ background: '#0A1024' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <PeakLogo size={30} />
            <div>
              <div className="text-sm font-bold text-white">Peak<span className="text-copper-400">Estimator</span></div>
              <div className="text-xs text-slate-500">Precision Bidding. Global Reach.</div>
            </div>
          </div>
          <div className="text-slate-600 text-xs text-center">© {new Date().getFullYear()} PeakEstimator. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-slate-500 hover:text-white transition-colors">Member Sign In</Link>
            <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noopener noreferrer"
              className="text-slate-500 hover:text-copper-400 transition-colors" title="Share on X/Twitter">
              <Twitter className="w-4 h-4" />
            </a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`} target="_blank" rel="noopener noreferrer"
              className="text-slate-500 hover:text-copper-400 transition-colors" title="Share on LinkedIn">
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>

      {/* ── Corner watermark ─────────────────────────────── */}
      <div style={{ position:'fixed', bottom:'14px', right:'18px', opacity:0.28, zIndex:9999, pointerEvents:'none',
        transform:'rotate(-1.5deg)', fontFamily:"'Courier New', Courier, monospace", fontSize:'10px',
        fontStyle:'italic', letterSpacing:'0.08em', color:'#C07840', lineHeight:1.4, textAlign:'right', userSelect:'none' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.65')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.28')}>
        <span style={{ display:'block', fontSize:'7px', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:'2px', color:'#D2914C' }}>
          built by
        </span>
        MAHMUD R B
      </div>
    </div>
  );
}
