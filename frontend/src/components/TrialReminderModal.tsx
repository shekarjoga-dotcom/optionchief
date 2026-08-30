import React from 'react';
import { 
  Sparkles, 
  Clock, 
  X, 
  ArrowRight, 
  ShieldCheck 
} from 'lucide-react';

interface TrialReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const TrialReminderModal: React.FC<TrialReminderModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-gray-950 border border-emerald-500/40 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative shadow-emerald-500/10">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
          title="Continue exploring as guest"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-4">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          <span>10 Minutes of Free Exploration</span>
        </div>

        {/* Heading */}
        <h3 className="text-xl sm:text-2xl font-black text-white leading-tight mb-2">
          Enjoying OptionChief? <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Activate Your Free Trial!
          </span>
        </h3>

        <p className="text-xs sm:text-sm text-gray-300 mb-5 leading-relaxed">
          You've been exploring our live quantitative scanners. Register now to unlock full cloud features with our <strong className="text-emerald-400">15-Day Free Trial</strong> for all new users — no credit card needed!
        </p>

        {/* Feature List */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-3.5 space-y-2.5 mb-6 text-xs text-gray-200">
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>40+ Multi-Leg Scanners:</strong> Jade Lizards, Ratio Flies, Dynamic Condors</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>Real-Time Alerts:</strong> Greek drift, IV spike & target notifications</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>1-Click Broker Execution:</strong> Seamless integration with Dhan & Kotak Neo</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>Cloud Portfolio Sync:</strong> Save strategies & track live P&L anywhere</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onOpenAuth();
            }}
            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-sm transition-all transform hover:scale-[1.01]"
          >
            <Sparkles className="w-4 h-4 text-black" />
            <span>Claim Free Trial (1-Click Google / Phone Sign Up)</span>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>

          <button
            onClick={onClose}
            className="w-full bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white font-medium py-2.5 px-4 rounded-xl border border-gray-800 text-xs transition-all"
          >
            Continue Exploring as Guest
          </button>
        </div>

        <div className="mt-4 text-center">
          <span className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            Instant access • No credit card required • Cancel anytime
          </span>
        </div>

      </div>
    </div>
  );
};
