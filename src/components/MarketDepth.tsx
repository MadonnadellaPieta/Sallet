import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";

interface DepthLevel {
  price: number;
  size: number;
}

interface MarketDepthProps {
  symbol: string;
  currentPrice: number;
}

export const MarketDepth: React.FC<MarketDepthProps> = ({ symbol, currentPrice }) => {
  const [bids, setBids] = useState<DepthLevel[]>([]);
  const [asks, setAsks] = useState<DepthLevel[]>([]);

  useEffect(() => {
    const generateDepth = () => {
      const newBids: DepthLevel[] = [];
      const newAsks: DepthLevel[] = [];
      const tickSize = symbol.includes("NQ") ? 0.25 : 0.25;

      for (let i = 1; i <= 10; i++) {
        newBids.push({
          price: currentPrice - (i * tickSize),
          size: Math.floor(Math.random() * 50) + 10,
        });
        newAsks.push({
          price: currentPrice + (i * tickSize),
          size: Math.floor(Math.random() * 50) + 10,
        });
      }
      setBids(newBids);
      setAsks(newAsks.reverse());
    };

    generateDepth();
    const interval = setInterval(generateDepth, 1000);
    return () => clearInterval(interval);
  }, [currentPrice, symbol]);

  const maxTotal = Math.max(
    ...bids.map(b => b.size),
    ...asks.map(a => a.size)
  );

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Activity size={20} className="text-emerald-500" />
        Market Depth (L2) - {symbol}
      </h2>
      
      <div className="space-y-1 font-mono text-[11px]">
        {/* Asks (Sell Orders) */}
        <div className="space-y-1">
          {asks.map((ask, i) => (
            <div key={`ask-${i}`} className="flex items-center gap-4 relative h-4">
              <div 
                className="absolute right-0 h-full bg-rose-500/10 transition-all duration-500"
                style={{ width: `${(ask.size / maxTotal) * 100}%` }}
              />
              <span className="text-rose-500 w-16 text-right z-10">{ask.price.toFixed(2)}</span>
              <span className="text-zinc-400 w-12 text-right z-10">{ask.size}</span>
            </div>
          ))}
        </div>

        {/* Current Price */}
        <div className="py-2 border-y border-zinc-800 my-2 flex justify-between items-center px-2">
          <span className="text-white font-bold text-sm">{currentPrice.toFixed(2)}</span>
          <span className="text-emerald-500 text-[10px] uppercase tracking-widest">Spread: 0.25</span>
        </div>

        {/* Bids (Buy Orders) */}
        <div className="space-y-1">
          {bids.map((bid, i) => (
            <div key={`bid-${i}`} className="flex items-center gap-4 relative h-4">
              <div 
                className="absolute right-0 h-full bg-emerald-500/10 transition-all duration-500"
                style={{ width: `${(bid.size / maxTotal) * 100}%` }}
              />
              <span className="text-emerald-500 w-16 text-right z-10">{bid.price.toFixed(2)}</span>
              <span className="text-zinc-400 w-12 text-right z-10">{bid.size}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
