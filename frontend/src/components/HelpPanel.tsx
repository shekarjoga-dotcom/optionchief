import React, { useState, useMemo } from 'react';
import {
  Search,
  Play,
  Mail,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Video,
  X,
  CheckCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

interface FAQItem {
  id: string;
  category: 'scanner' | 'builder' | 'greeks' | 'broker';
  question: string;
  answer: string;
}

interface VideoItem {
  id: string;
  title: string;
  duration: string;
  description: string;
  youtubeId: string;
  category: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'scan-bg',
    category: 'scanner',
    question: 'How do I configure background scanning alerts?',
    answer: 'Navigate to the "Strategy Alerts" tab, configure your screening parameters (such as POP, Risk-Reward, and target Greeks limits), click "Create Alert Rule", and toggle the "Auto-Scanner Engine" to ACTIVE. The system runs scans client-side at your designated frequency interval, flashing notifications and playing alert sounds when matches are found.'
  },
  {
    id: 'scan-dist',
    category: 'scanner',
    question: 'What does strike distance represent in the screener results?',
    answer: 'Strike distance represents the average spacing of the short option legs from the current underlying spot price. Setting a higher minimum strike distance filters for safer out-of-the-money (OTM) credit strategies, though this typically yields a lower net premium.'
  },
  {
    id: 'scan-delay',
    category: 'scanner',
    question: 'Why is there sometimes a slight delay in background alerts?',
    answer: 'Because all option chain projections, margin requirement estimations, and Greeks calculations are computed directly on your client browser to keep local rates highly responsive, scanning multiple expiries and wing-widths simultaneously can take 2-5 seconds. Alerts run on the latest ticking feed and reflect live spreads.'
  },
  {
    id: 'build-t0',
    category: 'builder',
    question: 'What is the difference between the T+0 curve and the Expiry curve?',
    answer: 'On the payoff simulation chart, the T+0 curve (solid Cyan line) shows your estimated profit/loss *today* if the underlying asset price moves. The Expiry curve (purple line) shows the payoff on the exact day of contract expiration. Over time, the T+0 curve shifts closer to the Expiry curve due to time decay (Theta).'
  },
  {
    id: 'build-iv',
    category: 'builder',
    question: 'How does modifying the IV Offset parameter affect my payoff?',
    answer: 'The IV Offset slider simulates changes in Implied Volatility. If you increase IV (positive offset), option prices rise. This benefits net-buyers (debit strategies) causing their T+0 curve to shift upward, while hurting net-sellers (credit strategies) who experience temporary unrealized losses.'
  },
  {
    id: 'build-load',
    category: 'builder',
    question: 'How do I load scanned strategy setups into the builder sandbox?',
    answer: 'In the Strategy Screener results table, click the "Sandbox" button on any row. The strikes, quantities, actions (BUY/SELL), and expiries will automatically load into the Strategy Analyzer tab (Leg Manager), allowing you to customize individual leg pricing and volatility offsets.'
  },
  {
    id: 'greek-neutral',
    category: 'greeks',
    question: 'How do I scan for Delta-neutral options strategies?',
    answer: 'Delta (Δ) measures directional exposure. A Delta-neutral portfolio targets a net Delta near 0. To scan for these, open the "Filters" panel inside the Strategy Screener, scroll to "Greeks Filters", and set the Delta Range to a tight envelope near zero, such as min: -5 and max: 5.'
  },
  {
    id: 'greek-gamma',
    category: 'greeks',
    question: 'Why is capping Max Gamma important for option-sellers?',
    answer: 'Gamma (Γ) measures the rate of change of Delta. High Gamma means your direction sensitivity is highly volatile; a small price shift in the underlying can swing a delta-neutral strategy heavily long or short. Capping Max Gamma keeps your directional risk profile stable.'
  },
  {
    id: 'greek-theta',
    category: 'greeks',
    question: 'How is strategy Theta decay displayed and calculated?',
    answer: 'Theta (Θ) represents daily time decay. Selling options harvests premium decay, yielding positive Theta (green text, e.g., +₹120/day), while buying options costs premium decay (red text, e.g., -₹85/day). The screener scales this daily time decay metric by leg quantities and lot sizes.'
  },
  {
    id: 'broker-margin',
    category: 'broker',
    question: 'How is the strategy margin requirement calculated?',
    answer: 'Our math engine runs a simulated exposure model mirroring exchange guidelines. Naked short options require full margin (e.g. ₹1.5L), while hedged strategies (like Iron Condors, Debit Spreads, or Butterflies) receive significant margin relief (halving requirements or lower) due to capped risk wings.'
  },
  {
    id: 'broker-paper',
    category: 'broker',
    question: 'How do I manage open paper trades in the trading book?',
    answer: 'Go to the "Paper Trading Book" tab. It lists all active strategies in your book. You can view real-time open PnL (synced to live option chain spreads), inspect individual leg execution prices, or click "Close Position" to exit and log the trade history.'
  },
  {
    id: 'broker-live',
    category: 'broker',
    question: 'Can I route alerts directly to a live broker account?',
    answer: 'Yes. For users integrated with Dhan or Kotak Neo API endpoints, clicking "Trade" inside the alerts log pops open a basket trade execution modal. Quantities are automatically normalized to matching lot sizes (e.g., 30 for BANKNIFTY) before routing order placements.'
  }
];

const VIDEO_TUTORIALS: VideoItem[] = [
  {
    id: 'vid-sandbox',
    title: 'Options Sandbox Builder Tutorial',
    duration: '3:45',
    description: 'Learn how to build, modify, and analyze multi-leg options strategies. Understand T+0 curves, IV offsets, and strike adjustments.',
    youtubeId: 'dQw4w9WgXcQ',
    category: 'Sandbox'
  },
  {
    id: 'vid-scanner',
    title: 'Configuring Auto-Scanner Rules',
    duration: '4:12',
    description: 'Step-by-step walkthrough on setting up background alert rules, configuring Pop, Risk-Reward, and target Greeks limits.',
    youtubeId: 'eUJRonKZzi8',
    category: 'Screener'
  },
  {
    id: 'vid-greeks',
    title: 'Greeks-Based Risk Management',
    duration: '5:30',
    description: 'Deep dive into Delta-neutral scanning, Theta time-decay harvesting, and setting Gamma caps to prevent volatility spikes.',
    youtubeId: 'qWAXYlSpJjU',
    category: 'Risk Management'
  },
  {
    id: 'vid-trading',
    title: 'Live Executions & Paper Trading',
    duration: '2:50',
    description: 'How to manage your paper trading book, normalization of option lot sizes, and live Dhan/Kotak API routing configurations.',
    youtubeId: '8o_F9Fmnljw',
    category: 'Trading'
  }
];

export const HelpPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [faqCategory, setFaqCategory] = useState<'all' | 'scanner' | 'builder' | 'greeks' | 'broker'>('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Video modal player state
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  // Support ticket form state
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('general');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Filter FAQs based on query and tab
  const filteredFAQs = useMemo(() => {
    return FAQ_ITEMS.filter((faq) => {
      const matchesCategory = faqCategory === 'all' || faq.category === faqCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery =
        query === '' ||
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, faqCategory]);

  const toggleFaq = (id: string) => {
    setExpandedFaq(prev => (prev === id ? null : id));
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketEmail || !ticketMessage || !ticketSubject) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const ticketId = `OO-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmitSuccess(ticketId);
      setIsSubmitting(false);
      // Reset form
      setTicketSubject('');
      setTicketMessage('');
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Search Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-borderClr/40 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 p-6 md:p-8 flex flex-col items-center text-center gap-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1),transparent_70%)] pointer-events-none" />
        <h2 className="text-xl md:text-2xl font-extrabold text-white uppercase tracking-wider">
          Knowledge Base & Help Desk
        </h2>
        <p className="text-xs text-gray-400 max-w-lg">
          Search strategy scanner documentation, options Greeks setups, broker integration guides, or watch our short tutorial walkthroughs.
        </p>

        {/* Search Bar */}
        <div className="relative w-full max-w-md mt-2">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search FAQs, Greek terms, alerts setups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-borderClr/60 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accentCyan focus:ring-1 focus:ring-accentCyan/30 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid: Left Column FAQs, Right Column Videos & Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FAQs Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-borderClr/20 pb-3">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <HelpCircle className="w-4.5 h-4.5 text-accentCyan" />
              Frequently Asked Questions
            </h3>
            {filteredFAQs.length !== FAQ_ITEMS.length && (
              <span className="text-[10px] text-accentCyan font-bold bg-accentCyan/10 px-2 py-0.5 rounded border border-accentCyan/20">
                {filteredFAQs.length} Found
              </span>
            )}
          </div>

          {/* FAQ Category Tab Links */}
          <div className="flex flex-wrap gap-1.5 bg-gray-950/60 p-1 rounded-xl border border-borderClr/15 self-start">
            {[
              { id: 'all', label: 'All FAQs' },
              { id: 'scanner', label: 'Scanner & Alerts' },
              { id: 'builder', label: 'Payoffs & Sandbox' },
              { id: 'greeks', label: 'Greeks & Risk' },
              { id: 'broker', label: 'Brokers & Paper' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFaqCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all ${
                  faqCategory === cat.id
                    ? 'bg-accentBrand text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Accordion List */}
          {filteredFAQs.length === 0 ? (
            <div className="glass-panel p-8 text-center text-xs text-gray-500 rounded-xl border border-borderClr/30">
              No matching help articles found. Try modifying your search term or tab selection.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredFAQs.map((faq) => {
                const isExpanded = expandedFaq === faq.id;
                return (
                  <div
                    key={faq.id}
                    className={`glass-panel border rounded-xl transition-all duration-300 overflow-hidden ${
                      isExpanded
                        ? 'border-accentCyan bg-cyan-950/5 shadow-md shadow-accentCyan/5'
                        : 'border-borderClr/30 hover:border-gray-500/60 bg-gray-950/20'
                    }`}
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left gap-4"
                    >
                      <span className="text-xs font-bold text-white leading-relaxed">
                        {faq.question}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4.5 h-4.5 text-accentCyan shrink-0" />
                      ) : (
                        <ChevronDown className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 text-xs text-gray-400 leading-relaxed border-t border-borderClr/10 pt-4 bg-gray-950/20">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: Tutorial Videos & Contact Form */}
        <div className="lg:col-span-1 flex flex-col gap-8">
          
          {/* Tutorial Videos Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 border-b border-borderClr/20 pb-3">
              <Video className="w-4.5 h-4.5 text-accentCyan" />
              Short Video Tutorials
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {VIDEO_TUTORIALS.map((video) => (
                <div
                  key={video.id}
                  onClick={() => setActiveVideo(video)}
                  className="glass-panel border border-borderClr/30 rounded-xl overflow-hidden hover:border-accentCyan transition-all group cursor-pointer flex flex-col animate-fadeIn"
                >
                  {/* Mock Video Thumbnail Overlay */}
                  <div className="h-28 w-full bg-gray-950 relative flex items-center justify-center overflow-hidden border-b border-borderClr/10">
                    <div className="absolute inset-0 bg-gradient-to-tr from-accentBrand/10 via-gray-900 to-accentCyan/10 group-hover:scale-105 transition-all duration-300" />
                    
                    <span className="absolute top-2 left-2 bg-gray-950/80 text-accentCyan border border-accentCyan/20 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
                      {video.category}
                    </span>

                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {video.duration}
                    </span>

                    <div className="w-9 h-9 rounded-full bg-accentCyan/10 group-hover:bg-accentCyan border border-accentCyan/40 flex items-center justify-center transition-all z-10">
                      <Play className="w-4 h-4 text-accentCyan group-hover:text-black fill-current group-hover:fill-black translate-x-0.5" />
                    </div>
                  </div>

                  <div className="p-4 flex flex-col gap-1.5 text-left">
                    <h4 className="text-xs font-bold text-white group-hover:text-accentCyan transition-all">
                      {video.title}
                    </h4>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      {video.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Us Support Form */}
          <div className="glass-panel border border-borderClr/30 rounded-2xl p-5 flex flex-col gap-4 bg-gray-950/30">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 border-b border-borderClr/20 pb-3">
              <MessageSquare className="w-4.5 h-4.5 text-accentCyan" />
              Contact Help Desk
            </h3>

            {submitSuccess ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-5 rounded-xl flex flex-col items-center text-center gap-3">
                <CheckCircle className="w-10 h-10 text-emerald-500 animate-bounce" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-white">Ticket Submitted Successfully!</span>
                  <span className="text-[10px] text-gray-400">Our support engineers will review your request.</span>
                </div>
                <div className="bg-gray-950 px-3.5 py-1.5 rounded-lg border border-borderClr/40 font-mono text-xs text-white font-extrabold mt-1">
                  Ticket ID: #{submitSuccess}
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(null)}
                  className="mt-3 text-[10px] font-extrabold uppercase text-accentCyan hover:underline"
                >
                  Submit Another Question
                </button>
              </div>
            ) : (
              <form onSubmit={handleSupportSubmit} className="flex flex-col gap-4 text-xs">
                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={ticketEmail}
                    onChange={(e) => setTicketEmail(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>

                {/* Subject */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Subject <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Margin requirement questions"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Query Category</label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accentCyan"
                  >
                    <option value="general">General Inquiry</option>
                    <option value="technical">Technical Bug / Issue</option>
                    <option value="screener">Scanner & Alert Logic</option>
                    <option value="broker">Broker APIs & Paper Trading</option>
                    <option value="billing">Billing & Plans</option>
                  </select>
                </div>

                {/* Message Body */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Message <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe your question or issue in detail..."
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accentCyan placeholder-gray-600 resize-none"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 bg-accentBrand hover:bg-accentBrand/90 text-white font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 mt-1 shadow-md shadow-accentBrand/10"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Sending ticket...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Query</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Support info details */}
            <div className="border-t border-borderClr/20 pt-4 mt-1 flex flex-col gap-2.5 text-[10px] text-gray-500">
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-accentCyan shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-white font-semibold">support@optionsoracle.in</span>
                  <span>We usually reply within 24 business hours.</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-accentCyan shrink-0 mt-0.5" />
                <span>Mon - Fri (Market Hours): 9:00 AM - 5:00 PM IST</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-accentCyan shrink-0 mt-0.5" />
                <span>B.Networks Tech Hub, Pune, MH, India - 411048</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Video Modal Player (Youtube Iframe) */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-all duration-300">
          <div className="relative w-full max-w-3xl aspect-video bg-black rounded-2xl border border-borderClr/60 overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal header with close button */}
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setActiveVideo(null)}
                className="p-1.5 rounded-full bg-black/60 hover:bg-black/95 text-gray-400 hover:text-white border border-borderClr/40 transition-all"
                title="Close Player"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* YouTube embed player */}
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1&modestbranding=1&rel=0`}
              title={activeVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="flex-1"
            />

            {/* Video description footer in modal */}
            <div className="bg-gray-950 p-4 border-t border-borderClr/20 text-left">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">{activeVideo.title}</h3>
              <p className="text-[10px] text-gray-500 mt-1">{activeVideo.description}</p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
