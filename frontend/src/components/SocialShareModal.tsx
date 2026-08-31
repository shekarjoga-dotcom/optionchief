import React, { useRef, useState, useEffect } from 'react';
import { 
  Share2, 
  Download, 
  Copy, 
  Check, 
  X, 
  Send, 
  MessageCircle, 
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';
import logoImg from '../assets/logo.png';
import { getCurrencySymbol } from '../utils/optionsMath';

export interface SocialShareData {
  title: string;
  symbol: string;
  spot: number;
  expiry?: string;
  legs: Array<{
    action: 'BUY' | 'SELL';
    quantity: number;
    strike: number;
    optionType: 'C' | 'P' | 'F';
    entryPrice?: number;
  }>;
  metrics: {
    maxProfit: number | string;
    maxLoss: number | string;
    pop?: number;
    marginRequirement?: number;
    netDebitCredit?: number;
    breakEvens?: number[];
    delta?: number;
    gamma?: number;
    theta?: number;
  };
  payoffPoints?: Array<{
    price: number;
    pnlCurrent: number;
    pnlExpiration: number;
  }>;
}

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SocialShareData | null;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !data) return;

    // Draw card on canvas
    const canvas = canvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1200;
    const height = 675;
    canvas.width = width;
    canvas.height = height;

    const cur = getCurrencySymbol(data.symbol);

    // 1. Background Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#030712');
    bgGradient.addColorStop(0.5, '#0b0f19');
    bgGradient.addColorStop(1, '#020617');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle background glowing circles
    const glow1 = ctx.createRadialGradient(200, 100, 10, 200, 100, 300);
    glow1.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, width, height);

    const glow2 = ctx.createRadialGradient(1000, 400, 10, 1000, 400, 350);
    glow2.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);

    // Border Frame
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // 2. Header: Logo & Branding
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.src = logoImg;

    const renderContents = () => {
      // Draw Logo
      try {
        ctx.save();
        ctx.beginPath();
        ctx.arc(60, 60, 24, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.clip();
        ctx.drawImage(logo, 36, 36, 48, 48);
        ctx.restore();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(60, 60, 24, 0, Math.PI * 2);
        ctx.stroke();
      } catch {
        // Fallback badge
      }

      // Title & Tagline
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.fillText('optionchief.in', 96, 56);

      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.fillText('F&O STRATEGY & RISK TERMINAL', 96, 75);

      // Strategy Title & Spot
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      const stratTitle = data.title.length > 38 ? data.title.substring(0, 35) + '...' : data.title;
      ctx.fillText(stratTitle, 40, 130);

      // Symbol & Spot Pill
      ctx.fillStyle = 'rgba(31, 41, 55, 0.8)';
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.6)';
      ctx.lineWidth = 1;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(40, 145, 260, 34, 8);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(40, 145, 260, 34);
        ctx.strokeRect(40, 145, 260, 34);
      }

      ctx.fillStyle = '#9ca3af';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${data.symbol} Spot:`, 55, 167);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${cur}${data.spot.toLocaleString()}`, 170, 167);

      // Strategy Legs Badges
      let legX = 40;
      const legY = 195;
      data.legs.slice(0, 4).forEach((leg) => {
        const isBuy = leg.action === 'BUY';
        const typeStr = leg.optionType === 'C' ? 'CE' : leg.optionType === 'P' ? 'PE' : 'FUT';
        const label = `${leg.action} ${leg.quantity}x ${typeStr} ${leg.strike}`;
        
        ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
        const textWidth = ctx.measureText(label).width;
        const badgeWidth = textWidth + 24;

        ctx.fillStyle = isBuy ? 'rgba(6, 78, 59, 0.5)' : 'rgba(127, 29, 29, 0.5)';
        ctx.strokeStyle = isBuy ? 'rgba(52, 211, 153, 0.6)' : 'rgba(248, 113, 113, 0.6)';
        ctx.lineWidth = 1;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(legX, legY, badgeWidth, 26, 6);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(legX, legY, badgeWidth, 26);
          ctx.strokeRect(legX, legY, badgeWidth, 26);
        }

        ctx.fillStyle = isBuy ? '#34d399' : '#f87171';
        ctx.fillText(label, legX + 12, legY + 18);
        legX += badgeWidth + 10;
      });

      // 3. Draw Payoff Chart Area (Left Side)
      const chartX = 40;
      const chartY = 240;
      const chartW = 740;
      const chartH = 340;

      // Chart background box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(chartX, chartY, chartW, chartH, 12);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(chartX, chartY, chartW, chartH);
        ctx.strokeRect(chartX, chartY, chartW, chartH);
      }

      // Chart Plotting
      if (data.payoffPoints && data.payoffPoints.length > 2) {
        const points = data.payoffPoints;
        const prices = points.map(p => p.price);
        const pnlsExp = points.map(p => p.pnlExpiration);
        const pnlsCurr = points.map(p => p.pnlCurrent);

        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const minPnl = Math.min(...pnlsExp, ...pnlsCurr, -1000);
        const maxPnl = Math.max(...pnlsExp, ...pnlsCurr, 1000);
        const pnlSpan = Math.max(1, maxPnl - minPnl);

        const mapX = (price: number) => chartX + 30 + ((price - minP) / (maxP - minP)) * (chartW - 60);
        const mapY = (pnl: number) => chartY + chartH - 30 - ((pnl - minPnl) / pnlSpan) * (chartH - 60);

        // Zero Line
        const zeroY = mapY(0);
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chartX + 20, zeroY);
        ctx.lineTo(chartX + chartW - 20, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Expiry Curve (Purple)
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        points.forEach((pt, i) => {
          const x = mapX(pt.price);
          const y = mapY(pt.pnlExpiration);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // T+0 Curve (Cyan)
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach((pt, i) => {
          const x = mapX(pt.price);
          const y = mapY(pt.pnlCurrent);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Breakeven Markers
        if (data.metrics.breakEvens && data.metrics.breakEvens.length > 0) {
          data.metrics.breakEvens.forEach((be) => {
            if (be >= minP && be <= maxP) {
              const beX = mapX(be);
              ctx.strokeStyle = '#eab308';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(beX, chartY + 20);
              ctx.lineTo(beX, chartY + chartH - 20);
              ctx.stroke();

              ctx.fillStyle = '#fef08a';
              ctx.font = 'bold 10px monospace';
              ctx.fillText(`BE: ${be}`, beX - 25, chartY + chartH - 8);
            }
          });
        }

        // Spot Line Marker
        if (data.spot >= minP && data.spot <= maxP) {
          const spotX = mapX(data.spot);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(spotX, chartY + 15);
          ctx.lineTo(spotX, chartY + chartH - 15);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.fillText(`Spot: ${data.spot.toFixed(1)}`, spotX - 30, chartY + 30);
        }

        // Chart Legend
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(chartX + 30, chartY + 20, 14, 4);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('T+0 PnL', chartX + 50, chartY + 25);

        ctx.fillStyle = '#a855f7';
        ctx.fillRect(chartX + 120, chartY + 20, 14, 4);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Expiry PnL', chartX + 140, chartY + 25);
      }

      // 4. Metrics Summary Panel (Right Side)
      const panelX = 805;
      const panelY = 130;
      const panelW = 355;
      const panelH = 450;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.lineWidth = 1;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 12);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeRect(panelX, panelY, panelW, panelH);
      }

      // Panel Header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText('STRATEGY METRICS', panelX + 24, panelY + 36);

      ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
      ctx.beginPath();
      ctx.moveTo(panelX + 24, panelY + 48);
      ctx.lineTo(panelX + panelW - 24, panelY + 48);
      ctx.stroke();

      // Metric Items
      const metricsList = [
        { label: 'Max Profit', val: typeof data.metrics.maxProfit === 'number' ? `${cur}${data.metrics.maxProfit.toLocaleString()}` : String(data.metrics.maxProfit), color: '#34d399' },
        { label: 'Max Loss', val: typeof data.metrics.maxLoss === 'number' ? `${cur}${data.metrics.maxLoss.toLocaleString()}` : String(data.metrics.maxLoss), color: '#f87171' },
        { label: 'POP (Prob of Profit)', val: `${data.metrics.pop ?? 50}%`, color: '#38bdf8' },
        { label: 'Margin Required', val: data.metrics.marginRequirement ? `${cur}${data.metrics.marginRequirement.toLocaleString()}` : '₹60,000', color: '#facc15' },
        { label: 'Net Debit / Credit', val: data.metrics.netDebitCredit !== undefined ? (data.metrics.netDebitCredit >= 0 ? `+${cur}${data.metrics.netDebitCredit.toLocaleString()}` : `-${cur}${Math.abs(data.metrics.netDebitCredit).toLocaleString()}`) : '-', color: (data.metrics.netDebitCredit ?? 0) >= 0 ? '#34d399' : '#f87171' },
      ];

      let itemY = panelY + 80;
      metricsList.forEach((m) => {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText(m.label + ':', panelX + 24, itemY);

        ctx.fillStyle = m.color;
        ctx.font = 'bold 15px monospace';
        const valW = ctx.measureText(m.val).width;
        ctx.fillText(m.val, panelX + panelW - 24 - valW, itemY);

        itemY += 40;
      });

      // Breakevens row
      if (data.metrics.breakEvens && data.metrics.breakEvens.length > 0) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText('Break Evens:', panelX + 24, itemY);

        const beText = data.metrics.breakEvens.join(' , ');
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 13px monospace';
        const beW = ctx.measureText(beText).width;
        ctx.fillText(beText, panelX + panelW - 24 - beW, itemY);
        itemY += 40;
      }

      // Call to action badge in panel
      ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(panelX + 20, panelY + panelH - 75, panelW - 40, 52, 8);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(panelX + 20, panelY + panelH - 75, panelW - 40, 52);
        ctx.strokeRect(panelX + 20, panelY + panelH - 75, panelW - 40, 52);
      }

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('⚡ 100% Free Live Options Terminal', panelX + 35, panelY + panelH - 46);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('Analyze payoffs & scan 40+ setups at optionchief.in', panelX + 35, panelY + panelH - 30);

      // 5. Footer Watermark
      ctx.fillStyle = '#64748b';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('Generated on optionchief.in • Advanced F&O Analytics & Risk Modeling', 40, height - 32);

      setImagePreviewUrl(canvas.toDataURL('image/png'));
    };

    if (logo.complete) {
      renderContents();
    } else {
      logo.onload = renderContents;
      logo.onerror = renderContents;
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  const cur = getCurrencySymbol(data.symbol);

  // Generate shareable text
  const shareText = `🚀 ${data.title} (${data.symbol})\n` +
    `📈 Max Profit: ${typeof data.metrics.maxProfit === 'number' ? `${cur}${data.metrics.maxProfit.toLocaleString()}` : data.metrics.maxProfit}\n` +
    `🛡️ Max Loss: ${typeof data.metrics.maxLoss === 'number' ? `${cur}${data.metrics.maxLoss.toLocaleString()}` : data.metrics.maxLoss}\n` +
    `🎯 POP: ${data.metrics.pop ?? 50}% | Margin: ${data.metrics.marginRequirement ? `${cur}${data.metrics.marginRequirement.toLocaleString()}` : '₹60k'}\n` +
    (data.metrics.breakEvens?.length ? `⚡ Break Evens: ${data.metrics.breakEvens.join(' - ')}\n` : '') +
    `\n🔗 Analyze live payoffs on OptionChief: https://optionchief.in`;

  // 1. Download Canvas as PNG Image
  const handleDownloadImage = () => {
    if (!imagePreviewUrl) return;
    const link = document.createElement('a');
    link.download = `OptionChief-${data.symbol}-${data.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = imagePreviewUrl;
    link.click();
  };

  // 2. Copy Image to Clipboard
  const handleCopyImage = async () => {
    if (!canvasRef.current && !imagePreviewUrl) return;
    try {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.toBlob(async (blob) => {
          if (blob) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopiedImage(true);
            setTimeout(() => setCopiedImage(false), 2500);
          }
        });
      }
    } catch (err) {
      console.error("Failed to copy image to clipboard:", err);
      // Fallback: download
      handleDownloadImage();
    }
  };

  // 3. Copy Text Summary
  const handleCopyText = () => {
    navigator.clipboard.writeText(shareText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // Social share URLs
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent('https://optionchief.in');

  const shareWhatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  const shareTwitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&hashtags=OptionChief,OptionsTrading,NIFTY,FandO`;
  const shareTelegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const shareLinkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn font-sans">
      <div className="bg-gray-950 border border-borderClr/60 rounded-2xl p-6 max-w-3xl w-full shadow-2xl relative my-auto">
        
        {/* Hidden Canvas for High-Res PNG Generation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-borderClr/30 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-accentCyan/10 border border-accentCyan/30 text-accentCyan">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Share Strategy Payoff Card</h3>
              <p className="text-xs text-gray-400">Export high-resolution PNG chart or share directly to social networks</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-900 border border-borderClr/40 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Preview */}
        <div className="relative rounded-xl border border-borderClr/30 overflow-hidden bg-gray-900/60 p-2 mb-5">
          {imagePreviewUrl ? (
            <img 
              src={imagePreviewUrl} 
              alt="Strategy Payoff Card" 
              className="w-full h-auto rounded-lg shadow-lg"
            />
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-xs text-gray-500 gap-2">
              <span className="w-6 h-6 border-2 border-accentCyan/20 border-t-accentCyan rounded-full animate-spin" />
              <span>Generating HD Strategy Card...</span>
            </div>
          )}
        </div>

        {/* 1-Click Social Network Sharing Buttons */}
        <div className="flex flex-col gap-3 mb-5">
          <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
            1-Click Share to Social Networks:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* WhatsApp */}
            <a
              href={shareWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-all shadow-sm"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400 fill-current" />
              <span>WhatsApp</span>
            </a>

            {/* X (Twitter) */}
            <a
              href={shareTwitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/40 text-sky-300 font-bold text-xs transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>X (Twitter)</span>
            </a>

            {/* Telegram */}
            <a
              href={shareTelegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 font-bold text-xs transition-all shadow-sm"
            >
              <Send className="w-4 h-4 text-cyan-400" />
              <span>Telegram</span>
            </a>

            {/* LinkedIn */}
            <a
              href={shareLinkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-300 font-bold text-xs transition-all shadow-sm"
            >
              <ExternalLink className="w-4 h-4 text-indigo-400" />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>

        {/* Image & Text Copy Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-borderClr/20">
          <button
            onClick={handleDownloadImage}
            disabled={!imagePreviewUrl}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accentBrand hover:bg-accentBrand/90 text-white font-extrabold text-xs shadow-md transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG Image</span>
          </button>

          <button
            onClick={handleCopyImage}
            disabled={!imagePreviewUrl}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 border border-borderClr/60 text-gray-200 hover:text-white font-bold text-xs transition-all disabled:opacity-50"
          >
            {copiedImage ? <Check className="w-4 h-4 text-emerald-400" /> : <ImageIcon className="w-4 h-4 text-accentCyan" />}
            <span>{copiedImage ? 'Image Copied!' : 'Copy Image to Clipboard'}</span>
          </button>

          <button
            onClick={handleCopyText}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 border border-borderClr/60 text-gray-200 hover:text-white font-bold text-xs transition-all"
          >
            {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-accentCyan" />}
            <span>{copiedText ? 'Summary Copied!' : 'Copy Summary Text'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
