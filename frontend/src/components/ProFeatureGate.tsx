import React from 'react';
import { Lock, CheckCircle2, Zap } from 'lucide-react';

interface ProFeatureGateProps {
  title: string;
  description: string;
  onUpgrade: () => void;
}

export const ProFeatureGate: React.FC<ProFeatureGateProps> = ({ title, description, onUpgrade }) => {
  return (
    <div className="rounded-2xl p-8 border border-borderClr/40 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-center my-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-accentBrand/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl mx-auto space-y-5 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accentBrand/15 border border-accentBrand/40 text-accentBrand text-xs font-extrabold uppercase tracking-wider">
          <Lock className="w-3.5 h-3.5" />
          <span>OptionChief Pro Feature</span>
        </div>

        <h3 className="text-2xl md:text-3xl font-extrabold text-white">
          {title}
        </h3>

        <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
          {description}
        </p>

        {/* Features Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left py-2">
          {[
            "Live Regime 1:3:2 Ratio Fly Scanners",
            "Dynamic Bull & Bear Skewed Condors",
            "24/7 Real-Time Telegram Push Alerts",
            "1-Click Live Dhan & Kotak Broker Routing",
            "Continuous Background Daemon Scanning",
            "RSI Scalping Momentum Signals"
          ].map((feat, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* Pricing & CTA */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onUpgrade}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-accentBrand hover:bg-accentBrand/90 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-accentBrand/20 transition-all"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Unlock Pro Access (From ₹499/mo)</span>
          </button>

          <button
            onClick={onUpgrade}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gray-900 border border-borderClr/60 hover:border-gray-500 text-gray-300 hover:text-white font-bold text-xs transition-all"
          >
            View 6-Mo & 1-Yr Plans
          </button>
        </div>
      </div>
    </div>
  );
};
