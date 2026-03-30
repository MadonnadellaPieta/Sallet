import { BrokerClient, ConnectionStatus, AccountInfo, Position, OrderUpdate } from "./broker_client.ts";
import { MarketData } from "../strategies/base_strategy.ts";
import { settings } from "../config/settings.ts";
import WebSocket from "ws";
import axios from "axios";

export class TradovateClient implements BrokerClient {
  private ws: WebSocket | null = null;
  private mdWs: WebSocket | null = null;
  private accessToken: string | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private requestId: number = 1;
  private pendingRequests: Map<number, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

  public onMarketData?: (data: MarketData) => void;
  public onOrderUpdate?: (update: OrderUpdate) => void;

  async connect(): Promise<boolean> {
    this.status = ConnectionStatus.CONNECTING;
    try {
      // 1. Authenticate via REST
      if (!settings.TRADOVATE.USERNAME || !settings.TRADOVATE.PASSWORD) {
        console.log("Tradovate credentials missing. Skipping connection.");
        return false;
      }

      const authResponse = await axios.post(`${settings.TRADOVATE.API_URL}/auth/accesstokenrequest`, {
        name: settings.TRADOVATE.USERNAME,
        password: settings.TRADOVATE.PASSWORD,
        appId: settings.TRADOVATE.APP_ID,
        appVersion: settings.TRADOVATE.APP_VERSION,
        cid: settings.TRADOVATE.CLIENT_ID,
        sec: settings.TRADOVATE.CLIENT_SECRET,
      });

      this.accessToken = authResponse.data.accessToken;
      
      // 2. Connect to WebSocket
      this.ws = new WebSocket(settings.TRADOVATE.WS_URL);
      
      return new Promise((resolve) => {
        if (!this.ws) return resolve(false);

        const timeout = setTimeout(() => {
          console.log("Tradovate connection timeout");
          resolve(false);
        }, 10000);

        this.ws.on("open", () => {
          clearTimeout(timeout);
          // Authorize WebSocket
          this.sendRequest("authorize", this.accessToken);
          this.status = ConnectionStatus.CONNECTED;
          console.log("Tradovate WebSocket Connected");
          resolve(true);
        });

        this.ws.on("error", (err) => {
          clearTimeout(timeout);
          console.error("Tradovate WS Error:", err);
          this.status = ConnectionStatus.ERROR;
          resolve(false);
        });

        this.ws.on("close", () => {
          this.status = ConnectionStatus.DISCONNECTED;
          console.log("Tradovate WS Closed");
        });

        this.ws.on("message", (data) => {
          this.handleMessage(data.toString());
        });
      });
    } catch (error) {
      console.error("Tradovate Connection Failed:", error);
      this.status = ConnectionStatus.ERROR;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.ws?.close();
    this.mdWs?.close();
    this.status = ConnectionStatus.DISCONNECTED;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async subscribeMarketData(symbol: string): Promise<boolean> {
    this.sendRequest("md/subscribeQuote", { symbol });
    return true;
  }

  async unsubscribeMarketData(symbol: string): Promise<boolean> {
    this.sendRequest("md/unsubscribeQuote", { symbol });
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
    try {
      const order = {
        accountSpec: settings.TRADOVATE.USERNAME,
        symbol,
        action: side === "long" ? "Buy" : "Sell",
        orderStrategyTypeId: 2, // Bracket
        orderQty: quantity,
        orderType: "Limit",
        price: entryPrice,
        isAutomated: true,
        brackets: [
          {
            qty: quantity,
            profitTarget: takeProfit,
            stopLoss: stopLoss,
            trailingStop: false
          }
        ]
      };

      const response = await this.requestAsync("order/placeOrder", order);
      if (response && response.orderId) {
        return { success: true, orderId: response.orderId.toString() };
      } else {
        return { success: false, error: response?.errorText || "Unknown error" };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async closePosition(orderId: string): Promise<boolean> {
    const positions = await this.getPositions();
    const pos = positions.find(p => p.orderId === orderId || p.symbol === orderId);
    if (pos) {
      await this.requestAsync("order/placeOrder", {
        accountSpec: settings.TRADOVATE.USERNAME,
        symbol: pos.symbol,
        action: pos.side === "long" ? "Sell" : "Buy",
        orderQty: pos.quantity,
        orderType: "Market",
        isAutomated: true
      });
      return true;
    }
    return false;
  }

  async flattenAll(): Promise<boolean> {
    const positions = await this.getPositions();
    for (const pos of positions) {
      await this.requestAsync("order/placeOrder", {
        accountSpec: settings.TRADOVATE.USERNAME,
        symbol: pos.symbol,
        action: pos.side === "long" ? "Sell" : "Buy",
        orderQty: pos.quantity,
        orderType: "Market",
        isAutomated: true
      });
    }
    return true;
  }

  async getAccountInfo(): Promise<AccountInfo> {
    try {
      const response = await this.requestAsync("account/list", {});
      if (response && response.length > 0) {
        const acc = response[0];
        return {
          balance: acc.balance || 0,
          dailyPnL: acc.dailyPnL || 0,
          drawdownRemaining: 3000, // Placeholder for logic
          eodThreshold: 0,
          phase: "Live",
          maxContracts: 10
        };
      }
    } catch (e) {
      console.error("Failed to fetch account info:", e);
    }
    
    return {
      balance: 100000,
      dailyPnL: 0,
      drawdownRemaining: 3000,
      eodThreshold: 97000,
      phase: "Eval",
      maxContracts: 8
    };
  }

  async getPositions(): Promise<Position[]> {
    try {
      const response = await this.requestAsync("position/list", {});
      return (response || []).map((p: any) => ({
        orderId: p.id?.toString() || p.symbol, // Use position ID or symbol as fallback
        symbol: p.symbol,
        side: p.netQty > 0 ? "long" : "short",
        quantity: Math.abs(p.netQty),
        entryPrice: p.avgPrice,
        currentPrice: p.avgPrice, // Placeholder
        unrealizedPnL: p.unrealizedPnL || 0,
        stopLoss: 0,
        takeProfit: 0
      }));
    } catch (e) {
      console.error("Failed to fetch positions:", e);
      return [];
    }
  }

  private sendRequest(url: string, body: any, id?: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const rid = id || this.requestId++;
    const request = {
      url,
      query: "",
      body,
      id: rid
    };

    this.ws.send(JSON.stringify(request));
    return rid;
  }

  private async requestAsync(url: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      this.pendingRequests.set(id, { resolve, reject });
      this.sendRequest(url, body, id);

      // Timeout after 15 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${url} timed out`));
        }
      }, 15000);
    });
  }

  private handleMessage(message: string) {
    if (message === "h") return;
    
    // Tradovate frame format: a["{...}"]
    if (message.startsWith("a[")) {
      try {
        const frames = JSON.parse(message.substring(1));
        for (const frameStr of frames) {
          const frame = JSON.parse(frameStr);
          
          // Handle response to a request
          if (frame.i && this.pendingRequests.has(frame.i)) {
            const { resolve } = this.pendingRequests.get(frame.i)!;
            this.pendingRequests.delete(frame.i);
            resolve(frame.d);
          }

          // Handle events (e.g., execution reports, market data)
          if (frame.e === "props") {
            const entities = frame.d;
            for (const entity of entities) {
              // Market Data Update
              if (entity.symbol && entity.lastPrice !== undefined) {
                if (this.onMarketData) {
                  this.onMarketData({
                    symbol: entity.symbol,
                    price: entity.lastPrice,
                    volume: entity.volume || 0,
                    timestamp: new Date(),
                    high: entity.highPrice || entity.lastPrice,
                    low: entity.lowPrice || entity.lastPrice,
                    close: entity.lastPrice,
                    open: entity.openPrice || entity.lastPrice,
                  });
                }
              }

              // Execution Report (Order Update)
              if (entity.orderId && entity.orderStatus) {
                if (this.onOrderUpdate) {
                  this.onOrderUpdate({
                    orderId: entity.orderId.toString(),
                    status: entity.orderStatus,
                    symbol: entity.symbol,
                    side: entity.buySell === "Buy" ? "long" : "short",
                    quantity: entity.qty,
                    price: entity.price || 0,
                    timestamp: new Date(),
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Error parsing Tradovate frame:", e);
      }
    }
  }
}
