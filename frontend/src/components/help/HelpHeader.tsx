import React from 'react';
import { Search, Sparkles, Download, X, BookOpen, Compass, Layers, TrendingUp, Video, HelpCircle, FileText, Activity } from 'lucide-react';

interface HelpHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeSection: string;
  setActiveSection: (sec: string) => void;
}

export const HelpHeader: React.FC<HelpHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  activeSection,
  setActiveSection
}) => {
  const navItems = [
    { id: 'hub', label: 'Help Hub', icon: Compass },
    { id: 'ui-explorer', label: 'UI Explorer', icon: Activity },
    { id: 'education', label: 'Options 101', icon: BookOpen },
    { id: 'chain-guide', label: 'Option Chain', icon: Layers },
    { id: 'builder-guide', label: 'Build Strategy', icon: TrendingUp },
    { id: 'library', label: 'Strategy Library', icon: FileText },
    { id: 'videos', label: 'Video Academy', icon: Video },
    { id: 'glossary', label: 'A-Z Glossary', icon: Sparkles },
    { id: 'faq', label: 'FAQs', icon: HelpCircle },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: HelpCircle }
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-accentBrand/30 bg-gradient-to-r from-gray-950 via-slate-900 to-gray-950 p-6 md:p-8 flex flex-col items-center text-center gap-5 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.15),transparent_70%)] pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accentBrand/15 border border-accentBrand/40 text-accentBrand text-xs font-extrabold uppercase tracking-widest animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          Interactive Learning & Knowledge Center
        </div>

        <h1 className="text-2xl md:text-4xl font-extrabold text-white uppercase tracking-wider">
          OptionChief Academy & Documentation
        </h1>

        <p className="text-xs md:text-sm text-gray-300 max-w-2xl leading-relaxed">
          Master options trading from fundamentals to quantitative 1:3:2 Ratio Flies. Follow interactive visual walkthroughs, simulate payoff curves in real time, and learn how to execute with mathematical edge.
        </p>

        {/* Action Controls: PDF Download & Universal Search */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-2xl mt-2">
          {/* Download Complete PDF Manual Button */}
          <a
            href="/Option_Oracle_Complete_User_Manual.pdf"
            download="OptionChief_Complete_User_Manual.pdf"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accentBrand via-indigo-600 to-accentCyan text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 hover:scale-105 transition-all duration-200 border border-blue-400/30 group cursor-pointer"
          >
            <Download className="w-4 h-4 group-hover:animate-bounce" />
            <span>Download PDF Manual</span>
            <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-mono">15 Pages</span>
          </a>

          {/* Search Bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search concepts, Greeks, 1:3:2 Ratio Fly, Dhan broker, Hotkeys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-950/80 border border-borderClr/80 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accentBrand focus:ring-1 focus:ring-accentBrand/40 transition-all shadow-inner"
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

      {/* Navigation Sticky Sub-Tabs Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-800 border-b border-borderClr/30">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSelected = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 border ${
                isSelected
                  ? 'bg-accentBrand text-white border-accentBrand shadow-md shadow-accentBrand/20'
                  : 'bg-gray-950/60 text-gray-400 border-borderClr/30 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
