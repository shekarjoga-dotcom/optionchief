import React, { useState } from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  Zap, 
  Info,
  Check
} from 'lucide-react';

interface BuilderStep {
  stepNumber: number;
  title: string;
  action: string;
  uiTarget: string;
  explanation: string;
  proTip: string;
}

const BUILDER_STEPS: BuilderStep[] = [
  {
    stepNumber: 1,
    title: 'Choose Underlying Symbol',
    action: 'Select NIFTY, BANKNIFTY, FINNIFTY or F&O equity',
    uiTarget: 'Symbol Selector Dropdown (Top Header)',
    explanation: 'Begin by selecting the asset you want to trade. OptionChief loads real-time spot quotes, lot sizes, and active strike increments.',
    proTip: 'For multi-leg non-directional strategies, NIFTY offers the highest liquidity and tightest bid-ask spreads.'
  },
  {
    stepNumber: 2,
    title: 'Select Expiry Date Cycle',
    action: 'Pick nearest weekly (e.g. 7 DTE) or monthly expiration',
    uiTarget: 'Expiry Bar',
    explanation: 'Select your time horizon. Days to Expiry (DTE) directly dictates the speed of Theta time decay and volatility risk.',
    proTip: 'Credit sellers harvest the highest daily Theta between 3 to 10 DTE.'
  },
  {
    stepNumber: 3,
    title: 'Pick Strategy Template (Or Build Custom)',
    action: 'Select Iron Condor, Bull Call Spread, or Custom Legs',
    uiTarget: 'Template Dropdown in Leg Manager',
    explanation: 'Use pre-built institutional templates to instantly populate balanced legs, or add custom legs manually.',
    proTip: 'Using templates pre-balances wing widths and helps avoid asymmetrical execution errors.'
  },
  {
    stepNumber: 4,
    title: 'Select Strike Prices',
    action: 'Choose OTM Wings and Short Strike centers',
    uiTarget: 'Strike Dropdown on Leg Rows',
    explanation: 'Adjust individual strike prices for each leg. The payoff graph recalculates immediately on strike modification.',
    proTip: 'For Iron Condors, place short strikes around 15-20 Delta (approx 1 standard deviation out) for >= 70% Probability of Profit.'
  },
  {
    stepNumber: 5,
    title: 'Select Option Type (Call vs Put)',
    action: 'Toggle CE (Call) or PE (Put) for each leg',
    uiTarget: 'CE / PE Toggle Buttons',
    explanation: 'Configure Call legs for upside boundaries and Put legs for downside boundaries.',
    proTip: 'Iron Condors use 1 Put Debit/Credit Spread + 1 Call Debit/Credit Spread.'
  },
  {
    stepNumber: 6,
    title: 'Choose Action (BUY vs SELL)',
    action: 'Set Long (BUY) for protection and Short (SELL) for decay',
    uiTarget: 'BUY / SELL Toggle Pill',
    explanation: 'Selling options collects premium and Theta; Buying outer wings caps maximum risk and gives margin relief.',
    proTip: 'Always place your Buy (hedging) legs simultaneously to guarantee exchange margin reduction.'
  },
  {
    stepNumber: 7,
    title: 'Set Quantity & Lots',
    action: 'Set number of lots (e.g. 2 lots = 100 shares for NIFTY)',
    uiTarget: 'Lots / Quantity Input',
    explanation: 'OptionChief automatically scales all legs proportionally by lot size so you maintain precise ratio structures.',
    proTip: 'In 1:3:2 Ratio Flies, ensure the middle body leg has exactly 3x the quantity of the lower wing.'
  },
  {
    stepNumber: 8,
    title: 'Review Net Premium (Credit vs Debit)',
    action: 'Verify net inflow (Credit) or outflow (Debit)',
    uiTarget: 'Net Premium Summary Card',
    explanation: 'Displays the total net premium collected (in green) or paid (in red) for the entire multi-leg structure.',
    proTip: 'Target collecting at least 1/3rd of the wing width as net credit on Iron Condors.'
  },
  {
    stepNumber: 9,
    title: 'Analyze Interactive Payoff Curves (T+0 vs Expiry)',
    action: 'Inspect solid Cyan (Today) vs dashed Purple (Expiry)',
    uiTarget: 'Interactive Payoff Canvas',
    explanation: 'Observe where your profit zone lies. The gap between T+0 and Expiry represents remaining time value.',
    proTip: 'Drag the IV Offset slider (+/-20%) to test how the strategy handles sudden volatility shocks.'
  },
  {
    stepNumber: 10,
    title: 'Verify Risk-to-Reward & POP %',
    action: 'Check Max Profit, Max Loss, Breakevens, and POP %',
    uiTarget: 'Strategy Telemetry Table',
    explanation: 'Confirm that your maximum risk is clearly defined and acceptable before entering the market.',
    proTip: 'A defined-risk trade with 75% POP and 2:1 Max Loss/Max Profit has a strong positive statistical edge over 50+ trades.'
  },
  {
    stepNumber: 11,
    title: 'Review Margin & Collateral Relief',
    action: 'Inspect Estimated Exchange Margin Requirement',
    uiTarget: 'Margin Requirement Badge',
    explanation: 'OptionChief computes the net margin required with multi-leg hedging relief applied.',
    proTip: 'Hedged spreads require up to 70% less margin than naked option positions.'
  },
  {
    stepNumber: 12,
    title: 'Execute Live or Save to Paper Book',
    action: 'Click "Save to Paper Trading" or "Execute with Dhan / Kotak"',
    uiTarget: 'Action Buttons (Bottom of Analyzer)',
    explanation: 'Forward-test the strategy risk-free in your Paper Trading Book, or route live basket orders directly to your broker.',
    proTip: 'Use Paper Trading to observe how Greeks behave across live trading days before allocating live capital.'
  }
];

export const HelpStrategyBuilderGuide: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const currentStep = BUILDER_STEPS[activeStep];

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-1 border-b border-borderClr/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-accentBrand/15 text-accentBrand border border-accentBrand/30">
            Interactive Walkthrough
          </span>
          <h2 className="text-lg md:text-xl font-extrabold text-white">
            12-Step Guide: How to Build Your First Options Strategy
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Follow the numbered journey below to master multi-leg strategy creation and payoff risk analysis.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-borderClr/40 bg-gray-950/60 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-white flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-accentBrand text-white flex items-center justify-center text-xs font-black">
              {currentStep.stepNumber}
            </span>
            <span>Step {currentStep.stepNumber} of 12: {currentStep.title}</span>
          </span>
          <span className="text-[11px] font-mono text-accentCyan">
            {Math.round(((activeStep + 1) / 12) * 100)}% Completed
          </span>
        </div>

        {/* Progress Fill Line */}
        <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-borderClr/30">
          <div 
            className="h-full bg-gradient-to-r from-accentBrand to-accentCyan transition-all duration-300 rounded-full"
            style={{ width: `${((activeStep + 1) / 12) * 100}%` }}
          />
        </div>

        {/* Step Buttons Mini Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 pt-1">
          {BUILDER_STEPS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setActiveStep(idx)}
              className={`py-1.5 rounded text-[10px] font-bold font-mono transition-all border ${
                activeStep === idx
                  ? 'bg-accentBrand text-white border-accentBrand shadow-md'
                  : activeStep > idx
                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30'
                  : 'bg-gray-900 text-gray-500 border-borderClr/20 hover:text-gray-300'
              }`}
            >
              {s.stepNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Main Step Detail Card with Simulated Spotlight UI */}
      <div className="glass-panel p-6 md:p-8 rounded-2xl border border-accentBrand/30 bg-gradient-to-b from-gray-950 via-slate-950 to-gray-950 grid grid-cols-1 lg:grid-cols-12 gap-8 shadow-2xl relative overflow-hidden">
        
        {/* Left Step Instructions */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold">
              <Zap className="w-3.5 h-3.5" />
              <span>Target UI Control: {currentStep.uiTarget}</span>
            </div>

            <h3 className="text-xl md:text-2xl font-extrabold text-white">
              {currentStep.title}
            </h3>

            <div className="p-3.5 rounded-xl bg-gray-900/80 border border-borderClr/40 text-xs text-emerald-300 font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Action: {currentStep.action}</span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {currentStep.explanation}
            </p>

            <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-blue-300 uppercase tracking-wider text-[10px] block">Pro Tip for This Step:</strong>
                <p className="text-[11px] text-gray-300 mt-0.5">{currentStep.proTip}</p>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-borderClr/20 pt-4 mt-2">
            <button
              onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
              disabled={activeStep === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 border border-borderClr hover:bg-gray-800 text-xs font-bold text-gray-300 hover:text-white disabled:opacity-30 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous Step</span>
            </button>

            <button
              onClick={() => setActiveStep(prev => Math.min(11, prev + 1))}
              disabled={activeStep === 11}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-accentBrand hover:bg-accentBrand/90 text-white text-xs font-extrabold shadow-lg shadow-accentBrand/20 transition-all disabled:opacity-30"
            >
              <span>{activeStep === 11 ? 'Finish Tutorial' : 'Next Step'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Simulated Spotlight Canvas */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-black/80 border border-borderClr/40 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between border-b border-borderClr/30 pb-2 text-xs font-bold text-white">
            <span>Terminal Step Visualizer</span>
            <span className="text-emerald-400 font-mono text-[10px]">Active Step #{currentStep.stepNumber}</span>
          </div>

          {/* Dynamic SVG Mock Spotlight Area */}
          <div className="w-full h-56 bg-gray-950 rounded-xl relative border border-borderClr/30 flex flex-col items-center justify-center p-4 text-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_70%)]" />
            
            {/* Glowing Spotlight Indicator */}
            <div className="w-16 h-16 rounded-full bg-accentBrand/20 border-2 border-accentBrand flex items-center justify-center text-white mb-2 animate-bounce">
              <span className="font-black text-xl">{currentStep.stepNumber}</span>
            </div>

            <span className="text-xs font-bold text-white relative z-10">
              {currentStep.uiTarget}
            </span>
            <span className="text-[10px] text-gray-400 mt-1 max-w-xs leading-relaxed relative z-10">
              "{currentStep.action}"
            </span>

            <div className="mt-3 inline-flex items-center gap-1 text-[9px] font-mono text-accentCyan bg-accentCyan/10 px-2 py-0.5 rounded border border-accentCyan/30 relative z-10">
              <span>Simulating User Click</span>
            </div>
          </div>

          <div className="text-[10px] text-gray-500 text-center">
            Step {activeStep + 1} of 12 • OptionChief Interactive Learning Engine
          </div>
        </div>
      </div>
    </div>
  );
};
