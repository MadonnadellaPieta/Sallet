import { BrokerClient, ConnectionStatus, AccountInfo, Position, OrderUpdate } from "./broker_client.ts";
import { MarketData } from "../strategies/base_strategy.ts";

export class SimulatorBroker implements BrokerClient {
  private status: ConnectionStatus = ConnectionStatus.CONNECTED;
  private positions: Position[] = [];
  private balance: number = 100000;
  private dailyPnL: number = 0;

  public onMarketData?: (data: MarketData) => void;
  public onOrderUpdate?: (update: OrderUpdate) => void;

  async connect(): Promise<boolean> {
    this.status = ConnectionStatus.CONNECTED;
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = ConnectionStatus.DISCONNECTED;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async subscribeMarketData(symbol: string): Promise<boolean> {
    return true;
  }

  async unsubscribeMarketData(symbol: string): Promise<boolean> {
    return true;
  }

  async placeBracketOrder(
    symbol: string,
    side: "long" | "short",
    quantity: number,
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    const orderId = `sim-${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate fill after 1 second
    setTimeout(() => {
      if (this.onOrderUpdate) {
        this.onOrderUpdate({
          orderId,
          status: "Filled",
          symbol,
          side,
          quantity,
          price: entryPrice,
          timestamp: new Date(),
        });
      }

      // Add to positions
      this.positions.push({
        orderId,
        symbol,
        side,
        quantity,
        entryPrice,
        currentPrice: entryPrice,
        unrealizedPnL: 0,
        stopLoss,
        takeProfit,
      });
    }, 1000);

    return { success: true, orderId };
  }

  async flattenAll(): Promise<boolean> {
    const positionsToClose = [...this.positions];
    positionsToClose.forEach(p => {
      this.closePositionInternal(p, p.currentPrice);
    });
    this.positions = [];
    return true;
  }

  async closePosition(orderId: string): Promise<boolean> {
    const p = this.positions.find(pos => pos.orderId === orderId);
    if (p) {
      this.closePositionInternal(p, p.currentPrice);
      return true;
    }
    return false;
  }

  public updatePrices(symbol: string, price: number) {
    this.positions.forEach(p => {
      if (p.symbol === symbol) {
        p.currentPrice = price;
        const points = p.side === "long" ? price - p.entryPrice : p.entryPrice - price;
        
        let multiplier = 20;
        if (p.symbol.includes("MNQ")) multiplier = 2;
        if (p.symbol.includes("ES")) multiplier = 50;
        if (p.symbol.includes("MES")) multiplier = 5;
        
        p.unrealizedPnL = points * multiplier;

        // Check SL/TP
        if (p.side === "long") {
          if (price <= p.stopLoss || price >= p.takeProfit) {
            this.closePositionInternal(p, price);
          }
        } else {
          if (price >= p.stopLoss || price <= p.takeProfit) {
            this.closePositionInternal(p, price);
          }
        }
      }
    });
  }

  private closePositionInternal(p: Position, price: number) {
    const points = p.side === "long" ? price - p.entryPrice : p.entryPrice - price;
    let multiplier = 20;
    if (p.symbol.includes("MNQ")) multiplier = 2;
    if (p.symbol.includes("ES")) multiplier = 50;
    if (p.symbol.includes("MES")) multiplier = 5;
    
    const pnl = points * multiplier;
    this.balance += pnl;
    this.dailyPnL += pnl;
    
    this.positions = this.positions.filter(pos => pos !== p);

    if (this.onOrderUpdate) {
      this.onOrderUpdate({
        orderId: `sim-exit-${Math.random().toString(36).substr(2, 9)}`,
        status: "Filled",
        symbol: p.symbol,
        side: p.side === "long" ? "short" : "long",
        quantity: p.quantity,
        price: price,
        timestamp: new Date(),
      });
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    return {
      balance: this.balance,
      dailyPnL: this.dailyPnL,
      drawdownRemaining: 3000,
      eodThreshold: 97000,
      phase: "Eval",
      maxContracts: 8,
    };
  }

  async getPositions(): Promise<Position[]> {
    return this.positions;
  }
}
