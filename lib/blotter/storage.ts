import type { RiskSettings } from "./risk";
import type { BlotterApiError, BlotterState, Exchange, Fill } from "./types";

// Client-side API for the server-stored journal (data/blotter.json behind
// /api/blotter/*). Replaces the old localStorage persistence.

export function emptyBlotterState(): BlotterState {
  return { version: 2, exchanges: [], fills: [], tradeNotes: {}, riskSettings: {} };
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as BlotterApiError;
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

async function expectOk(res: Response, fallback: string): Promise<void> {
  if (!res.ok) throw new Error(await parseError(res, fallback));
}

export async function fetchBlotterState(): Promise<BlotterState> {
  const res = await fetch("/api/blotter/state");
  if (!res.ok) throw new Error(await parseError(res, "Не удалось загрузить журнал."));
  const state = (await res.json()) as BlotterState;
  if (state.version !== 2 || !Array.isArray(state.fills) || !Array.isArray(state.exchanges)) {
    throw new Error("Сервер вернул некорректное состояние журнала.");
  }
  return state;
}

export async function apiAddFills(fills: Fill[]): Promise<number> {
  const res = await fetch("/api/blotter/fills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fills }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Не удалось сохранить исполнения."));
  const body = (await res.json()) as { added: number };
  return body.added;
}

export async function apiDeleteFills(ids: string[]): Promise<void> {
  const res = await fetch("/api/blotter/fills", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  await expectOk(res, "Не удалось удалить исполнения.");
}

export async function apiSaveNote(tradeId: string, note: string): Promise<void> {
  const res = await fetch("/api/blotter/notes", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tradeId, note }),
  });
  await expectOk(res, "Не удалось сохранить заметку.");
}

export async function apiClearAll(): Promise<void> {
  const res = await fetch("/api/blotter/state", { method: "DELETE" });
  await expectOk(res, "Не удалось очистить журнал.");
}

export async function apiAddExchange(name: string, capital: number): Promise<Exchange> {
  const res = await fetch("/api/blotter/exchanges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, capital }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Не удалось создать биржу."));
  return (await res.json()) as Exchange;
}

export async function apiUpdateExchange(
  id: string,
  patch: { name?: string; capital?: number },
): Promise<void> {
  const res = await fetch("/api/blotter/exchanges", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
  await expectOk(res, "Не удалось обновить биржу.");
}

export async function apiDeleteExchange(id: string): Promise<void> {
  const res = await fetch("/api/blotter/exchanges", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  await expectOk(res, "Не удалось удалить биржу.");
}

export async function apiSaveRiskSettings(
  exchangeId: string,
  settings: RiskSettings,
): Promise<void> {
  const res = await fetch("/api/blotter/risk", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exchangeId, settings }),
  });
  await expectOk(res, "Не удалось сохранить риск-настройки.");
}

export async function apiResetRiskSettings(exchangeId: string): Promise<void> {
  const res = await fetch("/api/blotter/risk", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exchangeId }),
  });
  await expectOk(res, "Не удалось сбросить риск-настройки.");
}
