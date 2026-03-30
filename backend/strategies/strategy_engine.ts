import { BaseStrategy, MarketData, Signal } from "./base_strategy.ts";
import { VwapReversionStrategy } from "./vwap_reversion.ts";
import { EmaCrossoverStrategy } from "./ema_crossover.ts";
import { OpeningRangeBreakoutStrategy } from "./opening_range.ts";
import { settings } from "../config/settings.ts";

export class StrategyEngine {
  private strategies: BaseStrategy[] = [];
  private activeInstruments: string[] = settings.TRADING.DEFAULT_SYMBOLS;
  public onSignal: ((signal: Signal) => void) | null = null;

  constructor() {
    this.strategies.push(new VwapReversionStrategy());
    this.strategies.push(new EmaCrossoverStrategy());
    this.strategies.push(new OpeningRangeBreakoutStrategy());
  }

  public onMarketData(data: MarketData): void {
    if (!this.activeInstruments.includes(data.symbol)) {
      console.log(`Instrument ${data.symbol} not active. Skipping.`);
      return;
    }

    console.log(`Processing market data for ${data.symbol}: ${data.price}`);
    for (const strategy of this.strategies) {
      const signal = strategy.onMarketData(data);
      if (signal) {
        if (this.onSignal) {
          this.onSignal(signal);
        }
      }
    }
  }
}
