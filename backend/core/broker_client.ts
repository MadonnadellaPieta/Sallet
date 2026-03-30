import { MarketData } from "../strategies/base_strategy.ts";

export enum ConnectionStatus {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error",
}

export interface AccountInfo {
  balance: number;
  dailyPnL: number;
  drawdownRemaining: number;
  eodThreshold: number;
  phase: "Eval" | "PA" | "Live";
  maxContracts: number;
}

export interface Position {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  stopLoss: number;
  takeProfit: number;
}

export interface OrderUpdate {
  orderId: string;
  status: "Filled" | "Cancelled" | "Rejected" | "Pending";
  symbol: string;
  side: "long" | "short";
  quantity: number;
  price: number;
  timestamp: Date;
}

export interface BrokerClient {
  onMarketData?: (data: MarketData) => void;
  onOrderUpdate?: (update: OrderUpdate) => void;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getStatus(): ConnectionStatus;
  subscribeMarketData(symbol: string): Promise<boolean>;
  unsubscribeMarketData(symbol: string): Promise<boolean>;
  placeBracketOrder(
    symbol: string,
    side: "long" | "short",
    quantity: number,
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<{ success: boolean; orderId?: string; error?: string }>;
  flattenAll(): Promise<boolean>;
  getAccountInfo(): Promise<AccountInfo>;
  getPositions(): Promise<Position[]>;
}
