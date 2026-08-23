import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

interface FAQ {
  id: string;
  category: 'start' | 'builder' | 'greeks' | 'broker' | 'scanner';
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    id: 'f-1',
    category: 'start',
    question: 'How do I select different underlying symbols and indices?',
    answer: 'Use the Symbol Selector bar at the top of the terminal. You can switch between NIFTY 50, BANKNIFTY, FINNIFTY, MIDCPNIFTY, and SENSEX. All option chains, lot sizes, and live quotes update immediately.'
  },
  {
    id: 'f-2',
    category: 'start',
    question: 'What is the difference between Free Plan and Pro Tier?',
    answer: 'The Free Plan includes full access to the Option Chain, Greek analytics, Strategy Analyzer, Payoff Visualizer, and Paper Trading Book forever. The Pro Tier (₹499/mo) unlocks all quantitative 1:3:2 Ratio Fly & Skewed Condor Scanners, 24/7 Telegram Instant Push Alerts, and 1-Click Live Broker Execution.'
  },
  {
    id: 'f-3',
    category: 'builder',
    question: 'How do I add or remove option legs in the Strategy Analyzer?',
    answer: 'You can either click any Bid/Ask cell directly in the Option Chain to append legs, or click "+ Add Leg" in the Leg Manager inside the Strategy Analyzer tab. To remove a leg, simply click the trash icon on that leg row.'
  },
  {
    id: 'f-4',
    category: 'builder',
    question: 'What is the difference between the T+0 curve and the Expiry curve?',
    answer: 'On the payoff simulation chart, the solid Cyan line (T+0 curve) shows your estimated profit or loss TODAY if the index moves. The dashed Purple line shows your final profit or loss at contract expiration. Over time, Theta decay pulls the T+0 curve into the Expiry curve.'
  },
  {
    id: 'f-5',
    category: 'builder',
    question: 'How does the IV Offset slider work in the Strategy Analyzer?',
    answer: 'The IV Offset slider (+/-30%) simulates volatility shocks. If IV increases (e.g. before an event), option prices rise—benefiting net buyers while causing temporary unrealized drawdowns for net sellers. If IV collapses (IV Crush), net sellers profit.'
  },
  {
    id: 'f-6',
    category: 'greeks',
    question: 'How do I scan for Delta-neutral options strategies?',
    answer: 'In the Strategy Screener tab, open the filter drawer and set the Net Delta Range to a tight envelope near zero (e.g. min: -5 and max: +5). The engine will filter for setups with zero directional bias.'
  },
  {
    id: 'f-7',
    category: 'greeks',
    question: 'Why is Gamma risk important for option sellers near expiry?',
    answer: 'Gamma measures how fast Delta changes per ₹1 move in spot price. On expiry day (0 DTE), ATM options have massive Gamma—meaning a ₹20 spot jump can swing Delta from 0.50 to 0.90, rapidly shifting risk exposure.'
  },
  {
    id: 'f-8',
    category: 'scanner',
    question: 'How do I configure 24/7 automated Telegram Bot alerts?',
    answer: 'Go to the Strategy Alerts tab, define your custom screening rule (Strategy type, minimum POP %, target credit), paste your Telegram Bot Token & Chat ID in the configuration drawer, and toggle the Auto-Scanner Engine to ACTIVE. You will receive instant mobile push notifications whenever live setups trigger.'
  },
  {
    id: 'f-9',
    category: 'broker',
    question: 'How do I connect my Dhan or Kotak Neo broker accounts?',
    answer: 'Click the Key icon in the top header navbar to open the Broker Settings modal. Enter your Dhan Client ID and 24-Hour Access Token (or Kotak Neo credentials) and click Save. You can now execute multi-leg basket orders with 1-click directly from the terminal.'
  },
  {
    id: 'f-10',
    category: 'broker',
    question: 'Are my Dhan/Kotak API credentials stored safely?',
    answer: 'Yes. OptionChief uses secure encrypted storage. Your access tokens are only used to route basket orders directly to the broker API on your request and are never shared or logged in plaintext.'
  }
];

export const HelpFAQ: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'start' | 'builder' | 'greeks' | 'broker' | 'scanner'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredFaqs = useMemo(() => {
    return FAQS.filter(f => {
      const matchCat = activeCategory === 'all' || f.category === activeCategory;
      const q = search.toLowerCase().trim();
      const matchQ = q === '' || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [activeCategory, search]);

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-1 border-b border-borderClr/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30">
            FAQ Knowledge Base
          </span>
          <h2 className="text-lg md:text-xl font-extrabold text-white">
            Frequently Asked Questions
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Find instant answers to common questions about features, math, brokers, and alerts.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search FAQs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-borderClr rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accentBrand"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'start', label: 'Getting Started' },
            { id: 'builder', label: 'Builder & Payoffs' },
            { id: 'greeks', label: 'Greeks & Risk' },
            { id: 'scanner', label: 'Scanners & Alerts' },
            { id: 'broker', label: 'Brokers' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                activeCategory === cat.id
                  ? 'bg-accentBrand text-white border-accentBrand shadow-md'
                  : 'bg-gray-950 text-gray-400 border-borderClr/30 hover:text-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion FAQ List */}
      <div className="flex flex-col gap-3">
        {filteredFaqs.map((faq) => {
          const isExpanded = expandedId === faq.id;
          return (
            <div
              key={faq.id}
              className={`glass-panel border rounded-2xl transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? 'border-accentBrand/60 bg-gray-950/80 shadow-lg shadow-accentBrand/5'
                  : 'border-borderClr/30 bg-gray-950/40 hover:border-gray-600'
              }`}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                className="w-full p-4 md:p-5 flex items-center justify-between text-left gap-4"
              >
                <span className="text-xs md:text-sm font-bold text-white leading-relaxed">
                  {faq.question}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-accentBrand shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pt-2 text-xs text-gray-300 leading-relaxed border-t border-borderClr/20 bg-black/40 animate-fadeIn">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
