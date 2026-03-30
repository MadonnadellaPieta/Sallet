import { db } from "../database/db.ts";
import { settings } from "../config/settings.ts";
import { BrokerClient } from "./broker_client.ts";

export class RiskManager {
  private currentAccountBalance = 0;
  private peakAccountBalance = 0;
  private dailyStartingBalance = 0;
  private currentDailyLoss = 0;
  private openPositionsCount = 0;
  public onUpdate: ((stats: any) => void) | null = null;
  private broker: BrokerClient | null = null;

  constructor() {
    this.loadInitialState();
  }

  public setBroker(broker: BrokerClient): void {
    this.broker = broker;
    this.syncWithBroker();
    
    // Periodically sync with broker (e.g., every 5 seconds)
    setInterval(() => {
      this.syncWithBroker();
    }, 5000);
  }

  private async syncWithBroker(): Promise<void> {
    if (!this.broker) return;

    try {
      const accountInfo = await this.broker.getAccountInfo();
      const positions = await this.broker.getPositions();
      
      this.updateAccountState(accountInfo.balance, positions.length);
    } catch (error) {
      console.error("Failed to sync RiskManager with broker:", error);
    }
  }

  private loadInitialState(): void {
    // Load from database (latest snapshot)
    const stmt = db.prepare("SELECT * FROM account_snapshots ORDER BY timestamp DESC LIMIT 1");
    const latestSnapshot = stmt.get() as any;

    if (latestSnapshot) {
      this.currentAccountBalance = latestSnapshot.balance;
      this.peakAccountBalance = latestSnapshot.peak_balance;
      this.dailyStartingBalance = latestSnapshot.daily_starting_balance;
      this.currentDailyLoss = this.dailyStartingBalance - this.currentAccountBalance;
    } else {
      // Default initial state
      this.currentAccountBalance = 50000;
      this.peakAccountBalance = 50000;
      this.dailyStartingBalance = 50000;
      this.currentDailyLoss = 0;
    }
  }

  public canPlaceOrder(order: any): { allowed: boolean; reason?: string } {
    // 1. Check Trading Hours
    if (!this.isWithinTradingHours()) {
      return { allowed: false, reason: "Outside trading hours" };
    }

    // 2. Check Daily Loss Limit
    const maxDailyLoss = 2500; // Default
    if (this.currentDailyLoss >= maxDailyLoss) {
      return { allowed: false, reason: "Daily loss limit reached" };
    }

    // 3. Check Max Open Positions
    if (this.openPositionsCount >= settings.APEX_RULES.EVAL.MAX_CONTRACTS) {
      return { allowed: false, reason: "Max open positions reached" };
    }

    // 4. Check Trailing Drawdown
    const currentDrawdown = this.peakAccountBalance - this.currentAccountBalance;
    if (currentDrawdown >= settings.APEX_RULES.EVAL.MAX_DRAWDOWN) {
      return { allowed: false, reason: "Trailing drawdown limit reached" };
    }

    return { allowed: true };
  }

  private isWithinTradingHours(): boolean {
    const now = new Date();
    const etNow = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).format(now);

    const [hour, minute] = etNow.split(":").map(Number);
    const timeInMinutes = hour * 60 + minute;

    const startMinutes = 18 * 60; // 6:00 PM ET
    const endMinutes = 16 * 60 + 59; // 4:59 PM ET

    // Trading is allowed from 6:00 PM ET to 4:59 PM ET next day
    if (timeInMinutes >= startMinutes || timeInMinutes <= endMinutes) {
      return true;
    }

    return false;
  }

  public updateAccountState(balance: number, openPositions: number): void {
    this.currentAccountBalance = balance;
    this.openPositionsCount = openPositions;

    if (this.currentAccountBalance > this.peakAccountBalance) {
      this.peakAccountBalance = this.currentAccountBalance;
    }

    this.currentDailyLoss = this.dailyStartingBalance - this.currentAccountBalance;

    // Log snapshot
    const stmt = db.prepare(`
      INSERT INTO account_snapshots (timestamp, account_id, balance, peak_balance, daily_starting_balance, open_positions_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      new Date().toISOString(),
      "TRADOVATE_ACCOUNT_ID", // Placeholder
      this.currentAccountBalance,
      this.peakAccountBalance,
      this.dailyStartingBalance,
      this.openPositionsCount
    );

    // Trigger update callback
    if (this.onUpdate) {
      this.onUpdate({
        balance: this.currentAccountBalance,
        peakBalance: this.peakAccountBalance,
        dailyLoss: this.currentDailyLoss,
        openPositions: this.openPositionsCount,
        drawdown: this.peakAccountBalance - this.currentAccountBalance,
      });
    }
  }

  public getHistory(limit: number = 100): any[] {
    const stmt = db.prepare("SELECT * FROM account_snapshots ORDER BY timestamp DESC LIMIT ?");
    const snapshots = stmt.all(limit) as any[];
    return snapshots.reverse().map(s => ({
      time: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      balance: s.balance
    }));
  }

  public getStats() {
    return {
      balance: this.currentAccountBalance,
      peakBalance: this.peakAccountBalance,
      dailyStartingBalance: this.dailyStartingBalance,
      openPositionsCount: this.openPositionsCount,
      dailyPnL: this.currentAccountBalance - this.dailyStartingBalance,
      drawdown: this.peakAccountBalance - this.currentAccountBalance,
    };
  }

  public resetDailyStartingBalance(balance: number): void {
    this.dailyStartingBalance = balance;
    this.currentDailyLoss = 0;
  }
}
