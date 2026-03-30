import { Signal } from "../strategies/base_strategy.ts";
import { BrokerClient, OrderUpdate } from "../core/broker_client.ts";
import { RiskManager } from "../core/risk_manager.ts";
import { db } from "../database/db.ts";

export class SignalController {
  private activeSignals: Map<number, Signal> = new Map();
  private expirationTimers: Map<number, NodeJS.Timeout> = new Map();

  public onBroadcast: ((data: any) => void) | null = null;

  constructor(private broker: BrokerClient, private risk: RiskManager) {}

  public onNewSignal(signal: Signal): void {
    console.log(`SignalController: New Signal Received: ${signal.strategy} - ${signal.direction} on ${signal.instrument}`);
    const signalId = this.saveSignalToDb(signal);
    signal.id = signalId;
    this.activeSignals.set(signalId, signal);

    // Set expiration timer (e.g., 5 minutes)
    const timer = setTimeout(() => {
      this.expireSignal(signalId);
    }, 5 * 60 * 1000);

    this.expirationTimers.set(signalId, timer);

    // Broadcast signal to frontend via WebSocket
    if (this.onBroadcast) {
      console.log(`Broadcasting signal ${signalId} to frontend...`);
      this.onBroadcast({ type: "NEW_SIGNAL", signal });
    }
  }

  public async acceptSignal(signalId: number): Promise<{ success: boolean; reason?: string }> {
    const signal = this.activeSignals.get(signalId);
    if (!signal) return { success: false, reason: "Signal not found or expired" };

    // Check Risk Manager
    const riskCheck = this.risk.canPlaceOrder(signal);
    if (!riskCheck.allowed) {
      this.rejectSignal(signalId, riskCheck.reason!);
      return { success: false, reason: riskCheck.reason };
    }

    // Place Bracket Order
    try {
      const orderResult = await this.broker.placeBracketOrder(
        signal.instrument,
        signal.direction,
        1, // Quantity
        signal.entryPrice,
        signal.stopLoss,
        signal.takeProfit
      );

      if (orderResult.success) {
        this.updateSignalDecision(signalId, "accepted");
        this.activeSignals.delete(signalId);
        clearTimeout(this.expirationTimers.get(signalId)!);
        this.expirationTimers.delete(signalId);

        // Log trade
        this.logTrade(signal, orderResult.orderId!);

        return { success: true };
      } else {
        return { success: false, reason: orderResult.error };
      }
    } catch (error) {
      console.error("Error placing order:", error);
      return { success: false, reason: "Internal error placing order" };
    }
  }

  public rejectSignal(signalId: number, reason: string): void {
    this.updateSignalDecision(signalId, "rejected");
    this.activeSignals.delete(signalId);
    clearTimeout(this.expirationTimers.get(signalId)!);
    this.expirationTimers.delete(signalId);
  }

  private expireSignal(signalId: number): void {
    this.updateSignalDecision(signalId, "expired");
    this.activeSignals.delete(signalId);
    this.expirationTimers.delete(signalId);
  }

  public onOrderUpdate(update: OrderUpdate): void {
    console.log(`SignalController: Order Update Received: ${update.orderId} - ${update.status}`);
    
    // Update trade status in DB
    const stmt = db.prepare("UPDATE trades SET status = ?, exit_price = ?, exit_timestamp = ? WHERE order_id = ?");
    stmt.run(
      update.status.toLowerCase(),
      update.status === "Filled" ? update.price : null,
      update.status === "Filled" ? update.timestamp.toISOString() : null,
      update.orderId
    );

    // Broadcast update to frontend
    if (this.onBroadcast) {
      this.onBroadcast({
        type: "TRADE_UPDATE",
        trade: {
          order_id: update.orderId,
          status: update.status.toLowerCase(),
          price: update.price,
          timestamp: update.timestamp.toISOString(),
        },
      });
    }
  }

  public getActiveSignals(): Signal[] {
    return Array.from(this.activeSignals.values());
  }

  public getRecentTrades(limit: number = 50): any[] {
    const stmt = db.prepare("SELECT * FROM trades ORDER BY id DESC LIMIT ?");
    const trades = stmt.all(limit) as any[];
    return trades.map(t => ({
      id: t.id,
      signal_id: t.signal_id,
      instrument: t.instrument,
      strategy: t.strategy,
      direction: t.direction,
      entryPrice: t.entry_price,
      exitPrice: t.exit_price,
      stopLoss: t.stop_loss,
      takeProfit: t.take_profit,
      quantity: t.quantity,
      status: t.status,
      entryTime: t.timestamp,
      exitTime: t.exit_timestamp,
      pnl: t.pnl || 0
    }));
  }

  private saveSignalToDb(signal: Signal): number {
    const stmt = db.prepare(`
      INSERT INTO signals (timestamp, instrument, strategy, direction, entry_price, stop_loss, take_profit, rr_ratio, confidence_score, confluence_factors, indicator_state, decision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      signal.timestamp.toISOString(),
      signal.instrument,
      signal.strategy,
      signal.direction,
      signal.entryPrice,
      signal.stopLoss,
      signal.takeProfit,
      signal.rrRatio,
      signal.confidenceScore,
      JSON.stringify(signal.confluenceFactors),
      JSON.stringify(signal.indicatorState),
      "pending"
    );

    return result.lastInsertRowid as number;
  }

  private updateSignalDecision(signalId: number, decision: string): void {
    const stmt = db.prepare("UPDATE signals SET decision = ?, decision_timestamp = ? WHERE id = ?");
    stmt.run(decision, new Date().toISOString(), signalId);
  }

  private logTrade(signal: Signal, orderId: string): void {
    const stmt = db.prepare(`
      INSERT INTO trades (signal_id, order_id, instrument, strategy, direction, entry_price, stop_loss, take_profit, quantity, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      signal.id,
      orderId,
      signal.instrument,
      signal.strategy,
      signal.direction,
      signal.entryPrice,
      signal.stopLoss,
      signal.takeProfit,
      1, // Quantity
      "open"
    );

    // Broadcast update
    if (this.onBroadcast) {
      this.onBroadcast({
        type: "TRADE_UPDATE",
        trade: {
          id: Date.now(), // Placeholder for DB ID
          signal_id: signal.id,
          instrument: signal.instrument,
          strategy: signal.strategy,
          direction: signal.direction,
          entry_price: signal.entryPrice,
          stop_loss: signal.stopLoss,
          take_profit: signal.takeProfit,
          quantity: 1,
          status: "open",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
