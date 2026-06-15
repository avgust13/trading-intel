import "server-only";

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { RiskSettings } from "./risk";
import type { BlotterState, Exchange, Fill } from "./types";

// Server-side persistence: one pretty-printed JSON file holding the whole
// BlotterState. All operations are synchronous, so a read-modify-write never
// interleaves with another request in this process. Writes go through a temp
// file + rename, so a killed process can't leave a half-written file behind.

function dataPath(): string {
  return resolve(process.cwd(), process.env.BLOTTER_DATA_PATH || "data/blotter.json");
}

function emptyState(): BlotterState {
  return { version: 2, exchanges: [], fills: [], tradeNotes: {}, riskSettings: {} };
}

/**
 * Migrate a v1 state (no exchanges, fills without exchangeId) to v2. Any
 * orphan fills are reassigned to a freshly-created "Default" exchange so the
 * journal stays consistent. The current file is empty, so this is for safety.
 */
function migrateV1(parsed: { fills?: unknown; tradeNotes?: unknown }): BlotterState {
  const rawFills = Array.isArray(parsed.fills) ? (parsed.fills as Fill[]) : [];
  const tradeNotes =
    parsed.tradeNotes && typeof parsed.tradeNotes === "object"
      ? (parsed.tradeNotes as Record<string, string>)
      : {};
  if (rawFills.length === 0) {
    return { version: 2, exchanges: [], fills: [], tradeNotes };
  }
  const defaultExchange: Exchange = { id: randomUUID(), name: "Default", capital: 0 };
  const fills = rawFills.map((f) => ({ ...f, exchangeId: f.exchangeId || defaultExchange.id }));
  return { version: 2, exchanges: [defaultExchange], fills, tradeNotes };
}

function readState(): BlotterState {
  const path = dataPath();
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return emptyState(); // no file yet
  }
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      exchanges?: unknown;
      fills?: unknown;
      tradeNotes?: unknown;
      riskSettings?: unknown;
    };
    if (!parsed || !Array.isArray(parsed.fills)) throw new Error("unexpected shape");
    if (parsed.version === 1) return migrateV1(parsed);
    if (parsed.version !== 2 || !Array.isArray(parsed.exchanges)) {
      throw new Error("unexpected shape");
    }
    return {
      version: 2,
      exchanges: parsed.exchanges as Exchange[],
      fills: parsed.fills as Fill[],
      tradeNotes:
        parsed.tradeNotes && typeof parsed.tradeNotes === "object"
          ? (parsed.tradeNotes as Record<string, string>)
          : {},
      riskSettings:
        parsed.riskSettings && typeof parsed.riskSettings === "object"
          ? (parsed.riskSettings as Record<string, RiskSettings>)
          : {},
    };
  } catch {
    // Don't lose a corrupt file — set it aside and start fresh.
    try {
      renameSync(path, `${path}.corrupt-${Date.now()}`);
    } catch {
      // If even the rename fails, the next write will overwrite it.
    }
    return emptyState();
  }
}

function writeState(state: BlotterState): void {
  const path = dataPath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, path); // atomic replace (MOVEFILE_REPLACE_EXISTING on Windows)
}

export function storeGetState(): BlotterState {
  return readState();
}

/**
 * Insert fills, skipping ids already present and any whose exchangeId doesn't
 * reference an existing exchange. Returns how many were actually added.
 */
export function storeAddFills(fills: Fill[]): number {
  const state = readState();
  const existing = new Set(state.fills.map((f) => f.id));
  const knownExchanges = new Set(state.exchanges.map((e) => e.id));
  const fresh = fills.filter((f) => !existing.has(f.id) && knownExchanges.has(f.exchangeId));
  if (fresh.length > 0) {
    state.fills.push(...fresh);
    writeState(state);
  }
  return fresh.length;
}

export function storeDeleteFills(ids: string[]): void {
  const drop = new Set(ids);
  const state = readState();
  const next = state.fills.filter((f) => !drop.has(f.id));
  if (next.length !== state.fills.length) {
    state.fills = next;
    writeState(state);
  }
}

export function storeSetNote(tradeId: string, note: string): void {
  const state = readState();
  if (note.trim()) state.tradeNotes[tradeId] = note;
  else delete state.tradeNotes[tradeId];
  writeState(state);
}

export function storeClearAll(): void {
  // Keep the configured exchanges; only wipe trades and notes.
  const state = readState();
  writeState({ ...state, fills: [], tradeNotes: {} });
}

export function storeAddExchange(name: string, capital: number): Exchange {
  const state = readState();
  const exchange: Exchange = { id: randomUUID(), name: name.trim(), capital };
  state.exchanges.push(exchange);
  writeState(state);
  return exchange;
}

export function storeUpdateExchange(
  id: string,
  patch: { name?: string; capital?: number },
): Exchange | null {
  const state = readState();
  const exchange = state.exchanges.find((e) => e.id === id);
  if (!exchange) return null;
  if (typeof patch.name === "string") exchange.name = patch.name.trim();
  if (typeof patch.capital === "number") exchange.capital = patch.capital;
  writeState(state);
  return exchange;
}

/** Delete an exchange and cascade: drop all its fills (notes of orphaned trades
 *  are pruned too — any note whose trade id is one of the deleted fill ids). */
export function storeDeleteExchange(id: string): void {
  const state = readState();
  const removedFillIds = new Set(
    state.fills.filter((f) => f.exchangeId === id).map((f) => f.id),
  );
  state.exchanges = state.exchanges.filter((e) => e.id !== id);
  state.fills = state.fills.filter((f) => f.exchangeId !== id);
  for (const tradeId of Object.keys(state.tradeNotes)) {
    if (removedFillIds.has(tradeId)) delete state.tradeNotes[tradeId];
  }
  if (state.riskSettings) delete state.riskSettings[id];
  writeState(state);
}

/** Upsert per-exchange risk settings. Returns null if the exchange is unknown. */
export function storeSetRiskSettings(
  exchangeId: string,
  settings: RiskSettings,
): RiskSettings | null {
  const state = readState();
  if (!state.exchanges.some((e) => e.id === exchangeId)) return null;
  state.riskSettings = { ...(state.riskSettings ?? {}), [exchangeId]: settings };
  writeState(state);
  return settings;
}

/** Drop per-exchange overrides so the exchange falls back to defaults. */
export function storeResetRiskSettings(exchangeId: string): void {
  const state = readState();
  if (state.riskSettings && exchangeId in state.riskSettings) {
    const next = { ...state.riskSettings };
    delete next[exchangeId];
    state.riskSettings = next;
    writeState(state);
  }
}
