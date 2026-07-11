import React, { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Search } from 'lucide-react';

const PRESETS = ["NIFTY", "BANKNIFTY", "SENSEX", "ALL_NSE", "RELIANCE", "SPY", "AAPL", "TSLA", "BTC"];

interface AvailableSymbol {
  symbol: string;
  name: string;
  category: 'Index' | 'Commodity' | 'Stock (US)' | 'Stock (IN)' | 'Crypto';
}

const AVAILABLE_SYMBOLS: AvailableSymbol[] = [
  // Indian Indices
  { symbol: "NIFTY", name: "Nifty 50 Index", category: "Index" },
  { symbol: "BANKNIFTY", name: "Nifty Bank Index", category: "Index" },
  { symbol: "SENSEX", name: "BSE SENSEX Index", category: "Index" },
  { symbol: "ALL_NSE", name: "All NSE F&O Stocks", category: "Index" },
  { symbol: "FINNIFTY", name: "Nifty Financial Services Index", category: "Index" },
  { symbol: "MIDCPNIFTY", name: "Nifty Midcap Select Index", category: "Index" },
  { symbol: "NIFTYIT", name: "Nifty IT Index", category: "Index" },
  { symbol: "NIFTYCPSE", name: "Nifty CPSE Index", category: "Index" },
  
  // MCX Commodities
  { symbol: "CRUDEOIL", name: "Crude Oil MCX", category: "Commodity" },
  { symbol: "CRUDEOILM", name: "Crude Oil Mini MCX", category: "Commodity" },
  { symbol: "NATURALGAS", name: "Natural Gas MCX", category: "Commodity" },
  { symbol: "NATGASMINI", name: "Natural Gas Mini MCX", category: "Commodity" },
  { symbol: "GOLD", name: "Gold MCX", category: "Commodity" },
  { symbol: "GOLDM", name: "Gold Mini MCX", category: "Commodity" },
  { symbol: "SILVER", name: "Silver MCX", category: "Commodity" },
  { symbol: "SILVERM", name: "Silver Mini MCX", category: "Commodity" },

  // Cryptocurrencies
  { symbol: "BTC", name: "Bitcoin / USD", category: "Crypto" },
  { symbol: "ETH", name: "Ethereum / USD", category: "Crypto" },

  // US Equities & ETFs
  { symbol: "SPY", name: "SPDR S&P 500 ETF", category: "Stock (US)" },
  { symbol: "QQQ", name: "Invesco QQQ Trust (Nasdaq 100)", category: "Stock (US)" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", category: "Stock (US)" },
  { symbol: "AAPL", name: "Apple Inc.", category: "Stock (US)" },
  { symbol: "MSFT", name: "Microsoft Corporation", category: "Stock (US)" },
  { symbol: "TSLA", name: "Tesla Inc.", category: "Stock (US)" },
  { symbol: "NVDA", name: "NVIDIA Corporation", category: "Stock (US)" },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "Stock (US)" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)", category: "Stock (US)" },
  { symbol: "META", name: "Meta Platforms Inc.", category: "Stock (US)" },

  // Indian Equities
  { symbol: "RELIANCE", name: "Reliance Industries Ltd.", category: "Stock (IN)" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", category: "Stock (IN)" },
  { symbol: "SBIN", name: "State Bank of India", category: "Stock (IN)" },
  { symbol: "ITC", name: "ITC Ltd.", category: "Stock (IN)" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", category: "Stock (IN)" },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd.", category: "Stock (IN)" },
  { symbol: "INFY", name: "Infosys Ltd.", category: "Stock (IN)" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd.", category: "Stock (IN)" },
  { symbol: "LT", name: "Larsen & Toubro Ltd.", category: "Stock (IN)" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd.", category: "Stock (IN)" }
];

export const SymbolSelector: React.FC = () => {
  const { symbol, setSymbol, underlying, isLoading } = useStore();
  const [customInput, setCustomInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      setSymbol(customInput.trim().toUpperCase());
      setCustomInput("");
      setIsOpen(false);
    }
  };

  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym);
    setCustomInput("");
    setIsOpen(false);
  };

  // Filter symbols based on typed search query (checks symbol code and asset name)
  const query = customInput.trim().toLowerCase();
  const filtered = query 
    ? AVAILABLE_SYMBOLS.filter(s => 
        s.symbol.toLowerCase().includes(query) || 
        s.name.toLowerCase().includes(query)
      ).slice(0, 8)
    : [];

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Search Input and Presets */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Select Underlying Asset</label>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setSymbol(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                symbol === preset
                  ? "bg-accentBrand border-accentBrand text-white shadow-md shadow-accentBrand/20"
                  : "border-borderClr text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              {preset}
            </button>
          ))}
          
          <form onSubmit={handleSubmit} className="relative flex items-center ml-2">
            <input
              type="text"
              placeholder="Search symbol..."
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onBlur={() => setTimeout(() => setIsOpen(false), 200)}
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-cardBgLight border border-borderClr text-white placeholder-gray-500 focus:outline-none focus:border-accentBrand w-44 transition-all"
            />
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-gray-500" />

            {/* Autocomplete Dropdown List */}
            {isOpen && filtered.length > 0 && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-gray-950 border border-borderClr/80 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md max-h-60 overflow-y-auto">
                {filtered.map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => handleSelectSymbol(item.symbol)}
                    className="flex items-center justify-between px-3 py-2 hover:bg-accentBrand/15 hover:text-white transition-all cursor-pointer border-b border-borderClr/10 last:border-b-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-white tracking-wider">{item.symbol}</span>
                      <span className="text-[10px] text-gray-400">{item.name}</span>
                    </div>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                      item.category === 'Index' 
                        ? 'bg-accentCyan/10 text-accentCyan border border-accentCyan/20'
                        : item.category === 'Commodity'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : item.category === 'Stock (US)'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : item.category === 'Crypto'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-greenBrand/10 text-greenBrand border border-greenBrand/20'
                    }`}>
                      {item.category.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Quote Display Dashboard */}
      {underlying && (
        <div className="flex items-center gap-6 border-l border-borderClr/60 pl-6">
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              {underlying.symbol}
              {isLoading && <span className="w-2 h-2 rounded-full bg-accentCyan animate-ping" />}
            </span>
            <span className="text-xs text-gray-500">Spot Market Price</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xl font-extrabold text-white">
              {underlying.spot.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className={`text-xs font-semibold flex items-center ${underlying.change >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
              {underlying.change >= 0 ? "+" : ""}{underlying.change.toFixed(2)} ({underlying.pct_change.toFixed(2)}%)
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-4 text-xs text-gray-400 border-l border-borderClr/30 pl-4">
            <div className="flex flex-col">
              <span>Open: <strong className="text-white">{underlying.open.toFixed(2)}</strong></span>
              <span>High: <strong className="text-white">{underlying.high.toFixed(2)}</strong></span>
            </div>
            <div className="flex flex-col">
              <span>Low: <strong className="text-white">{underlying.low.toFixed(2)}</strong></span>
              <span>Close: <strong className="text-white">{underlying.previous_close.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
