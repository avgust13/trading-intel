// Risk Control / Drawdown Limits — pure engine (no IO).
//
// Everything here is DERIVED from the journal's closed trades, mirroring the
// blotter's "derive, don't store" philosophy: walk a day's (or week's) closed
// trades in `closedAt` order, accumulate realized P&L, and read off the daily
// loss lock, weekly loss lock, profit scaling and giveback protection from that
// path. The only thing that needs persisting is `RiskSettings` (per exchange).
//
// Because the day/week windows are anchored on `now`, locks reset automatically:
// a new trading day no longer sees yesterday's trades, a new week no longer sees
// last week's — no stored `lockedUntil` is required.
//
// v1 scope: realized P&L only (no fees/unrealized — the Fill model has neither),
// single currency (USD), week starts Monday (reuses datetime.weekKeys).

import { dayKey, todayKey, weekKeys, type TzMode } from "@/lib/calendar/datetime";

import type { Trade } from "./types";

export type BaseRiskMode = "usd" | "pct";
/** v1 supports Monday only — datetime.weekKeys is Monday-first. Stored for forward-compat. */
export type WeekStart = "monday";

/** Per-account (exchange) risk configuration. */
export interface RiskSettings {
  /** Max loss for one trading day, USD (positive number). */
  maxDailyLoss: number;
  /** Max loss for one trading week, USD (positive number). */
  maxWeeklyLoss: number;
  /** Base risk budget for a single trade — USD, or % of capital when baseRiskMode === "pct". */
  baseRiskPerTrade: number;
  baseRiskMode: BaseRiskMode;
  /** Allow growing the per-trade risk out of the day's profit. */
  profitRiskScalingEnabled: boolean;
  /** Profit (USD) that must exist before any scaling kicks in. */
  profitBufferBeforeScaling: number;
  /** Share of profit above the buffer usable as extra risk (0..1). */
  profitRiskShare: number;
  /** Hard ceiling for per-trade risk after scaling, USD. */
  maxScaledRiskPerTrade: number;
  /** How much of the day's peak profit may be given back before locking (0..100). */
  maxDailyGivebackPercent: number;
  /** Timezone that defines the trading-day / week boundary. */
  timezone: TzMode;
  weekStartsOn: WeekStart;
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  maxDailyLoss: 100,
  maxWeeklyLoss: 300,
  baseRiskPerTrade: 25,
  baseRiskMode: "usd",
  profitRiskScalingEnabled: true,
  profitBufferBeforeScaling: 50,
  profitRiskShare: 0.3,
  maxScaledRiskPerTrade: 75,
  maxDailyGivebackPercent: 50,
  timezone: "local",
  weekStartsOn: "monday",
};

/** Stored settings merged over defaults (tolerates partial/legacy records). */
export function getRiskSettings(
  stored: Record<string, Partial<RiskSettings>> | undefined,
  exchangeId: string,
): RiskSettings {
  return { ...DEFAULT_RISK_SETTINGS, ...(stored?.[exchangeId] ?? {}) };
}

export type RiskStatus =
  | "ACTIVE"
  | "WARNING_DAILY_LIMIT_NEAR"
  | "WARNING_WEEKLY_LIMIT_NEAR"
  | "RISK_LOCKED_DAILY"
  | "RISK_LOCKED_WEEKLY"
  | "RISK_LOCKED_GIVEBACK";

export interface RiskState {
  status: RiskStatus;

  // --- daily (realized only) ---
  realizedPnLToday: number;
  /** == realizedPnLToday in v1 (no unrealized). Kept distinct for forward-compat. */
  totalPnLToday: number;
  /** Highest cumulative P&L reached today (>= 0). */
  peakDailyPnL: number;
  currentDrawdownFromPeak: number;
  /** How much of the daily loss budget is currently used (>= 0). */
  dailyDrawdownUsed: number;
  maxDailyLoss: number;
  /** Capacity left down to the hard daily loss limit (0 when locked). */
  remainingDailyRisk: number;
  /** P&L level below which giveback locks; null when there's no positive peak yet. */
  givebackStopLevel: number | null;

  // --- weekly (realized only) ---
  realizedPnLWeek: number;
  totalPnLWeek: number;
  peakWeeklyPnL: number;
  weeklyDrawdownUsed: number;
  maxWeeklyLoss: number;
  remainingWeeklyRisk: number;

  // --- sizing ---
  /** Base risk resolved to USD (after applying baseRiskMode). */
  baseRiskPerTrade: number;
  allowedRiskPerTrade: number;
  scalingApplied: boolean;

  // --- flags ---
  dailyLossHit: boolean;
  weeklyLossHit: boolean;
  givebackHit: boolean;
  canOpen: boolean;
}

export const RISK_MESSAGES = {
  daily: "Daily loss limit reached. Trading disabled until next trading day.",
  weekly: "Weekly loss limit reached. Trading disabled until next week.",
  giveback: "Daily giveback limit reached. Trading disabled to protect profits.",
  tradeRisk: "Trade risk exceeds allowed risk per trade.",
} as const;

export interface CanOpenTradeResult {
  allowed: boolean;
  reason?: string;
  riskStatus: RiskStatus;
  allowedRiskPerTrade: number;
  remainingDailyRisk: number;
  remainingWeeklyRisk: number;
}

type ClosedTrade = Trade & { closedAt: string };

interface Walk {
  /** Final cumulative P&L. */
  final: number;
  /** Running maximum (>= 0). */
  peak: number;
  /** Running minimum (<= 0). */
  min: number;
  /** True if, after some positive peak, the running P&L fell below peak*gbFrac. */
  givebackHit: boolean;
}

/**
 * Walk closed trades (ascending close time) accumulating P&L. `gbFrac` is the
 * fraction of the running peak that must be preserved (e.g. 0.5 for a 50%
 * giveback cap); pass null to skip giveback detection (weekly).
 */
function walk(closedAsc: ClosedTrade[], gbFrac: number | null): Walk {
  let running = 0;
  let peak = 0;
  let min = 0;
  let givebackHit = false;
  for (const t of closedAsc) {
    running += t.realizedPnl;
    if (running > peak) peak = running;
    if (running < min) min = running;
    if (gbFrac !== null && peak > 0 && running < peak * gbFrac) givebackHit = true;
  }
  return { final: running, peak, min, givebackHit };
}

const byCloseAsc = (a: ClosedTrade, b: ClosedTrade) => a.closedAt.localeCompare(b.closedAt);

/**
 * Derive the full risk state for one account from its trades. Pass the trades
 * already filtered to a single exchange (open + closed; this function keeps the
 * closed ones). `capital` is only used when baseRiskMode === "pct".
 */
export function computeRiskState(
  trades: Trade[],
  settings: RiskSettings,
  capital: number,
  now: Date = new Date(),
): RiskState {
  const tz: TzMode = settings.timezone;
  const tKey = todayKey(tz, now);
  const weekSet = new Set(weekKeys(tKey));

  const closed = trades.filter((t): t is ClosedTrade => t.status === "closed" && t.closedAt !== null);
  const todayTrades = closed.filter((t) => dayKey(t.closedAt, tz) === tKey).sort(byCloseAsc);
  const weekTrades = closed.filter((t) => weekSet.has(dayKey(t.closedAt, tz))).sort(byCloseAsc);

  const gbFrac = 1 - settings.maxDailyGivebackPercent / 100;
  const day = walk(todayTrades, gbFrac);
  const week = walk(weekTrades, null);

  const realizedPnLToday = day.final;
  const totalPnLToday = realizedPnLToday;
  const peakDailyPnL = day.peak;
  const currentDrawdownFromPeak = Math.max(0, peakDailyPnL - totalPnLToday);
  const dailyDrawdownUsed = Math.max(0, -totalPnLToday);

  const realizedPnLWeek = week.final;
  const totalPnLWeek = realizedPnLWeek;
  const peakWeeklyPnL = week.peak;
  const weeklyDrawdownUsed = Math.max(0, -totalPnLWeek);

  const dailyLossHit = day.min <= -settings.maxDailyLoss;
  const weeklyLossHit = week.min <= -settings.maxWeeklyLoss;
  const givebackHit = day.givebackHit;
  const locked = dailyLossHit || weeklyLossHit || givebackHit;

  const givebackStopLevel = peakDailyPnL > 0 ? peakDailyPnL * gbFrac : null;

  // Capacity to the HARD loss limits (giveback is a separate, reactive lock and
  // does not cap per-trade risk — matches the spec's "Remaining …Capacity" math).
  const remainingDailyRisk = locked ? 0 : Math.max(0, settings.maxDailyLoss + totalPnLToday);
  const remainingWeeklyRisk = weeklyLossHit ? 0 : Math.max(0, settings.maxWeeklyLoss + realizedPnLWeek);

  const base =
    settings.baseRiskMode === "pct"
      ? Math.max(0, capital) * (settings.baseRiskPerTrade / 100)
      : settings.baseRiskPerTrade;

  // Profit scaling: only when in profit today, not underwater on the week.
  let scaled = base;
  let scalingApplied = false;
  if (
    settings.profitRiskScalingEnabled &&
    totalPnLToday > settings.profitBufferBeforeScaling &&
    realizedPnLWeek >= 0
  ) {
    const extra = Math.max(0, (totalPnLToday - settings.profitBufferBeforeScaling) * settings.profitRiskShare);
    const candidate = Math.min(base + extra, settings.maxScaledRiskPerTrade);
    if (candidate > base) {
      scaled = candidate;
      scalingApplied = true;
    }
  }

  // Never let one trade's risk breach the daily/weekly loss limit.
  const allowedRiskPerTrade = locked
    ? 0
    : Math.max(0, Math.min(scaled, remainingDailyRisk, remainingWeeklyRisk));

  let status: RiskStatus;
  if (weeklyLossHit) status = "RISK_LOCKED_WEEKLY";
  else if (dailyLossHit) status = "RISK_LOCKED_DAILY";
  else if (givebackHit) status = "RISK_LOCKED_GIVEBACK";
  else {
    const weeklyUsedPct = settings.maxWeeklyLoss > 0 ? weeklyDrawdownUsed / settings.maxWeeklyLoss : 0;
    const dailyUsedPct = settings.maxDailyLoss > 0 ? dailyDrawdownUsed / settings.maxDailyLoss : 0;
    if (weeklyUsedPct >= 0.8) status = "WARNING_WEEKLY_LIMIT_NEAR";
    else if (dailyUsedPct >= 0.8) status = "WARNING_DAILY_LIMIT_NEAR";
    else status = "ACTIVE";
  }

  return {
    status,
    realizedPnLToday,
    totalPnLToday,
    peakDailyPnL,
    currentDrawdownFromPeak,
    dailyDrawdownUsed,
    maxDailyLoss: settings.maxDailyLoss,
    remainingDailyRisk,
    givebackStopLevel,
    realizedPnLWeek,
    totalPnLWeek,
    peakWeeklyPnL,
    weeklyDrawdownUsed,
    maxWeeklyLoss: settings.maxWeeklyLoss,
    remainingWeeklyRisk,
    baseRiskPerTrade: base,
    allowedRiskPerTrade,
    scalingApplied,
    dailyLossHit,
    weeklyLossHit,
    givebackHit,
    canOpen: !locked,
  };
}

/**
 * Pre-trade gate. Decides whether a new trade with `estimatedRisk` (USD) may be
 * opened given an already-computed RiskState. The locks take precedence (weekly
 * > daily > giveback), then the per-trade risk ceiling.
 */
export function canOpenTrade(riskState: RiskState, estimatedRisk: number): CanOpenTradeResult {
  const base = {
    riskStatus: riskState.status,
    allowedRiskPerTrade: riskState.allowedRiskPerTrade,
    remainingDailyRisk: riskState.remainingDailyRisk,
    remainingWeeklyRisk: riskState.remainingWeeklyRisk,
  };

  if (riskState.weeklyLossHit) return { ...base, allowed: false, reason: RISK_MESSAGES.weekly };
  if (riskState.dailyLossHit) return { ...base, allowed: false, reason: RISK_MESSAGES.daily };
  if (riskState.givebackHit) return { ...base, allowed: false, reason: RISK_MESSAGES.giveback };
  if (estimatedRisk > riskState.allowedRiskPerTrade) {
    return { ...base, allowed: false, reason: RISK_MESSAGES.tradeRisk };
  }
  return { ...base, allowed: true };
}
