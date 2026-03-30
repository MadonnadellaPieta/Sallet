import { BaseStrategy, MarketData, Signal } from "./base_strategy.ts";

interface InstrumentState {
  rangeHigh: number;
  rangeLow: number;
  rangeStartTime: Date | null;
  rangeEndTime: Date | null;
  isRangeDefined: boolean;
}

export class OpeningRangeBreakoutStrategy implements BaseStrategy {
  public name = "Opening Range Breakout";
  private config = {
    rangeDuration: 15, // minutes
    volumeConfirmationThreshold: 1.5,
    extensionMultiplier: 1.0,
  };

  private states: Map<string, InstrumentState> = new Map();

  constructor(config?: any) {
    if (config) this.updateConfig(config);
  }

  updateConfig(config: any): void {
    this.config = { ...this.config, ...config };
  }

  private getOrCreateState(symbol: string): InstrumentState {
    if (!this.states.has(symbol)) {
      this.states.set(symbol, {
        rangeHigh: -Infinity,
        rangeLow: Infinity,
        rangeStartTime: null,
        rangeEndTime: null,
        isRangeDefined: false,
      });
    }
    return this.states.get(symbol)!;
  }

  onMarketData(data: MarketData): Signal | null {
    const state = this.getOrCreateState(data.symbol);
    
    if (!state.rangeStartTime) {
      state.rangeStartTime = new Date(data.timestamp);
      state.rangeEndTime = new Date(state.rangeStartTime.getTime() + this.config.rangeDuration * 60000);
    }

    if (!state.isRangeDefined) {
      if (data.timestamp <= state.rangeEndTime!) {
        state.rangeHigh = Math.max(state.rangeHigh, data.price);
        state.rangeLow = Math.min(state.rangeLow, data.price);
        return null;
      } else {
        state.isRangeDefined = true;
        console.log(`Opening Range Defined for ${data.symbol}: ${state.rangeLow} - ${state.rangeHigh}`);
      }
    }

    // Check for breakout
    if (data.price > state.rangeHigh) {
      // Bullish breakout
      return this.createSignal(data, "long", state);
    } else if (data.price < state.rangeLow) {
      // Bearish breakout
      return this.createSignal(data, "short", state);
    }

    return null;
  }

  private createSignal(data: MarketData, direction: "long" | "short", state: InstrumentState): Signal {
    const entryPrice = data.price;
    const rangeWidth = state.rangeHigh - state.rangeLow;
    const slPrice = direction === "long" ? state.rangeLow : state.rangeHigh;
    const tpPrice = direction === "long" ? state.rangeHigh + rangeWidth : state.rangeLow - rangeWidth;
    const rrRatio = 1.0;

    return {
      timestamp: new Date(),
      instrument: data.symbol,
      strategy: this.name,
      direction,
      entryPrice,
      stopLoss: slPrice,
      takeProfit: tpPrice,
      rrRatio,
      confidenceScore: 80,
      confluenceFactors: { breakoutConfirmed: true },
      indicatorState: { rangeHigh: state.rangeHigh, rangeLow: state.rangeLow },
    };
  }
}
