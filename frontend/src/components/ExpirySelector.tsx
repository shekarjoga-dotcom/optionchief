import React from 'react';
import { useStore } from '../hooks/useStore';
import { Calendar } from 'lucide-react';

export const ExpirySelector: React.FC = () => {
  const { expiryDates, selectedExpiry, setSelectedExpiry, pcr } = useStore();

  if (expiryDates.length === 0) {
    return (
      <div className="bg-cardBg rounded-xl p-3 border border-borderClr/40 flex items-center justify-center text-xs text-gray-500">
        No expiry contracts available.
      </div>
    );
  }

  // Format date to a cleaner readable style, e.g. "25-Jun-2026" or "2026-06-25" -> "25 Jun"
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold uppercase tracking-wider">
          <Calendar className="w-3.5 h-3.5 text-accentCyan" />
          <span>Contract Expiration Cycles</span>
        </div>
        {pcr > 0 && (
          <div className="text-xs text-gray-400">
            Current Expiry PCR: <strong className="text-accentCyan">{pcr.toFixed(2)}</strong>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {expiryDates.map((expiry) => {
          const isActive = selectedExpiry === expiry;
          return (
            <button
              key={expiry}
              onClick={() => setSelectedExpiry(expiry)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border flex flex-col items-center min-w-[70px] ${
                isActive
                  ? "bg-accentCyan border-accentCyan text-black shadow-md shadow-accentCyan/20"
                  : "bg-cardBg border-borderClr/60 text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              <span>{formatDate(expiry)}</span>
              {isActive && <span className="text-[9px] opacity-75 mt-0.5">Active</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
