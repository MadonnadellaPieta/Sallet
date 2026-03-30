import React, { useState } from "react";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";

interface QuickTradeProps {
  onTrade: (symbol: string, side: "long" | "short", quantity: number, entryPrice: number, stopLoss: number, takeProfit: number) => void;
  currentPrices: Record<string, number>;
}

export const QuickTrade: React.FC<QuickTradeProps> = ({ onTrade, currentPrices }) => {
  const [symbol, setSymbol] = useState("NQ");
  const [quantity, setQuantity] = useState(1);
  const [offset, setOffset] = useState(10); // Default 10 points for SL/TP

  const handleTrade = (side: "long" | "short") => {
    const price = currentPrices[symbol] || (symbol === "NQ" ? 18000 : 5000);
    const sl = side === "long" ? price - offset : price + offset;
    const tp = side === "long" ? price + (offset * 2) : price - (offset * 2);
    
    onTrade(symbol, side, quantity, price, sl, tp);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Zap size={20} className="text-emerald-500" />
        Quick Trade
      </h2>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1 block">Instrument</label>
            <select 
              value={symbol} 
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="NQ">NQ (Nasdaq)</option>
              <option value="ES">ES (S&P 500)</option>
              <option value="MNQ">MNQ (Micro NQ)</option>
              <option value="MES">MES (Micro ES)</option>
            </select>
          </div>
          <div>
            <label className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1 block">Quantity</label>
            <input 
              type="number" 
              value={quantity} 
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1 block">SL/TP Offset (Points)</label>
          <input 
            type="number" 
            value={offset} 
            onChange={(e) => setOffset(parseInt(e.target.value))}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <button 
            onClick={() => handleTrade("long")}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            <TrendingUp size={18} />
            BUY
          </button>
          <button 
            onClick={() => handleTrade("short")}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/20"
          >
            <TrendingDown size={18} />
            SELL
          </button>
        </div>
      </div>
    </div>
  );
};
