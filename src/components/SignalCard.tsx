import React from "react";
import { Signal } from "../../backend/strategies/base_strategy.ts";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Check, X, Clock } from "lucide-react";

interface SignalCardProps {
  signal: Signal;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onAccept, onReject }) => {
  const isLong = signal.direction === "long";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-lg"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isLong ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
            {isLong ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div>
            <h3 className="text-white font-semibold">{signal.instrument}</h3>
            <p className="text-zinc-500 text-xs">{signal.strategy}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-zinc-500 text-xs">
          <Clock size={12} />
          <span>{new Date(signal.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Entry</p>
          <p className="text-white font-mono">{(signal.entryPrice || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Confidence</p>
          <p className="text-emerald-500 font-mono">{((signal.confidenceScore || 0) * 100).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Stop</p>
          <p className="text-rose-500 font-mono">{(signal.stopLoss || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">R:R</p>
          <p className="text-white font-mono">{(signal.rrRatio || 0).toFixed(2)}</p>
        </div>
      </div>

      {signal.confluenceFactors && signal.confluenceFactors.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {signal.confluenceFactors.map((f, i) => (
            <span key={i} className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700 uppercase tracking-wider">
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(signal.id!)}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Check size={18} />
          <span>Accept</span>
        </button>
        <button
          onClick={() => onReject(signal.id!)}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <X size={18} />
          <span>Reject</span>
        </button>
      </div>
    </motion.div>
  );
};
