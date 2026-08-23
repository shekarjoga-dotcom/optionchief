import React, { useState } from 'react';
import { HelpHeader } from './help/HelpHeader';
import { HelpUIExplorer } from './help/HelpUIExplorer';
import { HelpCoreEducation } from './help/HelpCoreEducation';
import { HelpOptionChainGuide } from './help/HelpOptionChainGuide';
import { HelpStrategyBuilderGuide } from './help/HelpStrategyBuilderGuide';
import { HelpStrategyLibrary } from './help/HelpStrategyLibrary';
import { HelpVideoAcademy } from './help/HelpVideoAcademy';
import { HelpGlossary } from './help/HelpGlossary';
import { HelpFAQ } from './help/HelpFAQ';
import { HelpTroubleshooting } from './help/HelpTroubleshooting';
import { HelpSupportDesk } from './help/HelpSupportDesk';

import { 
  Layers, 
  TrendingUp, 
  FileText, 
  Video, 
  Activity, 
  ArrowRight,
  Zap,
  BookOpen
} from 'lucide-react';

export const HelpPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('hub');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 6 Core Hub Cards on Homepage
  const hubCards = [
    {
      id: 'ui-explorer',
      title: 'Terminal UI Explorer',
      badge: 'Beginner',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: Activity,
      summary: 'Explore annotated full-screen blueprints with numbered hotspots for every button and chart.',
      linkText: 'Launch UI Explorer'
    },
    {
      id: 'education',
      title: 'Options 101 Masterclass',
      badge: 'Beginner',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: BookOpen,
      summary: 'Learn Calls, Puts, ITM/ATM/OTM zones, Expiry cycles, and dynamic Black-Scholes payoffs.',
      linkText: 'Start Learning'
    },
    {
      id: 'chain-guide',
      title: 'Option Chain Visual Guide',
      badge: 'Intermediate',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      icon: Layers,
      summary: 'Master the live Matrix: Delta, Theta, Gamma, IV %, Put-Call Ratio (PCR), and Max Pain.',
      linkText: 'Read Matrix Guide'
    },
    {
      id: 'builder-guide',
      title: '12-Step Strategy Builder',
      badge: 'Intermediate',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      icon: TrendingUp,
      summary: 'Follow the 12-step visual walkthrough to build multi-leg spreads and analyze risk.',
      linkText: 'Start Builder Walkthrough'
    },
    {
      id: 'library',
      title: 'Visual Strategy Library',
      badge: 'Advanced',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      icon: FileText,
      summary: 'Standardized institutional templates: Iron Condor, 1:3:2 Ratio Fly, and Vertical Spreads.',
      linkText: 'Browse Strategy Library'
    },
    {
      id: 'videos',
      title: 'Video Academy',
      badge: 'All Levels',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: Video,
      summary: 'Watch concise 2-6 minute masterclass videos covering real-world execution and setup.',
      linkText: 'Watch Video Lessons'
    }
  ];

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header, PDF Download & Universal Nav Bar */}
      <HelpHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {/* RENDER ACTIVE SECTION */}
      {activeSection === 'hub' && (
        <div className="flex flex-col gap-8 text-left animate-fadeIn">
          {/* 6 Major Learning Hub Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {hubCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  onClick={() => setActiveSection(card.id)}
                  className="glass-panel p-6 rounded-2xl border border-borderClr/40 bg-gray-950/40 hover:border-accentBrand/60 hover:bg-gray-950/70 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 group shadow-xl relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-accentBrand/10 border border-accentBrand/30 flex items-center justify-center text-accentBrand group-hover:scale-110 transition-transform">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${card.badgeColor}`}>
                        {card.badge}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-white group-hover:text-accentBrand transition-colors">
                      {card.title}
                    </h3>

                    <p className="text-xs text-gray-400 leading-relaxed">
                      {card.summary}
                    </p>
                  </div>

                  <div className="flex items-center text-xs font-bold text-accentCyan group-hover:translate-x-1 transition-transform gap-1 pt-2 border-t border-borderClr/20">
                    <span>{card.linkText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Learning Path Banner */}
          <div className="glass-panel p-6 md:p-8 rounded-3xl border border-accentBrand/30 bg-gradient-to-r from-gray-950 via-slate-950 to-gray-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentCyan/15 border border-accentCyan/30 text-accentCyan text-[11px] font-bold">
                <Zap className="w-3.5 h-3.5" />
                <span>Recommended First-Time Trader Pathway</span>
              </div>
              <h3 className="text-lg md:text-xl font-extrabold text-white">
                New to OptionChief? Follow the 4-Stage Pathway
              </h3>
              <p className="text-xs text-gray-300 max-w-xl leading-relaxed">
                1. Explore Terminal UI ➔ 2. Read Options 101 ➔ 3. Build a Test Strategy in Paper Book ➔ 4. Connect Dhan / Kotak for live execution.
              </p>
            </div>

            <button
              onClick={() => setActiveSection('ui-explorer')}
              className="px-6 py-3 rounded-xl bg-accentBrand hover:bg-accentBrand/90 text-white font-extrabold text-xs shadow-lg shadow-accentBrand/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <span>Begin Stage 1 (UI Explorer)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Embedded FAQ & Support Desk for Quick Answers */}
          <div className="space-y-8 pt-4">
            <HelpFAQ />
            <HelpSupportDesk />
          </div>
        </div>
      )}

      {/* SUB-SECTION MODULES */}
      {activeSection === 'ui-explorer' && <HelpUIExplorer />}
      {activeSection === 'education' && <HelpCoreEducation />}
      {activeSection === 'chain-guide' && <HelpOptionChainGuide />}
      {activeSection === 'builder-guide' && <HelpStrategyBuilderGuide />}
      {activeSection === 'library' && <HelpStrategyLibrary />}
      {activeSection === 'videos' && <HelpVideoAcademy />}
      {activeSection === 'glossary' && <HelpGlossary />}
      {activeSection === 'faq' && <HelpFAQ />}
      {activeSection === 'troubleshooting' && <HelpTroubleshooting />}
    </div>
  );
};

export default HelpPanel;
