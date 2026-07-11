import React, { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { ShieldAlert, TrendingDown } from 'lucide-react';
import { BACKEND_URL } from '../config';

interface ConePoint {
  day: number;
  min: number;
  p25: number;
  mean: number;
  p75: number;
  max: number;
}

export const VolatilityCone: React.FC = () => {
  const { symbol } = useStore();
  const [data, setData] = useState<ConePoint[]>([]);
  const [currentIv, setCurrentIv] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConeData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${BACKEND_URL}/api/analytics/volatility-cone?symbol=${symbol}`);
        if (!response.ok) {
          throw new Error("Failed to fetch volatility cone data");
        }
        const result = await response.json();
        
        // Convert cone dictionary mapping {"10": {...}, "20": {...}} to a sorted array
        const coneDict = result.cone;
        const chartData: ConePoint[] = Object.keys(coneDict).map((key) => {
          const item = coneDict[key];
          return {
            day: item.window,
            min: Math.round(item.min * 10) / 10,
            p25: Math.round(item.p25 * 10) / 10,
            mean: Math.round(item.mean * 10) / 10,
            p75: Math.round(item.p75 * 10) / 10,
            max: Math.round(item.max * 10) / 10,
          };
        }).sort((a, b) => a.day - b.day);

        setData(chartData);
        setCurrentIv(result.current_iv);
      } catch (err: any) {
        setError(err.message || "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConeData();
  }, [symbol]);

  if (isLoading) {
    return (
      <div className="bg-cardBg rounded-xl p-8 border border-borderClr/40 text-center text-gray-500 h-[350px] flex items-center justify-center">
        <span className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-accentCyan animate-pulse" />
          Calculating historical volatility cone...
        </span>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="bg-cardBg rounded-xl p-8 border border-borderClr/40 text-center text-gray-500 h-[350px] flex flex-col items-center justify-center gap-2">
        <ShieldAlert className="w-8 h-8 text-yellow-500" />
        <span>Insufficient historical data for {symbol} to calculate Volatility Cone.</span>
        <span className="text-[10px] text-gray-600">Ensure ticker has trading history.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center px-1">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Implied vs Historical Volatility Cone</h3>
          <p className="text-[10px] text-gray-500">Overlay current option Implied Volatility against rolling historical ranges.</p>
        </div>
        <div className="text-xs text-gray-400">
          Current ATM IV: <strong className="text-accentCyan">{currentIv.toFixed(1)}%</strong>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-4 h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="#6B7280"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Trading Days Window', fill: '#6B7280', fontSize: 10, position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Annual Volatility (%)', fill: '#6B7280', fontSize: 10, angle: -90, position: 'insideLeft', offset: 10 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#030712', borderColor: '#374151', borderRadius: '8px' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: '10px' }}
            />

            {/* Current Implied Volatility line overlay */}
            <ReferenceLine
              y={currentIv}
              stroke="#06B6D4"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{ value: `Current IV: ${currentIv}%`, fill: '#06B6D4', fontSize: 10, position: 'top' }}
            />

            {/* Volatility bounds lines */}
            <Line type="monotone" dataKey="max" name="Maximum Vol" stroke="#EF4444" strokeWidth={1.5} dot={true} />
            <Line type="monotone" dataKey="p75" name="75th Percentile" stroke="#F97316" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="mean" name="Average Vol" stroke="#EAB308" strokeWidth={2} dot={true} />
            <Line type="monotone" dataKey="p25" name="25th Percentile" stroke="#22C55E" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="min" name="Minimum Vol" stroke="#10B981" strokeWidth={1.5} dot={true} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
