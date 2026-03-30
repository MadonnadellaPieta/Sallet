import { BaseStrategy, MarketData, Signal } from "./base_strategy.ts";

interface InstrumentState {
  fastEma: number;
  slowEma: number;
  volumeHistory: number[];
  lastFastEma: number;
  lastSlowEma: number;
}

export class EmaCrossoverStrategy implements BaseStrategy {
  public name = "EMA Crossover + Volume";
  private config = {
    fastEmaPeriod: 9,
    slowEmaPeriod: 21,
    volumeMultiplier: 1.5,
    volumeLookback: 20,
    timeframe: "1min",
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
        fastEma: 0,
        slowEma: 0,
        volumeHistory: [],
        lastFastEma: 0,
        lastSlowEma: 0,
      });
    }
    return this.states.get(symbol)!;
  }

  onMarketData(data: MarketData): Signal | null {
    const state = this.getOrCreateState(data.symbol);
    
    state.volumeHistory.push(data.volume);
    if (state.volumeHistory.length > this.config.volumeLookback) {
      state.volumeHistory.shift();
    }

    const avgVolume = state.volumeHistory.reduce((acc, val) => acc + val, 0) / state.volumeHistory.length;
    const volumeConfirmed = data.volume >= avgVolume * this.config.volumeMultiplier;

    // Calculate EMAs
    state.fastEma = this.calculateEma(data.price, state.fastEma, this.config.fastEmaPeriod);
    state.slowEma = this.calculateEma(data.price, state.slowEma, this.config.slowEmaPeriod);

    // Check for crossover
    let signal: Signal | null = null;
    if (state.lastFastEma <= state.lastSlowEma && state.fastEma > state.slowEma && volumeConfirmed) {
      // Bullish crossover
      signal = this.createSignal(data, "long", state);
    } else if (state.lastFastEma >= state.lastSlowEma && state.fastEma < state.slowEma && volumeConfirmed) {
      // Bearish crossover
      signal = this.createSignal(data, "short", state);
    }

    state.lastFastEma = state.fastEma;
    state.lastSlowEma = state.slowEma;

    return signal;
  }

  private calculateEma(price: number, ema: number, period: number): number {
    if (ema === 0) return price;
    const multiplier = 2 / (period + 1);
    return (price - ema) * multiplier + ema;
  }

  private createSignal(data: MarketData, direction: "long" | "short", state: InstrumentState): Signal {
    const entryPrice = data.price;
    const slPrice = direction === "long" ? entryPrice - 5 : entryPrice + 5; // Placeholder SL
    const tpPrice = direction === "long" ? entryPrice + 10 : entryPrice - 10; // Placeholder TP
    const rrRatio = 2.0;

    return {
      timestamp: new Date(),
      instrument: data.symbol,
      strategy: this.name,
      direction,
      entryPrice,
      stopLoss: slPrice,
      takeProfit: tpPrice,
      rrRatio,
      confidenceScore: 65,
      confluenceFactors: { volumeConfirmed: true },
      indicatorState: { fastEma: state.fastEma, slowEma: state.slowEma },
    };
  }
}
