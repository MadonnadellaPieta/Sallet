import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { initDb } from "./backend/database/db.ts";
import { BrokerClient } from "./backend/core/broker_client.ts";
import { TradovateClient } from "./backend/core/tradovate_client.ts";
import { SimulatorBroker } from "./backend/core/simulator_broker.ts";
import { RiskManager } from "./backend/core/risk_manager.ts";
import { SignalController } from "./backend/core/signal_controller.ts";
import { StrategyEngine } from "./backend/strategies/strategy_engine.ts";
import { MarketDataSimulator } from "./backend/core/simulator.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("Starting server initialization...");
  // Initialize database
  initDb();
  console.log("Database initialized.");

  // Initialize Core Components
  console.log("Initializing core components...");
  let broker: BrokerClient = new TradovateClient();
  const risk = new RiskManager();
  const strategyEngine = new StrategyEngine();
  
  // Start Broker Connection
  let connected = await broker.connect();
  if (!connected) {
    console.log("Broker connection failed. Starting simulator mode...");
    broker = new SimulatorBroker();
  }

  const signalController = new SignalController(broker, risk);
  const simulator = new MarketDataSimulator(broker);
  risk.setBroker(broker);
  console.log("Core components initialized.");

  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  // WebSocket Server
  console.log("Initializing WebSocket server...");
  const wss = new WebSocketServer({ server });
  console.log("WebSocket server initialized.");

  // Connect Core Components
  signalController.onBroadcast = (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  strategyEngine.onSignal = (signal) => {
    signalController.onNewSignal(signal);
  };

  broker.onMarketData = (data) => {
    strategyEngine.onMarketData(data);
    
    // Update simulator broker prices for SL/TP checks
    if (broker instanceof SimulatorBroker) {
      broker.updatePrices(data.symbol, data.price);
    }

    // Broadcast price updates for PnL calculation
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "PRICE_UPDATE", symbol: data.symbol, price: data.price }));
      }
    });
  };

  broker.onOrderUpdate = (update) => {
    signalController.onOrderUpdate(update);
  };

  risk.onUpdate = (stats) => {
    if (signalController.onBroadcast) {
      signalController.onBroadcast({ type: "ACCOUNT_UPDATE", stats });
    }
  };

  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected to WebSocket");

    // Send initial state
    ws.send(JSON.stringify({
      type: "INITIAL_STATE",
      signals: signalController.getActiveSignals(),
      trades: signalController.getRecentTrades(),
      stats: risk.getStats(),
      history: risk.getHistory()
    }));

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        console.log("Received WebSocket message:", data);

        if (data.type === "ACCEPT_SIGNAL") {
          const result = await signalController.acceptSignal(data.signalId);
          ws.send(JSON.stringify({ type: "SIGNAL_RESULT", success: result.success, reason: result.reason }));
        } else if (data.type === "REJECT_SIGNAL") {
          signalController.rejectSignal(data.signalId, data.reason || "User rejected");
          ws.send(JSON.stringify({ type: "SIGNAL_RESULT", success: true }));
        } else if (data.type === "FLATTEN_ALL") {
          const success = await broker.flattenAll();
          ws.send(JSON.stringify({ type: "FLATTEN_RESULT", success }));
        } else if (data.type === "CLOSE_POSITION") {
          const success = await broker.closePosition(data.orderId);
          ws.send(JSON.stringify({ type: "CLOSE_RESULT", success, orderId: data.orderId }));
        } else if (data.type === "MANUAL_ORDER") {
          const { symbol, side, quantity, entryPrice, stopLoss, takeProfit } = data;
          const result = await signalController.placeManualTrade(symbol, side, quantity, entryPrice, stopLoss, takeProfit);
          ws.send(JSON.stringify({ type: "ORDER_RESULT", success: result.success, orderId: result.orderId, error: result.error }));
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  if (!connected) {
    simulator.start();
  }
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
