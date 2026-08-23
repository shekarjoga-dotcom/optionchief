import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TroubleItem {
  title: string;
  symptom: string;
  cause: string;
  fix: string[];
}

const TROUBLE_ITEMS: TroubleItem[] = [
  {
    title: 'Dhan 24-Hour Access Token Expired',
    symptom: 'Broker orders fail with "401 Unauthorized" or "Invalid Token" notification.',
    cause: 'By SEBI regulation, Dhan HQ Access Tokens expire automatically every 24 hours at midnight.',
    fix: [
      'Log into your web.dhan.co developer portal.',
      'Click "Generate Access Token" and copy the new JWT token.',
      'In OptionChief, click the Key icon in top navbar, paste the new token, and click "Save Credentials".'
    ]
  },
  {
    title: 'Broker Order Rejected: Insufficient Margin',
    symptom: 'Order dispatch fails with "Margin Shortfall" message from exchange.',
    cause: 'Placing short option legs without executing the long protective wings first.',
    fix: [
      'Always use OptionChief’s 1-Click Multi-Leg Basket routing, which orders long legs first to unlock exchange margin relief.',
      'Verify your broker account ledger has adequate collateral balance before market open.'
    ]
  },
  {
    title: 'Telegram Bot Alerts Not Delivering to Phone',
    symptom: 'Auto-Scanner finds matches, but no Telegram notification arrives on your device.',
    cause: 'Bot Token or Chat ID is incorrect, or you have not sent /start to your bot.',
    fix: [
      'Open your bot in Telegram and send the message "/start". Telegram bots cannot message users first.',
      'Verify your numerical Chat ID (e.g. 123456789) using @userinfobot.',
      'Ensure the Auto-Scanner toggle in the Strategy Alerts tab is switched to ACTIVE.'
    ]
  },
  {
    title: 'Market Closed / Stale Weekend Quotes',
    symptom: 'Option chain prices do not tick or change outside market hours.',
    cause: 'Indian equity and F&O markets operate Monday to Friday from 9:15 AM to 3:30 PM IST.',
    fix: [
      'Outside market hours, OptionChief displays the last official closing settlement prices from the NSE.',
      'You can still build strategies, simulate IV offsets, and paper trade using closing snapshots.'
    ]
  }
];

export const HelpTroubleshooting: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-1 border-b border-borderClr/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-500/15 text-red-300 border border-red-500/30">
            Troubleshooting Guide
          </span>
          <h2 className="text-lg md:text-xl font-extrabold text-white">
            Common Issues & Quick Fixes
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Step-by-step diagnostic fixes for broker connections, margin calculations, and alert deliveries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TROUBLE_ITEMS.map((item, idx) => (
          <div
            key={idx}
            className="glass-panel p-5 rounded-2xl border border-borderClr/40 bg-gray-950/40 flex flex-col justify-between gap-4 shadow-lg"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-sm font-extrabold text-white">{item.title}</h3>
              </div>

              <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/25 text-xs text-red-300">
                <strong>Symptom:</strong> {item.symptom}
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                <strong>Why It Happens:</strong> {item.cause}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-900 border border-borderClr/30 space-y-1.5 text-xs">
              <strong className="text-emerald-400 uppercase tracking-wider text-[10px] block">
                How to Fix It:
              </strong>
              {item.fix.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-gray-300 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
