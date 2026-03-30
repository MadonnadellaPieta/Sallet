import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "../../trading.db");
export const db = new Database(dbPath);

// Initialize database schema
export function initDb() {
  console.log("Initializing database...");
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      instrument TEXT NOT NULL,
      strategy TEXT NOT NULL,
      direction TEXT NOT NULL,
      entry_price REAL NOT NULL,
      stop_loss REAL NOT NULL,
      take_profit REAL NOT NULL,
      rr_ratio REAL NOT NULL,
      confidence_score REAL NOT NULL,
      confluence_factors TEXT, -- JSON
      indicator_state TEXT, -- JSON
      decision TEXT DEFAULT 'pending', -- accepted, rejected, expired
      decision_timestamp DATETIME
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id INTEGER,
      order_id TEXT NOT NULL,
      instrument TEXT NOT NULL,
      strategy TEXT NOT NULL,
      direction TEXT NOT NULL,
      entry_price REAL NOT NULL,
      stop_loss REAL NOT NULL,
      take_profit REAL NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL,
      fill_price REAL,
      fill_timestamp DATETIME,
      exit_price REAL,
      exit_timestamp DATETIME,
      actual_pnl REAL,
      slippage REAL,
      duration_seconds INTEGER,
      was_override BOOLEAN DEFAULT 0,
      override_details TEXT, -- JSON
      FOREIGN KEY (signal_id) REFERENCES signals(id)
    );

    CREATE TABLE IF NOT EXISTS phantom_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id INTEGER,
      would_have_hit_tp BOOLEAN,
      would_have_hit_sl BOOLEAN,
      phantom_pnl REAL,
      phantom_duration INTEGER,
      max_favorable_excursion REAL,
      max_adverse_excursion REAL,
      FOREIGN KEY (signal_id) REFERENCES signals(id)
    );

    CREATE TABLE IF NOT EXISTS account_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      account_id TEXT NOT NULL,
      balance REAL NOT NULL,
      peak_balance REAL NOT NULL,
      daily_starting_balance REAL NOT NULL,
      open_positions_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME NOT NULL,
      name TEXT NOT NULL,
      impact_level TEXT NOT NULL,
      actual TEXT,
      forecast TEXT,
      previous TEXT
    );

    CREATE TABLE IF NOT EXISTS circuit_breaker_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      trigger_type TEXT NOT NULL,
      trigger_value REAL,
      positions_flattened INTEGER
    );

    CREATE TABLE IF NOT EXISTS config_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      parameter_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT
    );
  `);
    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

export default db;
