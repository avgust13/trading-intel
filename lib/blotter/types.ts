// Trading blotter domain types.
//
// The source of truth is the flat list of `Fill` executions persisted in
// localStorage. Trades (positions) are always re-derived from fills by
// `groupFills()` — they are never stored, which keeps dedupe/edit/delete
// trivial and the math deterministic.

import type { RiskSettings } from "./risk";

export type Side = "buy" | "sell";
export type Direction = "long" | "short";

/** A trading account/exchange with its own capital. */
export interface Exchange {
  /** Stable id, assigned by the server via crypto.randomUUID(). */
  id: string;
  /** "Interactive Brokers", "Binance", … */
  name: string;
  /** Current capital on this exchange, USD. */
  capital: number;
}

/** One execution, stored as the source of truth. */
export interface Fill {
  /** Dedupe fingerprint (see fingerprint.ts). Also the storage key. */
  id: string;
  /** Which exchange/account this execution belongs to (Exchange.id). */
  exchangeId: string;
  /** Broker ticker, uppercase: "AMD". */
  symbol: string;
  side: Side;
  /** Positive; the FILLED quantity (not the ordered amount). */
  qty: number;
  price: number;
  /** Canonical ISO UTC instant. */
  executedAt: string;
  /** "Market" / "Limit" — display only. */
  orderType?: string;
  importedAt: string;
}

/** A fill (or a slice of one, after a position flip) attributed to a trade. */
export interface TradeFill {
  fillId: string;
  side: Side;
  /** May be a portion of the source fill when a single fill flips the position. */
  qty: number;
  price: number;
  executedAt: string;
}

/** Derived from fills — never persisted. */
export interface Trade {
  /** = first entry's fillId; stable across regroups so notes survive. */
  id: string;
  /** Carried from the trade's fills (all fills of a trade share one exchange). */
  exchangeId: string;
  symbol: string;
  direction: Direction;
  entries: TradeFill[];
  exits: TradeFill[];
  /** Total opened quantity (sum of entries). */
  qtyOpened: number;
  avgEntry: number;
  avgExit: number | null;
  openedAt: string;
  closedAt: string | null;
  status: "open" | "closed";
  /** 0 while there are no exits. */
  realizedPnl: number;
  /** Vs entry notional of the matched quantity. */
  realizedPnlPct: number;
}

export interface BlotterState {
  version: 2;
  exchanges: Exchange[];
  fills: Fill[];
  /** Notes keyed by Trade.id. */
  tradeNotes: Record<string, string>;
  /**
   * Risk Control settings keyed by Exchange.id. Optional/back-compat: absent in
   * older files (coalesced to {} on read). Exchanges without an entry fall back
   * to DEFAULT_RISK_SETTINGS via getRiskSettings().
   */
  riskSettings?: Record<string, RiskSettings>;
}

/** Raw row returned by the LLM, before date/timezone resolution. */
export interface ParsedFill {
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  /** "HH:MM:SS" exactly as displayed in the source. */
  time: string;
  /** "YYYY-MM-DD" only if a date is actually visible in the source. */
  date: string | null;
  /** "Filled", "Canceled", ... — null when the source has no status column. */
  status: string | null;
}

export interface ParseResponse {
  fills: ParsedFill[];
  notes: string | null;
}

export interface Candle {
  /** Unix seconds, UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "1d";

export interface CandlesResponse {
  symbol: string;
  yahooSymbol: string;
  interval: CandleInterval;
  candles: Candle[];
}

export interface BlotterApiError {
  error: string;
}
