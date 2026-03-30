import { MarketData } from "../strategies/base_strategy.ts";
import { BrokerClient } from "../core/broker_client.ts";
import { settings } from "../config/settings.ts";

export class MarketDataSimulator {
  private interval: NodeJS.Timeout | null = null;
  private prices: Map<string, number> = new Map();
  private volatilities: Map<string, number> = new Map();

  constructor(private broker: BrokerClient) {
    // Initialize starting prices and volatilities
    this.prices.set("NQ", 18200);
    this.prices.set("MNQ", 18200);
    this.prices.set("ES", 5250);
    this.prices.set("MES", 5250);

    this.volatilities.set("NQ", 5);
    this.volatilities.set("MNQ", 5);
    this.volatilities.set("ES", 1.5);
    this.volatilities.set("MES", 1.5);
  }

  public start() {
    console.log("Starting Market Data Simulator...");
    const symbols = settings.TRADING.DEFAULT_SYMBOLS;

    this.interval = setInterval(() => {
      symbols.forEach((symbol) => {
        // Get base symbol (e.g., NQ from NQM6)
        const baseSymbol = symbol.startsWith("MNQ") ? "MNQ" : 
                          symbol.startsWith("NQ") ? "NQ" :
                          symbol.startsWith("MES") ? "MES" :
                          symbol.startsWith("ES") ? "ES" : "NQ";

        let currentPrice = this.prices.get(baseSymbol) || 18000;
        const vol = this.volatilities.get(baseSymbol) || 2;

        // Random walk with slight mean reversion tendency
        const change = (Math.random() - 0.5) * vol * 2;
        currentPrice += change;
        this.prices.set(baseSymbol, currentPrice);

        const data: MarketData = {
          symbol: symbol,
          price: currentPrice,
          volume: Math.floor(Math.random() * 500) + 100,
          timestamp: new Date(),
          high: currentPrice + Math.random() * vol,
          low: currentPrice - Math.random() * vol,
          close: currentPrice,
          open: currentPrice - change,
        };

        if (this.broker.onMarketData) {
          this.broker.onMarketData(data);
        }
      });
    }, 1000); // Every 1 second for higher resolution
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
