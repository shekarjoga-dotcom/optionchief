import React from 'react';
import { useStore } from '../hooks/useStore';
import { 
  Sparkles, 
  Check, 
  ShieldCheck, 
  MessageCircle, 
  Clock, 
  X
} from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const { user } = useStore();

  if (!isOpen) return null;

  const plans = [
    {
      id: "pro_1mo",
      name: "1 Month Pro",
      badge: "Starter",
      badgeColor: "bg-gray-800 text-gray-300 border-gray-700",
      price: "₹499",
      period: "per month",
      desc: "Ideal for active traders wanting flexible monthly access.",
      popular: false,
      features: [
        "Full Regime-Driven 1:3:2 Ratio Fly Scans",
        "Dynamic Bull & Bear Skewed Iron Condors",
        "Real-Time Telegram Bot Instant Alerts",
        "1-Click Live Broker Execution (Dhan & Kotak)",
        "Automated Stop-Loss & Take-Profit Trailing",
        "Unlimited Multi-Leg Options Backtesting"
      ]
    },
    {
      id: "pro_6mo",
      name: "6 Months Pro",
      badge: "Popular • Save 17%",
      badgeColor: "bg-accentBrand/20 text-accentBrand border-accentBrand/40",
      price: "₹2,499",
      period: "for 6 months (₹416/mo)",
      desc: "Best balance of savings and continuous market scanner coverage.",
      popular: true,
      features: [
        "All 1-Month Pro Features Included",
        "Priority Low-Latency Alert Queue",
        "Commodity & Index Expiry Scanners",
        "Dedicated VIP WhatsApp Support",
        "Early Access to New Strategy Presets",
        "Multi-Account Broker Token Sync"
      ]
    },
    {
      id: "pro_1yr",
      name: "1 Year Pro",
      badge: "Best Value • Save 25%",
      badgeColor: "bg-greenBrand/20 text-greenBrand border-greenBrand/40",
      price: "₹4,499",
      period: "for 12 months (₹374/mo)",
      desc: "Maximum value for serious quantitative options traders.",
      popular: false,
      features: [
        "All 6-Month Pro Features Included",
        "1 Full Year Continuous Live Scanning",
        "1-on-1 Personalized Onboarding & Setup",
        "Custom Ratio Spread & Wing Tuning",
        "Exclusive Lifetime Upgrade Discounts",
        "VIP Trader Community Channel"
      ]
    }
  ];

  const handleContactAdmin = (planName: string, price: string) => {
    const userIdentifier = user?.phone_number || user?.email || "User";
    const text = encodeURIComponent(
      `Hello OptionChief Team,\n\nI would like to subscribe to the *${planName}* (${price}) for account: *${userIdentifier}*.\n\nPlease share the payment QR / UPI details to activate my Pro subscription.`
    );
    window.open(`https://wa.me/919999999999?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-gray-950 border border-borderClr/60 rounded-2xl p-6 md:p-8 max-w-4xl w-full shadow-2xl relative my-8">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-gray-900 border border-borderClr/40 text-gray-400 hover:text-white hover:border-gray-500 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentBrand/10 border border-accentBrand/30 text-accentBrand text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>OptionChief Pro Access</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            Upgrade Your Quantitative Trading Edge
          </h2>
          <p className="text-xs md:text-sm text-gray-400 mt-2 max-w-xl mx-auto">
            Choose a flexible plan to unlock unlimited real-time market regime scanners, automated Telegram alerts, and 1-click broker order routing.
          </p>

          {user && (
            <div className="inline-flex items-center gap-2 mt-4 px-3.5 py-1.5 rounded-lg bg-gray-900 border border-borderClr/40 text-xs">
              <Clock className="w-3.5 h-3.5 text-accentCyan" />
              <span className="text-gray-300">Current Status:</span>
              <strong className="text-white font-bold">{user.status || user.plan_name || "15-Day Free Trial"}</strong>
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`rounded-xl p-5 border transition-all flex flex-col justify-between relative ${
                plan.popular 
                  ? "bg-gradient-to-b from-accentBrand/10 to-gray-950 border-accentBrand shadow-lg shadow-accentBrand/10" 
                  : "bg-gray-900/50 border-borderClr/40 hover:border-gray-600"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accentBrand text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-base font-extrabold text-white">{plan.name}</h3>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${plan.badgeColor}`}>
                    {plan.badge}
                  </span>
                </div>

                <p className="text-[11px] text-gray-400 min-h-[32px] mb-4">{plan.desc}</p>

                <div className="mb-5 pb-4 border-b border-borderClr/20">
                  <div className="text-3xl font-extrabold text-white tracking-tight">{plan.price}</div>
                  <span className="text-[11px] text-gray-400 font-semibold">{plan.period}</span>
                </div>

                <div className="space-y-2.5 mb-6 text-xs text-gray-300">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-greenBrand shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleContactAdmin(plan.name, plan.price)}
                className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                  plan.popular
                    ? "bg-accentBrand hover:bg-accentBrand/90 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-white border border-borderClr/60"
                }`}
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>Activate on WhatsApp / UPI</span>
              </button>
            </div>
          ))}
        </div>

        {/* Guarantee Banner */}
        <div className="mt-6 p-4 rounded-xl bg-gray-900/60 border border-borderClr/30 flex flex-col md:flex-row items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-white">Instant Manual Activation</h4>
              <p className="text-[10px] text-gray-400">All payments are confirmed within 5 minutes and your account is instantly upgraded to Pro.</p>
            </div>
          </div>
          <button
            onClick={() => handleContactAdmin("OptionChief Subscription Inquiry", "All Plans")}
            className="px-4 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-xs hover:bg-emerald-500/25 transition-all shrink-0"
          >
            Direct Support Helpdesk
          </button>
        </div>
      </div>
    </div>
  );
};
