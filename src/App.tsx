import React, { useState, useEffect, useCallback } from "react";
import { Signal } from "../backend/strategies/base_strategy.ts";
import { SignalCard } from "./components/SignalCard.tsx";
import { motion, AnimatePresence } from "motion/react";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Clock, 
  LayoutDashboard, 
  History, 
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

interface AccountStats {
  balance: number;
  peakBalance: number;
  dailyStartingBalance: number;
  openPositionsCount: number;
  dailyPnL: number;
  drawdown: number;
}

const App: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<AccountStats>({
    balance: 50000,
    peakBalance: 50000,
    dailyStartingBalance: 50000,
    openPositionsCount: 0,
    dailyPnL: 0,
    drawdown: 0,
  });
  const [wsStatus, setWsStatus] = useState<"connected" | "disconnected" | "connecting">("connecting");
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onopen = () => {
      console.log("Connected to WebSocket");
      setWsStatus("connected");
    };

    socket.onclose = () => {
      console.log("Disconnected from WebSocket");
      setWsStatus("disconnected");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);

      if (data.type === "INITIAL_STATE") {
        if (data.signals) setSignals(data.signals);
        if (data.trades) setTrades(data.trades);
        if (data.stats) setStats(data.stats);
        if (data.history) setHistory(data.history);
      } else if (data.type === "NEW_SIGNAL") {
        if (data.signal) setSignals((prev) => [data.signal, ...prev]);
      } else if (data.type === "ACCOUNT_UPDATE") {
        if (data.stats) {
          setStats(data.stats);
          setHistory((prev) => [...prev, { 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            balance: data.stats.balance || 0
          }].slice(-100));
        }
      } else if (data.type === "PRICE_UPDATE") {
        setTrades((prev) => {
          return prev.map((t) => {
            if (t.status === "open" && t.instrument === data.symbol) {
              const currentPrice = data.price;
              const entryPrice = t.entryPrice || t.entry_price;
              const direction = t.direction;
              
              // Simple PnL calculation based on instrument
              let multiplier = 20; // Default NQ
              if (t.instrument.includes("MNQ")) multiplier = 2;
              if (t.instrument.includes("ES")) multiplier = 50;
              if (t.instrument.includes("MES")) multiplier = 5;
              
              const points = direction === "long" ? currentPrice - entryPrice : entryPrice - currentPrice;
              const pnl = points * multiplier;
              
              return { ...t, currentPrice, pnl };
            }
            return t;
          });
        });
      } else if (data.type === "TRADE_UPDATE") {
        setTrades((prev) => {
          const index = prev.findIndex((t) => t.order_id === data.trade.order_id || t.id === data.trade.id);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...data.trade };
            return updated;
          }
          return [data.trade, ...prev];
        });
      }
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  const handleAcceptSignal = useCallback((signalId: number) => {
    if (ws) {
      ws.send(JSON.stringify({ type: "ACCEPT_SIGNAL", signalId }));
      setSignals((prev) => prev.filter((s) => s.id !== signalId));
    }
  }, [ws]);

  const handleRejectSignal = useCallback((signalId: number) => {
    if (ws) {
      ws.send(JSON.stringify({ type: "REJECT_SIGNAL", signalId }));
      setSignals((prev) => prev.filter((s) => s.id !== signalId));
    }
  }, [ws]);

  const handleFlattenAll = useCallback(() => {
    if (ws && window.confirm("Are you sure you want to flatten all positions?")) {
      ws.send(JSON.stringify({ type: "FLATTEN_ALL" }));
    }
  }, [ws]);

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-emerald-500/30">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-20 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-8 gap-8 z-50">
        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
          <Shield size={28} />
        </div>
        <nav className="flex flex-col gap-6">
          <button className="p-3 text-emerald-500 bg-emerald-500/10 rounded-xl transition-all">
            <LayoutDashboard size={24} />
          </button>
          <button className="p-3 text-zinc-500 hover:text-zinc-300 transition-all">
            <Activity size={24} />
          </button>
          <button className="p-3 text-zinc-500 hover:text-zinc-300 transition-all">
            <History size={24} />
          </button>
          <button className="p-3 text-zinc-500 hover:text-zinc-300 transition-all">
            <SettingsIcon size={24} />
          </button>
        </nav>
        <div className="mt-auto flex flex-col items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${wsStatus === "connected" ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-rose-500 shadow-lg shadow-rose-500/50"}`} />
        </div>
      </div>

      {/* Main Content */}
      <main className="pl-20 p-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Armet Dashboard</h1>
            <p className="text-zinc-500 flex items-center gap-2">
              <Clock size={16} />
              <span>Market Session: {new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York" })} ET</span>
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 min-w-[200px]">
              <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Account Balance</p>
              <p className="text-2xl font-mono text-white">${(stats?.balance || 0).toLocaleString()}</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 min-w-[200px]">
              <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Daily PnL</p>
              <p className={`text-2xl font-mono ${(stats?.dailyPnL || 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {(stats?.dailyPnL || 0) >= 0 ? "+" : ""}${(stats?.dailyPnL || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-8">
          {/* Left Column: Signals & Activity */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Activity size={20} className="text-emerald-500" />
                  Live Signals
                </h2>
                <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {signals.length} Active
                </span>
              </div>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {signals.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl p-12 text-center"
                    >
                      <p className="text-zinc-600 text-sm italic">Waiting for market signals...</p>
                    </motion.div>
                  ) : (
                    signals.map((signal) => (
                      <SignalCard
                        key={signal.id}
                        signal={signal}
                        onAccept={handleAcceptSignal}
                        onReject={handleRejectSignal}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </section>

            <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield size={20} className="text-emerald-500" />
                Risk Status
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">Trailing Drawdown</span>
                  <span className="text-white font-mono text-sm">${(stats?.drawdown || 0).toLocaleString()} / $2,500</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${((stats?.drawdown || 0) / 2500) * 100}%` }} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                    <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">Open Contracts</p>
                    <p className="text-white font-mono text-lg">{stats?.openPositionsCount || 0} / 2</p>
                  </div>
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                    <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">Daily Loss</p>
                    <p className="text-white font-mono text-lg">${Math.abs(Math.min(0, stats?.dailyPnL || 0)).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Charts & Trades */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-white tracking-tight">Equity Performance</h2>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-xs bg-emerald-500 text-black font-bold rounded-lg">1D</button>
                  <button className="px-3 py-1 text-xs bg-zinc-800 text-zinc-400 font-bold rounded-lg hover:text-white transition-colors">1W</button>
                  <button className="px-3 py-1 text-xs bg-zinc-800 text-zinc-400 font-bold rounded-lg hover:text-white transition-colors">1M</button>
                </div>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.length > 0 ? history : [{time: '09:30', balance: 50000}]}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#52525b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      domain={['dataMin - 100', 'dataMax + 100']}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorBalance)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Active Positions</h2>
                <button 
                  onClick={handleFlattenAll}
                  className="text-xs text-rose-500 font-bold hover:text-rose-400 transition-colors uppercase tracking-widest"
                >
                  Flatten All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/50">
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Instrument</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Side</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Entry</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Current</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">PnL</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.filter(t => t.status === 'open').length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-zinc-600 italic text-sm">No active positions</td>
                      </tr>
                    ) : (
                      trades.filter(t => t.status === 'open').map((trade) => (
                        <tr key={trade.id} className="border-t border-zinc-800 hover:bg-zinc-800/20 transition-colors">
                          <td className="p-4 font-bold text-white">{trade.instrument}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.direction === "long" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                              {trade.direction}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-sm">{(trade.entryPrice || 0).toFixed(2)}</td>
                          <td className="p-4 font-mono text-sm">{trade.currentPrice?.toFixed(2) || "-"}</td>
                          <td className={`p-4 font-mono font-bold ${(trade.pnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {(trade.pnl || 0) >= 0 ? "+" : ""}${(trade.pnl || 0).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <button className="text-rose-500 hover:text-rose-400 transition-colors">
                              <XCircle size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <History size={20} className="text-emerald-500" />
                  Trade History
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/50">
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Time</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Instrument</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Side</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Entry</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Exit</th>
                      <th className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.filter(t => t.status !== 'open').length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-zinc-600 italic text-sm">No trade history</td>
                      </tr>
                    ) : (
                      trades.filter(t => t.status !== 'open').map((trade) => (
                        <tr key={trade.id} className="border-t border-zinc-800 hover:bg-zinc-800/20 transition-colors opacity-70">
                          <td className="p-4 text-xs text-zinc-500">{new Date(trade.entryTime).toLocaleTimeString()}</td>
                          <td className="p-4 font-bold text-white">{trade.instrument}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.direction === "long" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                              {trade.direction}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-sm">{(trade.entryPrice || 0).toFixed(2)}</td>
                          <td className="p-4 font-mono text-sm">{trade.exitPrice?.toFixed(2) || "-"}</td>
                          <td className={`p-4 font-mono font-bold ${(trade.pnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {(trade.pnl || 0) >= 0 ? "+" : ""}${(trade.pnl || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />
    </div>
  );
};

export default App;
