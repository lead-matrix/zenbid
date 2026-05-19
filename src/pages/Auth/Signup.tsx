import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

function PeakLogo({ size = 44 }: { size?: number }) {
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

export default function Signup() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'linear-gradient(160deg, #0A1024 0%, #1C2B5C 50%, #0A1024 100%)' }}>
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(28,43,92,0.4)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(192,120,64,0.12)' }} />
      </div>

      <div className="relative w-full max-w-md text-center animate-fade-in">
        <div className="inline-flex items-center justify-center mb-6">
          <PeakLogo size={54} />
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-3">Invite-Only Platform</h1>
        <p className="text-slate-300 text-base max-w-sm mx-auto mb-8 leading-relaxed">
          <span className="text-copper-400 font-semibold">PeakEstimator</span> is an elite, closed-access platform for top-tier professional contractors. Public registration is strictly disabled.
        </p>

        <div className="bg-white/6 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-left mb-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: 'rgba(192,120,64,0.15)', border: '1px solid rgba(192,120,64,0.3)', color: '#C07840' }}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base mb-1">How do I get access?</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Access is granted exclusively through our official waitlist or direct administrative invitation. When your enterprise seat is approved, you will receive a secure magic setup link directly in your inbox.
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="block w-full py-3.5 text-white text-center rounded-xl font-bold text-sm transition-all shadow-lg hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #C07840, #D2914C)' }}
          >
            Join the Official Waitlist →
          </Link>
        </div>

        <div className="text-center">
          <p className="text-slate-400 text-sm">
            Already an approved member?{' '}
            <Link to="/login" className="text-copper-400 hover:text-copper-300 font-semibold transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
