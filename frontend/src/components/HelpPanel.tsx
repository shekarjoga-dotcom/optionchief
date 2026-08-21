import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Play,
  Mail,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Video,
  X,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  FileText,
  TrendingUp,
  Activity,
  Layers,
  BarChart2,
  Bell,
  Sliders,
  ShieldAlert,
  Zap,
  Key,
  Briefcase,
  Sparkles,
  Info,
  Check,
  RefreshCw
} from 'lucide-react';

interface FAQItem {
  id: string;
  category: 'scanner' | 'builder' | 'greeks' | 'broker' | 'backtest';
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

interface TopicGuide {
  id: string;
  title: string;
  icon: any;
  tag: string;
  summary: string;
  steps: {
    title: string;
    description: string;
    proTip?: string;
  }[];
  details: {
    keyPoints: string[];
    formulaOrRule?: string;
  };
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
  },
  {
    id: 'backtest-data',
    category: 'backtest',
    question: 'How far back does historical backtest data span?',
    answer: 'Our backtesting engine utilizes historical tick and OHLC option chain snapshots for NIFTY, BANKNIFTY, and FINNIFTY across multiple years, evaluating exact DTE entries, trailing stop-losses, and profit target percentage rules.'
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

const TOPIC_GUIDES: TopicGuide[] = [
  {
    id: 'chain',
    title: 'Option Chain & Real-Time Analytics',
    icon: Layers,
    tag: 'Core Feed',
    summary: 'Master the real-time options chain matrix, Put-Call Ratio (PCR), Max Pain strikes, and instantaneous Greek metrics.',
    steps: [
      {
        title: 'Select Symbol & Expiration Cycle',
        description: 'Choose your desired underlying index (NIFTY, BANKNIFTY, FINNIFTY, etc.) and pick either the nearest weekly or monthly expiration date.',
        proTip: 'Use the quick search shortcut to filter liquid strike intervals instantly.'
      },
      {
        title: 'Analyze PCR Sentiment & Max Pain Pin',
        description: 'Inspect the aggregate Put-Call Ratio at the top header (PCR > 1.2 is Bullish, PCR < 0.7 is Bearish) and observe the Max Pain strike level where option buyers suffer maximum cumulative loss.',
        proTip: 'On contract expiry days, underlying spot prices frequently gravitate toward the Max Pain strike due to dealer delta hedging.'
      },
      {
        title: 'Inspect Bid-Ask Spreads & Implied Volatility (IV)',
        description: 'Examine the strike rows for tight bid-ask spreads, Open Interest (OI) build-up, and individual strike IVs to find underpriced or overpriced wings.',
        proTip: 'Higher IV on OTM puts relative to OTM calls indicates volatility skew and institutional downside demand.'
      },
      {
        title: 'One-Click Leg Addition to Sandbox',
        description: 'Click on any Call Bid/Ask or Put Bid/Ask price cell to immediately append that leg as a Buy or Sell order in the Strategy Builder Sandbox.',
        proTip: 'Shift-click or click multiple strikes to rapidly compose 4-leg Iron Condors or Butterfly spreads.'
      }
    ],
    details: {
      keyPoints: [
        'Live ticking quotes synchronized with underlying futures and spot indexes.',
        'Color-coded highlights for ITM (In-The-Money), ATM (At-The-Money), and OTM (Out-Of-The-Money) zones.',
        'Real-time sub-millisecond calculation of Delta, Gamma, Theta, and Vega for every strike.'
      ],
      formulaOrRule: 'PCR = Total Put Open Interest / Total Call Open Interest'
    }
  },
  {
    id: 'scanner',
    title: 'Strategy Screener & Algorithmic Scanner',
    icon: Search,
    tag: 'Algorithmic',
    summary: 'Screen thousands of multi-leg options combinations in milliseconds across 10+ strategy archetypes with quantitative filters.',
    steps: [
      {
        title: 'Choose Strategy Archetype',
        description: 'Select your target setup: Iron Condor, Iron Butterfly, Bull Call Spread, Bear Put Spread, Short Straddle, Strangle, or Jade Lizard.',
        proTip: 'Use Iron Condor during low-volatility consolidation and Jade Lizard when you want neutral-to-bullish upside with zero upside risk.'
      },
      {
        title: 'Set Probability of Profit (POP) & Risk-Reward',
        description: 'Specify minimum POP (e.g. >= 70%), maximum Loss-to-Reward ratio (e.g. <= 2.5:1), and minimum net credit collected.',
        proTip: 'Setting higher POP will naturally widen your short strike distances while reducing net credit collected.'
      },
      {
        title: 'Constrain Greeks & Wing Widths',
        description: 'Lock in safe Greek envelopes such as Delta Range (-5 to +5 for Delta-neutral) and cap maximum Gamma to prevent extreme directional whip.',
        proTip: 'Enforce wider wing widths on Iron Condors to increase max profit while keeping margin requirements controlled.'
      },
      {
        title: 'Export Directly to Sandbox or Trade',
        description: 'Click "Sandbox" on any screener result row to load the exact strikes into the Payoff Simulator for custom modification.',
        proTip: 'You can save your favorite screener filter presets to run with a single click.'
      }
    ],
    details: {
      keyPoints: [
        'Instant multi-expiry scanning across multiple strike widths.',
        'Automatic calculation of Margin Requirements and Return on Collateral (ROC).',
        'Direct Sandbox export and one-click basket execution.'
      ],
      formulaOrRule: 'POP (%) = Cumulative Probability of spot staying within strategy breakeven bounds'
    }
  },
  {
    id: 'alerts',
    title: 'Auto-Scanner Engine & Real-Time Strategy Alerts',
    icon: Bell,
    tag: 'Automation',
    summary: 'Autonomous background scanning loop that monitors live market feeds, triggers chimes, and alerts you to prime trading setups.',
    steps: [
      {
        title: 'Create Dynamic Alert Rule',
        description: 'Define your strategy criteria: Underlying Symbol, Strategy Type, Target POP %, Min Net Credit, and Max Wing Distance.',
        proTip: 'Set up distinct rules for range-bound days (Iron Condors) vs trending momentum days (Vertical Spreads).'
      },
      {
        title: 'Toggle Auto-Scanner Engine to ACTIVE',
        description: 'Turn on the background auto-scanner toggle in the Alerts Panel. You can customize the scan interval from 3 to 60 seconds.',
        proTip: 'Keep the browser tab open or active; client-side background workers will continuously execute rule sweeps.'
      },
      {
        title: 'Receive Audio Chimes & Desktop Notifications',
        description: 'When market conditions match your rule thresholds, an audio alert chimes and a real-time notification banner appears.',
        proTip: 'You can mute audio alerts or filter notifications by symbol in the settings.'
      },
      {
        title: 'Instant One-Click Basket Execution',
        description: 'Review the matched strategy parameters (Credit, Breakevens, Margin) and click "Trade Basket" to execute immediately via your connected broker.',
        proTip: 'Orders are automatically sent with lot sizes normalized for the target index.'
      }
    ],
    details: {
      keyPoints: [
        'Zero manual polling required; engine scans and notifies autonomously.',
        'Inspect historical triggered alerts log with exact timestamps and entry pricing.',
        'Direct link to live Dhan and Kotak Neo broker execution.'
      ],
      formulaOrRule: 'Alert Trigger Condition: (Strategy_POP >= Target_POP) AND (Net_Credit >= Min_Credit) AND (Net_Delta ∈ [Δ_min, Δ_max])'
    }
  },
  {
    id: 'builder',
    title: 'Strategy Builder Sandbox & Payoff Analysis',
    icon: TrendingUp,
    tag: 'Payoff Lab',
    summary: 'Simulate multi-leg options strategies with real-time T+0 curves, expiration curves, IV offset shocks, and time decay modeling.',
    steps: [
      {
        title: 'Construct Multi-Leg Portfolio',
        description: 'Add, remove, or modify legs. Choose Buy/Sell actions, Call/Put types, strike prices, expiration dates, and lot quantities.',
        proTip: 'Use the quick strategy dropdown to instantly populate pre-built 2-leg and 4-leg templates.'
      },
      {
        title: 'Analyze Dual Payoff Curves (T+0 vs Expiry)',
        description: 'Inspect the solid Cyan curve (T+0 current estimated P&L today) versus the dashed Purple curve (final payoff on expiration day).',
        proTip: 'The vertical gap between the T+0 curve and Expiry curve represents unharvested Theta (time decay) remaining in the position.'
      },
      {
        title: 'Stress-Test with IV Offset Slider',
        description: 'Drag the Implied Volatility slider (+/- 30%) to simulate volatility spikes or post-earnings IV crush on your position.',
        proTip: 'Net option buyers gain from positive IV shocks; net option sellers suffer temporary unrealized drawdowns.'
      },
      {
        title: 'Step Forward in Time with Date Decay Slider',
        description: 'Advance the valuation date day-by-day toward expiry to visualize how daily Theta decay pulls the T+0 curve into the Expiry curve.',
        proTip: 'Notice how Theta decay accelerates rapidly during the final 7 to 10 days before expiration.'
      }
    ],
    details: {
      keyPoints: [
        'Instantaneous interactive Black-Scholes payoff recalculation on every slider movement.',
        'Aggregate strategy Greeks (Net Delta, Gamma, Theta, Vega, Rho) displayed in real time.',
        'Shareable strategy URLs to collaborate with peers or clients.'
      ],
      formulaOrRule: 'P&L(S, t, σ) = Σ [Position_i · (V_i(S, K_i, t, σ + ΔIV) - EntryPrice_i) · LotSize]'
    }
  },
  {
    id: 'backtest',
    title: 'Quantitative Historical Backtester',
    icon: BarChart2,
    tag: 'Quantitative',
    summary: 'Backtest rules-based options strategies across years of historical index data with configurable entry DTE, stop-loss, and profit targets.',
    steps: [
      {
        title: 'Select Historical Date Window & Asset',
        description: 'Choose your testing horizon (e.g. past 1 to 3 years) and underlying index (NIFTY 50, BANKNIFTY).',
        proTip: 'Test across different market regimes (e.g. bull rally, bear correction, sideways chop) to check strategy resilience.'
      },
      {
        title: 'Configure Entry & Exit Rules',
        description: 'Set your entry DTE (e.g. Enter every Thursday at 9:30 AM with 7 DTE), target profit percentage (e.g. 50% max profit), and stop loss multiplier.',
        proTip: 'Exiting credit trades at 50% max profit significantly boosts win rate and reduces tail risk exposure.'
      },
      {
        title: 'Run Backtest Engine',
        description: 'Click "Run Backtest" to compute the trade-by-trade simulation, equity curve, and drawdown profile.',
        proTip: 'The engine models realistic slippage and transaction costs for accurate real-world validation.'
      },
      {
        title: 'Evaluate Key Performance Telemetry',
        description: 'Review total Net Profit (₹), Win Rate (%), Profit Factor, Max Drawdown (%), Sharpe Ratio, and trade logs.',
        proTip: 'A Sharpe Ratio above 1.5 and Profit Factor above 1.8 indicates robust strategy edge.'
      }
    ],
    details: {
      keyPoints: [
        'Historical tick and OHLC option chain snapshots for true-to-life fill simulation.',
        'Interactive equity curve and drawdown profile visualizer.',
        'Export detailed trade-by-trade CSV logs for further quantitative analysis.'
      ],
      formulaOrRule: 'Profit Factor = Gross Profits / Gross Losses | Sharpe Ratio = (Mean Excess Return) / Standard Deviation'
    }
  },
  {
    id: 'cone',
    title: 'Volatility Cone & Implied Volatility Analysis',
    icon: Activity,
    tag: 'Volatility Lab',
    summary: 'Compare current Implied Volatility against multi-horizon historical volatility percentiles to detect mispriced options.',
    steps: [
      {
        title: 'Inspect Multi-Horizon Lookback Windows',
        description: 'Observe the volatility cone spanning 7, 14, 30, 45, 60, 90, 180, and 252-day lookback horizons.',
        proTip: 'Shorter lookback windows (7-14 days) reflect near-term volatility catalysts; longer windows show structural baseline.'
      },
      {
        title: 'Locate Current IV on Percentile Bands',
        description: 'Check where the yellow current IV line sits relative to the 10th, 25th, Median (50th), 75th, and 90th percentile bands.',
        proTip: 'Current IV above the 75th/90th percentile indicates statistically overpriced volatility (favorable for option sellers).'
      },
      {
        title: 'Identify Mean-Reversion Opportunities',
        description: 'When IV is at extreme percentiles, expect mean-reversion toward the median over the lifecycle of the contract.',
        proTip: 'Pair high IV percentile with range-bound technical indicators for optimal Iron Condor win rates.'
      }
    ],
    details: {
      keyPoints: [
        'Real-time percentile ranking of current IV vs historical realized volatility.',
        'Clear visual identification of overpriced vs underpriced options regimes.',
        'Useful for determining when to buy volatility (debit) vs sell volatility (credit).'
      ],
      formulaOrRule: 'Realized Volatility (HV) = √( 252 / N · Σ (ln(S_t / S_{t-1}))² ) · 100%'
    }
  },
  {
    id: 'rsi_scanner',
    title: 'Multi-Timeframe RSI Momentum Scanner',
    icon: Sliders,
    tag: 'Technical Screener',
    summary: 'Screen momentum divergences and overbought/oversold extremes across 15m, 1h, and Daily intervals.',
    steps: [
      {
        title: 'Monitor Multi-Timeframe Signals',
        description: 'Scan across 15-minute, 1-hour, and Daily RSI values for all major index underlyings and F&O equities.',
        proTip: 'Aligning Daily trend with 15m momentum provides high-probability entry confluence.'
      },
      {
        title: 'Filter Overbought (> 70) & Oversold (< 30) Extremes',
        description: 'Identify stocks showing momentum exhaustion paired with high options Implied Volatility.',
        proTip: 'RSI > 75 with heavy Call Open Interest build-up represents strong overhead resistance for Bear Call Spreads.'
      },
      {
        title: 'Select Matching Options Strategies',
        description: 'Deploy Bull Put Spreads on oversold bounces and Bear Call Spreads on overbought rejections.',
        proTip: 'Use Delta-neutral setups when RSI oscillates in the neutral 45-55 zone.'
      }
    ],
    details: {
      keyPoints: [
        'Multi-timeframe RSI momentum calculation with automated live refresh.',
        'Combined technical momentum and options open interest signals.',
        'Direct 1-click filter link to Strategy Screener.'
      ],
      formulaOrRule: 'RSI = 100 - (100 / (1 + RS)), where RS = Average Gain / Average Loss over N periods'
    }
  },
  {
    id: 'portfolios',
    title: 'Portfolio Manager & Paper Trading Book',
    icon: Briefcase,
    tag: 'Execution Book',
    summary: 'Track live positions, forward-test strategies in paper trading, and monitor aggregated portfolio Greeks.',
    steps: [
      {
        title: 'Inspect Live Mark-to-Market (MTM) P&L',
        description: 'View real-time realized and unrealized profit/loss across all active strategy books, updated on every tick.',
        proTip: 'Group positions by strategy or underlying symbol to track individual strategy performance.'
      },
      {
        title: 'Monitor Aggregate Portfolio Greeks',
        description: 'Check combined Net Delta, Net Gamma, and Net Daily Theta cash-flow for your entire options portfolio.',
        proTip: 'Keep total portfolio Delta within your risk tolerance limit to avoid unwanted directional bias.'
      },
      {
        title: 'Forward-Test in Paper Trading Book',
        description: 'Execute simulated trades with realistic fills, margin tracking, and exit rules without risking live capital.',
        proTip: 'Use Paper Trading to benchmark new automated scanner alert rules before live capital deployment.'
      },
      {
        title: 'One-Click Square-Off All Legs',
        description: 'Click "Close Position" to exit all legs of a strategy simultaneously, eliminating leg-out execution risk.',
        proTip: 'Always close multi-leg positions simultaneously to avoid naked risk exposure.'
      }
    ],
    details: {
      keyPoints: [
        'Real-time P&L synchronization with ticking option chain spreads.',
        'Consolidated portfolio Greek risk metrics.',
        'Full trade history, execution prices, and performance analytics.'
      ],
      formulaOrRule: 'Portfolio Net Theta = Σ (Theta_i · Quantity_i · LotSize_i) ₹/calendar day'
    }
  },
  {
    id: 'hedging',
    title: 'Automated Hedging Advisor & Delta Neutralizer',
    icon: ShieldAlert,
    tag: 'Risk Protection',
    summary: 'Detect portfolio directional skew and calculate cost-effective hedge legs to restore Delta-neutrality.',
    steps: [
      {
        title: 'Inspect Portfolio Directional Skew',
        description: 'The Hedging Advisor continuously evaluates your total Net Delta and Gamma exposure across all open strategies.',
        proTip: 'A large positive Delta exposes your portfolio to market drops; large negative Delta hurts you in sudden rallies.'
      },
      {
        title: 'Review Recommended Hedge Structures',
        description: 'The advisor suggests optimal hedge instruments: OTM Protective Puts/Calls or Index Futures contracts.',
        proTip: 'Compare the capital drag and theta decay cost of option hedges vs futures hedges.'
      },
      {
        title: 'Execute Hedge with One Click',
        description: 'Approve the suggested hedge order to immediately balance your portfolio Delta back to 0.00.',
        proTip: 'Set automatic hedge alerts ahead of high-volatility events like RBI MPC rate decisions or earnings.'
      }
    ],
    details: {
      keyPoints: [
        'Sub-second calculation of optimal hedge quantities.',
        'Cost optimization comparing option premium decay vs margin requirements.',
        'Gamma protection suggestions for overnight tail risk.'
      ],
      formulaOrRule: 'Required Hedge Delta = -1 · (Current Portfolio Net Delta)'
    }
  },
  {
    id: 'broker',
    title: 'Broker API Integration (Dhan & Kotak Neo)',
    icon: Key,
    tag: 'Live Trading',
    summary: 'Connect your Dhan or Kotak Neo broker accounts for live multi-leg basket order routing with automatic lot normalization.',
    steps: [
      {
        title: 'Obtain Broker API Credentials',
        description: 'Log into your Dhan HQ or Kotak Neo developer portal and generate your Client ID, Access Token, or Consumer Keys.',
        proTip: 'For Dhan, generate a 24-hour JWT Access Token; for Kotak Neo, obtain your Consumer Key & Secret.'
      },
      {
        title: 'Configure Credentials in Profile Modal',
        description: 'Click on the Profile icon in the top header, enter your Client ID and Access Token, and click "Save Credentials".',
        proTip: 'Credentials are encrypted and stored locally in your browser/secure session; never stored in plaintext.'
      },
      {
        title: 'Test Broker Connection',
        description: 'Click "Test Broker Connection" to verify successful authentication, margin balances, and live order permissions.',
        proTip: 'Ensure your broker account has F&O trading segment permissions enabled.'
      },
      {
        title: 'Route Live Multi-Leg Baskets',
        description: 'Once connected, clicking "Trade" on any alert or builder setup will place live multi-leg basket orders with lot normalization.',
        proTip: 'Exchange margin relief is automatically applied to defined-risk spreads on execution.'
      }
    ],
    details: {
      keyPoints: [
        'Seamless integration with Dhan HQ and Kotak Neo API endpoints.',
        'Automatic lot size normalization (e.g. 50 for NIFTY, 30 for BANKNIFTY).',
        'Support for multi-leg basket execution and margin relief verification.'
      ],
      formulaOrRule: 'Order Total Quantity = Selected Lots · Instrument Lot Size'
    }
  },
  {
    id: 'greeks_math',
    title: 'Options Greeks Masterclass & Mathematical Formulas',
    icon: Zap,
    tag: 'Math Reference',
    summary: 'Deep dive into Black-Scholes-Merton equations, analytical Greek derivatives, and Probability of Profit calculations.',
    steps: [
      {
        title: 'Delta (Δ) — Directional Sensitivity',
        description: 'Delta measures the rate of change of option price per ₹1 movement in the underlying. Call Delta ranges from 0 to +1; Put Delta ranges from -1 to 0.',
        proTip: 'Delta also serves as a rough rule-of-thumb proxy for the Probability of Expiring In-The-Money.'
      },
      {
        title: 'Gamma (Γ) — Directional Acceleration',
        description: 'Gamma measures the change in Delta per ₹1 spot movement. Gamma is highest for At-The-Money options near expiry (Pin Risk).',
        proTip: 'Option sellers want to keep aggregate Gamma low to avoid sudden sharp delta swings on large spot jumps.'
      },
      {
        title: 'Theta (Θ) — Time Decay Rate',
        description: 'Theta represents daily premium decay. Option sellers collect positive Theta; option buyers pay Theta decay.',
        proTip: 'Theta decay accelerates exponentially during the final 10 days before contract expiration.'
      },
      {
        title: 'Vega (ν) — Volatility Sensitivity',
        description: 'Vega measures the change in option price per 1% shift in Implied Volatility. Highest for longer-dated options.',
        proTip: 'Credit sellers profit when Implied Volatility drops (IV Crush after events).'
      }
    ],
    details: {
      keyPoints: [
        'Analytical Black-Scholes-Merton (1973) closed-form solutions.',
        'Newton-Raphson iterative solver for exact Implied Volatility extraction.',
        'Analytical Probability of Profit (POP) and Expected Value mathematical formulas.'
      ],
      formulaOrRule: 'd1 = [ln(S/K) + (r + σ²/2)T] / (σ√T) | d2 = d1 - σ√T'
    }
  }
];

export const HelpPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [faqCategory, setFaqCategory] = useState<'all' | 'scanner' | 'builder' | 'greeks' | 'broker' | 'backtest'>('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Active topic guide state
  const [selectedTopicId, setSelectedTopicId] = useState<string>('chain');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Interactive Payoff Simulator state in Help Guide
  const [simIvOffset, setSimIvOffset] = useState<number>(0);
  const [simDaysToExpiry, setSimDaysToExpiry] = useState<number>(7);

  // Video modal player state
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  // Support ticket form state
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('general');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const selectedTopic = useMemo(() => {
    return TOPIC_GUIDES.find(t => t.id === selectedTopicId) || TOPIC_GUIDES[0];
  }, [selectedTopicId]);

  // Reset step index when switching topics
  useEffect(() => {
    setCurrentStepIndex(0);
  }, [selectedTopicId]);

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
      setTicketSubject('');
      setTicketMessage('');
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header Banner & PDF Download Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-gray-950 via-slate-900 to-gray-950 p-6 md:p-8 flex flex-col items-center text-center gap-5 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.15),transparent_70%)] pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentCyan/10 border border-accentCyan/30 text-accentCyan text-[11px] font-extrabold uppercase tracking-widest animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          Interactive Animated Documentation & Help System
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold text-white uppercase tracking-wider">
          Option Oracle Knowledge Base & User Manual
        </h2>
        
        <p className="text-xs md:text-sm text-gray-300 max-w-2xl leading-relaxed">
          Explore interactive step-by-step animated tutorials for every trading module, live simulated payoff visualizers, Greeks masterclass, or download the complete 15-page publication-grade PDF manual.
        </p>

        {/* Action Buttons: PDF Download & Search */}
        <div className="flex flex-wrap items-center justify-center gap-4 w-full max-w-2xl mt-2">
          {/* Download Complete PDF Manual Button */}
          <a
            href="/Option_Oracle_Complete_User_Manual.pdf"
            download="Option_Oracle_Complete_User_Manual.pdf"
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accentBrand via-cyan-600 to-accentCyan text-white font-extrabold text-xs shadow-lg shadow-cyan-500/20 hover:scale-105 transition-all duration-200 border border-cyan-300/30 group cursor-pointer"
          >
            <Download className="w-4 h-4 group-hover:animate-bounce" />
            <span>Download Complete PDF Manual</span>
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full border border-white/20">15 Pages • Illustrated</span>
          </a>

          {/* Search Bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search topics, Greek formulas, alerts, hotkeys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-950/80 border border-borderClr/80 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accentCyan focus:ring-1 focus:ring-accentCyan/30 transition-all shadow-inner"
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
      </div>

      {/* SECTION 1: INTERACTIVE ANIMATED TOPIC GUIDES */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-borderClr/30 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accentCyan/10 border border-accentCyan/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-accentCyan" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-extrabold text-white uppercase tracking-wider">
                Interactive Animated Topic Guides
              </h3>
              <p className="text-[11px] text-gray-400">
                Select any module below to inspect step-by-step interactive simulated walkthroughs and live diagrams.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-accentCyan bg-accentCyan/10 border border-accentCyan/30 px-2.5 py-1 rounded-lg">
            {TOPIC_GUIDES.length} Modules Available
          </span>
        </div>

        {/* Topic Selector Tabs (Scrollable Bar) */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-800">
          {TOPIC_GUIDES.map((topic) => {
            const IconComponent = topic.icon;
            const isSelected = selectedTopicId === topic.id;
            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 border ${
                  isSelected
                    ? 'bg-accentCyan/15 text-accentCyan border-accentCyan shadow-md shadow-accentCyan/10'
                    : 'bg-gray-950/60 text-gray-400 border-borderClr/30 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                <IconComponent className={`w-4 h-4 ${isSelected ? 'text-accentCyan' : 'text-gray-500'}`} />
                <span>{topic.title}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                  isSelected ? 'bg-accentCyan/20 text-accentCyan' : 'bg-gray-800 text-gray-500'
                }`}>
                  {topic.tag}
                </span>
              </button>
            );
          })}
        </div>

        {/* Main Topic Interactive Card */}
        <div className="glass-panel border border-borderClr/40 rounded-2xl p-6 md:p-8 bg-gradient-to-b from-gray-950/80 to-slate-950/90 flex flex-col gap-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-borderClr/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accentBrand/20 to-accentCyan/20 border border-accentCyan/40 flex items-center justify-center text-accentCyan shadow-inner">
                {React.createElement(selectedTopic.icon, { className: 'w-6 h-6' })}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base md:text-lg font-extrabold text-white">
                    {selectedTopic.title}
                  </h4>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-accentCyan/10 text-accentCyan border border-accentCyan/30">
                    {selectedTopic.tag}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedTopic.summary}
                </p>
              </div>
            </div>

            {/* Step navigation indicator */}
            <div className="flex items-center gap-2 bg-gray-950 p-1.5 rounded-xl border border-borderClr/40 self-start md:self-auto">
              <span className="text-[11px] font-bold text-gray-400 px-2">
                Step {currentStepIndex + 1} of {selectedTopic.steps.length}
              </span>
              <button
                onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
                disabled={currentStepIndex === 0}
                className="p-1.5 rounded-lg bg-gray-900 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:text-gray-300 transition-all"
                title="Previous Step"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentStepIndex(prev => Math.min(selectedTopic.steps.length - 1, prev + 1))}
                disabled={currentStepIndex === selectedTopic.steps.length - 1}
                className="p-1.5 rounded-lg bg-gray-900 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:text-gray-300 transition-all"
                title="Next Step"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Grid Layout: Left Column Walkthrough Steps, Right Column Live Animated Visualizer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Interactive Steps List */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Step-by-Step Simulated Walkthrough
                </span>
                <span className="text-[10px] text-gray-500">
                  Click any step to inspect details
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {selectedTopic.steps.map((step, idx) => {
                  const isActive = currentStepIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setCurrentStepIndex(idx)}
                      className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col gap-2 ${
                        isActive
                          ? 'bg-cyan-950/20 border-accentCyan shadow-lg shadow-cyan-500/5 translate-x-1'
                          : 'bg-gray-950/40 border-borderClr/30 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                            isActive ? 'bg-accentCyan text-black font-black' : 'bg-gray-800 text-gray-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                            {step.title}
                          </span>
                        </div>
                        {isActive && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-accentCyan/20 text-accentCyan border border-accentCyan/40">
                            Active Step
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-400 leading-relaxed pl-8.5">
                        {step.description}
                      </p>

                      {step.proTip && isActive && (
                        <div className="mt-2 ml-8.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2 text-[10px] text-emerald-300 animate-fadeIn">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-emerald-200">PRO TRADER TIP:</strong> {step.proTip}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Formula & Rule Callout */}
              {selectedTopic.details.formulaOrRule && (
                <div className="p-3.5 rounded-xl bg-gray-950 border border-borderClr/60 flex flex-col gap-1.5 text-xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-accentCyan" />
                    Quantitative Formula / Execution Rule
                  </span>
                  <code className="font-mono text-[11px] text-cyan-300 bg-black/60 p-2 rounded-lg border border-cyan-500/20">
                    {selectedTopic.details.formulaOrRule}
                  </code>
                </div>
              )}
            </div>

            {/* Right Column: Live Interactive Dynamic Visualizer */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-accentCyan" />
                  Live Visual Simulation & Dynamic Playground
                </span>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Simulated Real-Time
                </span>
              </div>

              {/* Dynamic Interactive Visualizer Panel */}
              <div className="glass-panel border border-borderClr/40 rounded-2xl p-5 bg-black/60 flex flex-col gap-5 relative overflow-hidden min-h-[360px] justify-between">
                
                {/* Topic-Specific Interactive Visual Component */}
                {selectedTopicId === 'builder' ? (
                  /* Live Interactive Payoff Curve Canvas */
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-borderClr/30 pb-2">
                      <span className="text-xs font-bold text-white">
                        Iron Condor Payoff Simulation (NIFTY 22,500)
                      </span>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1 text-cyan-400">
                          <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" /> T+0 Today
                        </span>
                        <span className="flex items-center gap-1 text-purple-400">
                          <span className="w-2.5 h-0.5 bg-purple-400 border-dashed inline-block" /> Expiry
                        </span>
                      </div>
                    </div>

                    {/* SVG Animated Payoff Chart */}
                    <div className="w-full h-44 bg-gray-950 rounded-xl relative border border-borderClr/40 overflow-hidden flex items-center justify-center p-2">
                      <svg className="w-full h-full" viewBox="0 0 400 160">
                        {/* Grid lines */}
                        <line x1="0" y1="80" x2="400" y2="80" stroke="#334155" strokeWidth="1" />
                        <line x1="200" y1="0" x2="200" y2="160" stroke="#eab308" strokeWidth="1" strokeDasharray="3 3" />
                        
                        {/* Expiry Payoff (Trapezoid / Iron Condor) */}
                        <path
                          d="M 20 120 L 100 120 L 150 40 L 250 40 L 300 120 L 380 120"
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                        />

                        {/* Interactive T+0 Curve with simulated IV Offset and DTE decay */}
                        {(() => {
                          const ivShift = simIvOffset * 0.8;
                          const decayShift = (7 - simDaysToExpiry) * 4;
                          const p2Y = 40 + (10 - decayShift) + ivShift;
                          const pathD = `M 20 ${Math.min(145, Math.max(15, 115 - decayShift * 0.4 + ivShift))} Q 100 ${110 + ivShift}, 150 ${p2Y} T 200 ${p2Y - 5} T 250 ${p2Y} T 300 ${110 + ivShift} T 380 ${Math.min(145, Math.max(15, 115 - decayShift * 0.4 + ivShift))}`;
                          return (
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#00f2fe"
                              strokeWidth="3"
                              className="transition-all duration-300"
                            />
                          );
                        })()}

                        {/* Current Spot Marker */}
                        <circle cx="200" cy="80" r="4" fill="#eab308" />
                        <text x="205" y="75" fill="#eab308" fontSize="9" fontWeight="bold">Spot: 22,500</text>
                      </svg>
                    </div>

                    {/* Interactive Sliders */}
                    <div className="grid grid-cols-2 gap-4 bg-gray-950/80 p-3 rounded-xl border border-borderClr/30 text-xs">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>IV Offset Shift</span>
                          <span className="font-mono text-cyan-400 font-bold">{simIvOffset > 0 ? `+${simIvOffset}%` : `${simIvOffset}%`}</span>
                        </div>
                        <input
                          type="range"
                          min="-30"
                          max="30"
                          step="5"
                          value={simIvOffset}
                          onChange={(e) => setSimIvOffset(Number(e.target.value))}
                          className="w-full accent-accentCyan cursor-pointer h-1.5 bg-gray-800 rounded-lg"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>Days to Expiry (DTE)</span>
                          <span className="font-mono text-purple-400 font-bold">{simDaysToExpiry} DTE</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="14"
                          step="1"
                          value={simDaysToExpiry}
                          onChange={(e) => setSimDaysToExpiry(Number(e.target.value))}
                          className="w-full accent-purple-500 cursor-pointer h-1.5 bg-gray-800 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                ) : selectedTopicId === 'alerts' ? (
                  /* Animated Alerts Flow Simulator */
                  <div className="flex flex-col gap-4">
                    <span className="text-xs font-bold text-white border-b border-borderClr/30 pb-2">
                      Auto-Scanner Trigger Pipeline
                    </span>
                    <div className="flex flex-col gap-3">
                      <div className="p-3 rounded-xl bg-gray-950 border border-cyan-500/30 flex items-center justify-between animate-pulse">
                        <div className="flex items-center gap-2.5">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          <div>
                            <div className="text-xs font-bold text-white">Live Market Scan Active</div>
                            <div className="text-[10px] text-gray-400">Evaluating 420 multi-leg combinations / 5s</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                          SCANNING
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <div>
                            <div className="text-xs font-bold text-white">Match Found: NIFTY 22800 IC</div>
                            <div className="text-[10px] text-emerald-400">POP: 74.2% • Net Credit: ₹4,850 • Margin: ₹52,000</div>
                          </div>
                        </div>
                        <button className="px-2.5 py-1 rounded bg-emerald-500 text-black text-[10px] font-extrabold uppercase hover:scale-105 transition-all">
                          Trade
                        </button>
                      </div>
                    </div>
                  </div>
                ) : selectedTopicId === 'backtest' ? (
                  /* Animated Equity Curve & Stats */
                  <div className="flex flex-col gap-4">
                    <span className="text-xs font-bold text-white border-b border-borderClr/30 pb-2">
                      Quantitative Strategy Performance Simulation
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-950 p-2 rounded-lg border border-borderClr/30">
                        <div className="text-[9px] text-gray-400 uppercase">Win Rate</div>
                        <div className="text-sm font-extrabold text-emerald-400 font-mono">76.4%</div>
                      </div>
                      <div className="bg-gray-950 p-2 rounded-lg border border-borderClr/30">
                        <div className="text-[9px] text-gray-400 uppercase">Profit Factor</div>
                        <div className="text-sm font-extrabold text-cyan-400 font-mono">2.18</div>
                      </div>
                      <div className="bg-gray-950 p-2 rounded-lg border border-borderClr/30">
                        <div className="text-[9px] text-gray-400 uppercase">Max Drawdown</div>
                        <div className="text-sm font-extrabold text-red-400 font-mono">-6.2%</div>
                      </div>
                    </div>
                    <div className="w-full h-28 bg-gray-950 rounded-xl p-2 border border-borderClr/40 flex items-end">
                      <svg className="w-full h-full" viewBox="0 0 300 80">
                        <path
                          d="M 0 70 Q 50 60, 100 45 T 180 30 T 240 18 T 300 10"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                        />
                        <polygon
                          points="0,70 50,60 100,45 180,30 240,18 300,10 300,80 0,80"
                          fill="rgba(16, 185, 129, 0.15)"
                        />
                      </svg>
                    </div>
                  </div>
                ) : (
                  /* Standard Dynamic Module Visual */
                  <div className="flex flex-col gap-4">
                    <span className="text-xs font-bold text-white border-b border-borderClr/30 pb-2">
                      Key Highlights & Operational Telemetry
                    </span>
                    <div className="flex flex-col gap-2.5">
                      {selectedTopic.details.keyPoints.map((point, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-2 text-xs text-gray-300 bg-gray-950/60 p-2.5 rounded-xl border border-borderClr/30">
                          <Check className="w-4 h-4 text-accentCyan shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Quick Help Card */}
                <div className="p-3 rounded-xl bg-gray-950/90 border border-cyan-500/20 flex items-center justify-between text-xs mt-auto">
                  <div className="flex items-center gap-2 text-gray-300">
                    <FileText className="w-4 h-4 text-accentCyan" />
                    <span>Read full technical specifications in the PDF manual</span>
                  </div>
                  <a
                    href="/Option_Oracle_Complete_User_Manual.pdf"
                    download="Option_Oracle_Complete_User_Manual.pdf"
                    className="text-[10px] font-bold text-accentCyan hover:underline flex items-center gap-1"
                  >
                    View Chapter <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: FAQS & SUPPORT DESK */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FAQs Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-borderClr/20 pb-3">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <HelpCircle className="w-4.5 h-4.5 text-accentCyan" />
              Frequently Asked Questions (FAQ)
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
              { id: 'broker', label: 'Brokers & Paper' },
              { id: 'backtest', label: 'Backtesting' }
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

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Subject <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Background alert delay or Dhan margin setup"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Category</label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accentCyan"
                  >
                    <option value="general">General Inquiry</option>
                    <option value="scanner">Auto-Scanner & Alerts</option>
                    <option value="builder">Strategy Builder & Greeks</option>
                    <option value="broker">Broker Integration (Dhan/Kotak)</option>
                    <option value="bug">Report an Issue</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Message <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe your question or strategy setup in detail..."
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accentCyan placeholder-gray-600 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-lg bg-accentBrand hover:bg-sky-500 text-white font-extrabold uppercase tracking-wider text-[11px] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Submitting Ticket...
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      Submit Support Ticket
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal Player */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-borderClr/60 bg-gray-950 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-borderClr/20">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-accentCyan/20 text-accentCyan border border-accentCyan/30">
                  {activeVideo.category}
                </span>
                <h3 className="text-sm font-bold text-white">
                  {activeVideo.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video w-full bg-black">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="p-4 bg-gray-900/50 text-xs text-gray-400 flex items-center justify-between">
              <span>{activeVideo.description}</span>
              <span className="text-[10px] font-mono text-gray-500 shrink-0 ml-4">
                Duration: {activeVideo.duration}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default HelpPanel;
