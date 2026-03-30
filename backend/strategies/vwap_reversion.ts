import { BaseStrategy, MarketData, Signal } from "./base_strategy.ts";

interface InstrumentState {
  cumulativeTypicalPriceVolume: number;
  cumulativeVolume: number;
  typicalPrices: number[];
  vwap: number;
  sd: number;
}

export class VwapReversionStrategy implements BaseStrategy {
  public name = "VWAP Mean Reversion";
  private config = {
    sdMultiplier: 2.0,
    minDeviationDistance: 5.0, // Minimum points from VWAP to consider a signal
    reversionConfirmationMethod: "rejection_candle",
    buffer: 2.0, // SL buffer
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
        cumulativeTypicalPriceVolume: 0,
        cumulativeVolume: 0,
        typicalPrices: [],
        vwap: 0,
        sd: 0,
      });
    }
    return this.states.get(symbol)!;
  }

  onMarketData(data: MarketData): Signal | null {
    const state = this.getOrCreateState(data.symbol);
    const typicalPrice = (data.high! + data.low! + data.close!) / 3;
    
    state.cumulativeTypicalPriceVolume += typicalPrice * data.volume;
    state.cumulativeVolume += data.volume;
    state.typicalPrices.push(typicalPrice);

    // Keep only last 1000 typical prices for SD calculation to avoid memory issues
    if (state.typicalPrices.length > 1000) {
      state.typicalPrices.shift();
    }

    state.vwap = state.cumulativeTypicalPriceVolume / state.cumulativeVolume;

    // Calculate Standard Deviation
    const variance = state.typicalPrices.reduce((acc, val) => acc + Math.pow(val - state.vwap, 2), 0) / state.typicalPrices.length;
    state.sd = Math.sqrt(variance);

    const upperBand = state.vwap + (state.sd * this.config.sdMultiplier);
    const lowerBand = state.vwap - (state.sd * this.config.sdMultiplier);

    // Signal logic
    if (data.price >= upperBand) {
      // Potential short
      return this.createSignal(data, "short", upperBand, lowerBand, state);
    } else if (data.price <= lowerBand) {
      // Potential long
      return this.createSignal(data, "long", upperBand, lowerBand, state);
    }

    return null;
  }

  private createSignal(data: MarketData, direction: "long" | "short", upperBand: number, lowerBand: number, state: InstrumentState): Signal {
    const entryPrice = data.price;
    const bandPrice = direction === "long" ? lowerBand : upperBand;
    const slPrice = direction === "long" ? bandPrice - this.config.buffer : bandPrice + this.config.buffer;
    const tpPrice = state.vwap;
    const rrRatio = Math.abs(tpPrice - entryPrice) / Math.abs(slPrice - entryPrice);

    return {
      timestamp: new Date(),
      instrument: data.symbol,
      strategy: this.name,
      direction,
      entryPrice,
      stopLoss: slPrice,
      takeProfit: tpPrice,
      rrRatio,
      confidenceScore: 70, // Base confidence, will be adjusted by filters
      confluenceFactors: {},
      indicatorState: { vwap: state.vwap, sd: state.sd, upperBand, lowerBand },
    };
  }
}
