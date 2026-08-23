import React, { useState } from 'react';
import { Mail, MessageCircle, CheckCircle2, RefreshCw, Send, Globe } from 'lucide-react';

export const HelpSupportDesk: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !subject || !message) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const generatedId = `OC-${Math.floor(10000 + Math.random() * 90000)}`;
      setTicketId(generatedId);
      setIsSubmitting(false);
      setSubject('');
      setMessage('');
    }, 1000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
      {/* Left Form Column */}
      <div className="lg:col-span-7 glass-panel p-6 md:p-8 rounded-2xl border border-borderClr/40 bg-gray-950/40 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-borderClr/20 pb-4">
          <Mail className="w-5 h-5 text-accentCyan" />
          <div>
            <h3 className="text-base font-extrabold text-white">
              Contact OptionChief Support Desk
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Submit a support ticket and our team will get back to you within 24 hours.
            </p>
          </div>
        </div>

        {ticketId ? (
          <div className="p-6 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center flex flex-col items-center gap-3 animate-scaleUp">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
            <h4 className="text-sm font-bold text-white">Ticket Submitted Successfully!</h4>
            <p className="text-xs text-gray-300 max-w-sm">
              Your inquiry has been recorded. We will respond directly to <strong>{email}</strong>.
            </p>
            <div className="px-4 py-2 rounded-lg bg-black font-mono text-xs font-bold text-emerald-300 border border-emerald-500/30">
              Ticket Reference: #{ticketId}
            </div>
            <button
              onClick={() => setTicketId(null)}
              className="mt-2 text-xs font-bold text-accentCyan hover:underline"
            >
              Submit Another Inquiry
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Your Email Address</label>
              <input
                type="email"
                required
                placeholder="trader@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-950 border border-borderClr rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-accentBrand placeholder-gray-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Subject / Topic</label>
              <input
                type="text"
                required
                placeholder="E.g. Setting up Dhan API token or 1:3:2 Ratio scanner"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-gray-950 border border-borderClr rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-accentBrand placeholder-gray-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-950 border border-borderClr rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-accentBrand"
              >
                <option value="general">General Support</option>
                <option value="subscription">Subscription & Pro Upgrades</option>
                <option value="broker">Broker Integration (Dhan/Kotak)</option>
                <option value="alerts">Telegram Alerts & Scanner</option>
                <option value="bug">Feature Request or Bug Report</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Message Details</label>
              <textarea
                required
                rows={4}
                placeholder="Describe your issue or setup details..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-gray-950 border border-borderClr rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-accentBrand placeholder-gray-600 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-accentBrand hover:bg-accentBrand/90 text-white font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-accentBrand/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Ticket...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Ticket</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Right Quick Contact Options */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-borderClr/40 bg-gray-950/40 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-borderClr/20 pb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            Instant Trader Channels
          </h4>

          <div className="space-y-3">
            <a
              href="https://wa.me/918500503785?text=Hello%20OptionChief%20Support"
              target="_blank"
              rel="noreferrer"
              className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 hover:bg-emerald-950/50 transition-all flex items-center justify-between text-xs text-white group"
            >
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <strong className="block">Direct WhatsApp Support</strong>
                  <span className="text-[10px] text-emerald-300">Fast response for Pro subscribers</span>
                </div>
              </div>
              <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">➔</span>
            </a>

            <a
              href="https://t.me/optionchief"
              target="_blank"
              rel="noreferrer"
              className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/40 hover:bg-cyan-950/50 transition-all flex items-center justify-between text-xs text-white group"
            >
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-cyan-400" />
                <div>
                  <strong className="block">Official Telegram Channel</strong>
                  <span className="text-[10px] text-cyan-300">Daily market regime updates</span>
                </div>
              </div>
              <span className="text-cyan-400 group-hover:translate-x-1 transition-transform">➔</span>
            </a>
          </div>
        </div>

        {/* Regulatory Disclaimer */}
        <div className="p-4 rounded-xl bg-gray-950 border border-borderClr/30 text-[10px] text-gray-500 space-y-1.5 leading-relaxed">
          <strong className="text-gray-400 block uppercase">Regulatory & Educational Notice:</strong>
          <p>
            OptionChief provides quantitative analytics and strategy simulation software. Content within the Academy is strictly for educational purposes and should not be construed as SEBI-registered financial or investment advice. Options trading involves substantial risk of loss.
          </p>
        </div>
      </div>
    </div>
  );
};
