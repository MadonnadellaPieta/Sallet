export interface Signal {
  id?: number;
  timestamp: Date;
  instrument: string;
  strategy: string;
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number;
  confidenceScore: number;
  confluenceFactors: any;
  indicatorState: any;
  decision?: "pending" | "accepted" | "rejected" | "expired";
  decisionTimestamp?: Date;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
  bid?: number;
  ask?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

export interface BaseStrategy {
  name: string;
  onMarketData(data: MarketData): Signal | null;
  updateConfig(config: any): void;
}
