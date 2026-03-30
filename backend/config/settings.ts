import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

export const settings = {
  TRADOVATE: {
    API_URL: process.env.TRADOVATE_API_URL || "https://demo.tradovateapi.com/v1",
    WS_URL: process.env.TRADOVATE_WS_URL || "wss://demo.tradovateapi.com/v1/websocket",
    MD_WS_URL: process.env.TRADOVATE_MD_WS_URL || "wss://md.tradovateapi.com/v1/websocket",
    CLIENT_ID: process.env.TRADOVATE_CLIENT_ID || "",
    CLIENT_SECRET: process.env.TRADOVATE_CLIENT_SECRET || "",
    APP_ID: process.env.TRADOVATE_APP_ID || "Armet",
    APP_VERSION: process.env.TRADOVATE_APP_VERSION || "1.0.0",
    USERNAME: process.env.TRADOVATE_USERNAME || "",
    PASSWORD: process.env.TRADOVATE_PASSWORD || "",
  },
  TRADING: {
    DEFAULT_SYMBOLS: ["ESM6", "MESM6", "NQM6", "MNQM6"], // Example symbols for June 2026
    HOURS: {
      START: "09:30",
      END: "16:00",
      TIMEZONE: "America/New_York",
    },
  },
  APEX_RULES: {
    EVAL: {
      MAX_DRAWDOWN: 3000,
      MAX_CONTRACTS: 8,
    },
    PA: {
      MAX_DRAWDOWN: 3000,
      MAX_CONTRACTS: 6,
      SAFETY_NET: 103100,
      NEG_PL_RULE_PERCENT: 0.3,
      RISK_REWARD_CEILING: 5,
    },
  },
};
