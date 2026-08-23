import React, { useState } from 'react';
import { Play, X, Clock } from 'lucide-react';

interface VideoLesson {
  id: string;
  title: string;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  category: string;
  description: string;
  youtubeId: string;
}

const VIDEO_LESSONS: VideoLesson[] = [
  {
    id: 'vid-1',
    title: 'OptionChief in 2 Minutes: Complete Walkthrough',
    duration: '2:15',
    difficulty: 'Beginner',
    category: 'Getting Started',
    description: 'Learn how to log in, select underlying index (NIFTY/BANKNIFTY), inspect live Greeks, build a 4-leg strategy, and execute orders.',
    youtubeId: 'dQw4w9WgXcQ'
  },
  {
    id: 'vid-2',
    title: 'Reading the Option Chain: PCR & Max Pain',
    duration: '3:40',
    difficulty: 'Beginner',
    category: 'Option Chain',
    description: 'Deconstruct real-time Put-Call Ratio (PCR), Max Pain pin levels, Open Interest build-up, and click-to-add legs.',
    youtubeId: 'eUJRonKZzi8'
  },
  {
    id: 'vid-3',
    title: 'Building Multi-Leg Strategies & Payoff Curves',
    duration: '4:50',
    difficulty: 'Intermediate',
    category: 'Strategy Builder',
    description: 'Understand the difference between T+0 Today curves vs Expiry curves, simulating IV Offset shocks, and time decay.',
    youtubeId: 'qWAXYlSpJjU'
  },
  {
    id: 'vid-4',
    title: 'Configuring 24/7 Automated Telegram Alerts',
    duration: '3:15',
    difficulty: 'Intermediate',
    category: 'Automation',
    description: 'How to set up custom screening rules, link your Telegram bot, and receive real-time notifications on your mobile device.',
    youtubeId: '8o_F9Fmnljw'
  },
  {
    id: 'vid-5',
    title: 'Quantitative 1:3:2 Ratio Spreads & Skew Trading',
    duration: '6:10',
    difficulty: 'Advanced',
    category: 'Quantitative Regimes',
    description: 'Master asymmetric 1:3:2 Ratio Spread setups, exploiting implied volatility smile curvature with zero downside risk.',
    youtubeId: 'dQw4w9WgXcQ'
  },
  {
    id: 'vid-6',
    title: 'Live Broker Execution with Dhan & Kotak Neo',
    duration: '3:30',
    difficulty: 'Intermediate',
    category: 'Broker Integration',
    description: 'Connect your Dhan HQ / Kotak Neo API credentials, test connections, and execute multi-leg basket orders with lot normalization.',
    youtubeId: 'eUJRonKZzi8'
  }
];

export const HelpVideoAcademy: React.FC = () => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All');
  const [activeVideo, setActiveVideo] = useState<VideoLesson | null>(null);

  const filteredVideos = VIDEO_LESSONS.filter(
    v => selectedDifficulty === 'All' || v.difficulty === selectedDifficulty
  );

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-1 border-b border-borderClr/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-accentCyan/15 text-accentCyan border border-accentCyan/30">
            Video Academy
          </span>
          <h2 className="text-lg md:text-xl font-extrabold text-white">
            OptionChief Step-by-Step Video Library
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Watch concise 2 to 6-minute masterclasses on every module of OptionChief.
        </p>
      </div>

      {/* Difficulty Filter Tabs */}
      <div className="flex gap-2">
        {['All', 'Beginner', 'Intermediate', 'Advanced'].map((diff) => (
          <button
            key={diff}
            onClick={() => setSelectedDifficulty(diff as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border ${
              selectedDifficulty === diff
                ? 'bg-accentBrand text-white border-accentBrand shadow-md'
                : 'bg-gray-950/60 text-gray-400 border-borderClr/30 hover:text-gray-200'
            }`}
          >
            {diff === 'All' ? 'All Lessons' : `${diff} Level`}
          </button>
        ))}
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVideos.map((video) => (
          <div
            key={video.id}
            onClick={() => setActiveVideo(video)}
            className="glass-panel border border-borderClr/40 rounded-2xl overflow-hidden hover:border-accentBrand transition-all group cursor-pointer flex flex-col justify-between bg-gray-950/40 shadow-xl"
          >
            {/* Thumbnail Canvas */}
            <div className="h-36 w-full bg-gray-950 relative flex items-center justify-center overflow-hidden border-b border-borderClr/20">
              <div className="absolute inset-0 bg-gradient-to-tr from-accentBrand/20 via-gray-900 to-accentCyan/20 group-hover:scale-105 transition-all duration-300" />
              
              <span className="absolute top-2.5 left-2.5 bg-gray-950/90 text-accentCyan border border-accentCyan/30 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
                {video.category}
              </span>

              <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                video.difficulty === 'Beginner' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                video.difficulty === 'Intermediate' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              }`}>
                {video.difficulty}
              </span>

              <span className="absolute bottom-2.5 right-2.5 bg-black/80 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {video.duration}
              </span>

              <div className="w-11 h-11 rounded-full bg-accentBrand/20 group-hover:bg-accentBrand border border-accentBrand flex items-center justify-center transition-all z-10 shadow-lg">
                <Play className="w-5 h-5 text-accentBrand group-hover:text-white fill-current translate-x-0.5" />
              </div>
            </div>

            {/* Video Body */}
            <div className="p-4 flex flex-col gap-2">
              <h4 className="text-xs font-bold text-white group-hover:text-accentBrand transition-colors leading-snug">
                {video.title}
              </h4>
              <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                {video.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Video Modal Player */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-borderClr/60 bg-gray-950 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col animate-scaleUp">
            <div className="px-5 py-4 flex items-center justify-between border-b border-borderClr/20">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-accentBrand/20 text-accentBrand border border-accentBrand/30">
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

            <div className="p-4 bg-gray-900/60 text-xs text-gray-400 flex items-center justify-between">
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
