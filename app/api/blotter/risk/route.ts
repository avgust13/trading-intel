import { NextResponse } from "next/server";

import { DEFAULT_RISK_SETTINGS, type RiskSettings } from "@/lib/blotter/risk";
import { storeResetRiskSettings, storeSetRiskSettings } from "@/lib/blotter/store";
import type { BlotterApiError } from "@/lib/blotter/types";
import type { TzMode } from "@/lib/calendar/datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(error: string) {
  return NextResponse.json({ error } satisfies BlotterApiError, { status: 400 });
}

function clampNum(
  v: unknown,
  fallback: number,
  { min, max }: { min?: number; max?: number } = {},
): number {
  let n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  if (min !== undefined) n = Math.max(min, n);
  if (max !== undefined) n = Math.min(max, n);
  return n;
}

/** Coerce arbitrary input into a complete, range-checked RiskSettings. */
function sanitize(input: Record<string, unknown>): RiskSettings {
  const d = DEFAULT_RISK_SETTINGS;
  const tz = input.timezone;
  const timezone: TzMode =
    tz === "local" || tz === "newYork" || tz === "london" || tz === "utc" ? tz : d.timezone;
  return {
    maxDailyLoss: clampNum(input.maxDailyLoss, d.maxDailyLoss, { min: 0 }),
    maxWeeklyLoss: clampNum(input.maxWeeklyLoss, d.maxWeeklyLoss, { min: 0 }),
    baseRiskPerTrade: clampNum(input.baseRiskPerTrade, d.baseRiskPerTrade, { min: 0 }),
    baseRiskMode: input.baseRiskMode === "pct" ? "pct" : "usd",
    profitRiskScalingEnabled:
      typeof input.profitRiskScalingEnabled === "boolean"
        ? input.profitRiskScalingEnabled
        : d.profitRiskScalingEnabled,
    profitBufferBeforeScaling: clampNum(input.profitBufferBeforeScaling, d.profitBufferBeforeScaling, {
      min: 0,
    }),
    profitRiskShare: clampNum(input.profitRiskShare, d.profitRiskShare, { min: 0, max: 1 }),
    maxScaledRiskPerTrade: clampNum(input.maxScaledRiskPerTrade, d.maxScaledRiskPerTrade, { min: 0 }),
    maxDailyGivebackPercent: clampNum(input.maxDailyGivebackPercent, d.maxDailyGivebackPercent, {
      min: 0,
      max: 100,
    }),
    timezone,
    weekStartsOn: "monday",
  };
}

export async function PUT(req: Request) {
  let body: { exchangeId?: unknown; settings?: unknown };
  try {
    body = (await req.json()) as { exchangeId?: unknown; settings?: unknown };
  } catch {
    return badRequest("Некорректный JSON.");
  }
  if (typeof body.exchangeId !== "string" || body.exchangeId.length === 0) {
    return badRequest("Не указан id биржи.");
  }
  if (!body.settings || typeof body.settings !== "object") {
    return badRequest("Не переданы настройки риска.");
  }
  try {
    const saved = storeSetRiskSettings(body.exchangeId, sanitize(body.settings as Record<string, unknown>));
    if (!saved) return NextResponse.json({ error: "Биржа не найдена." }, { status: 404 });
    return NextResponse.json(saved satisfies RiskSettings);
  } catch (err) {
    console.error("[error] PUT /api/blotter/risk failed:", err);
    return NextResponse.json(
      { error: "Не удалось сохранить риск-настройки." } satisfies BlotterApiError,
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  let body: { exchangeId?: unknown };
  try {
    body = (await req.json()) as { exchangeId?: unknown };
  } catch {
    return badRequest("Некорректный JSON.");
  }
  if (typeof body.exchangeId !== "string" || body.exchangeId.length === 0) {
    return badRequest("Не указан id биржи.");
  }
  try {
    storeResetRiskSettings(body.exchangeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[error] DELETE /api/blotter/risk failed:", err);
    return NextResponse.json(
      { error: "Не удалось сбросить риск-настройки." } satisfies BlotterApiError,
      { status: 500 },
    );
  }
}
