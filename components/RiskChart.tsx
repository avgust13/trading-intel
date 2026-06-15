"use client";

import {
  CandlestickSeries,
  createChart,
  LineStyle,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesPrimitive,
  type SeriesAttachedParameter,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";

import type { BlotterApiError, CandleInterval, CandlesResponse } from "@/lib/blotter/types";

// How far back to request per interval (kept within Yahoo's per-interval limits;
// fetchCandles pads + clamps 1m to ~7 days server-side).
const SPAN_DAYS: Record<CandleInterval, number> = {
  "1m": 5,
  "5m": 20,
  "15m": 40,
  "1h": 120,
  "1d": 730,
};

const DAY_MS = 86_400_000;

function fmtPrice(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

interface BitmapScope {
  context: CanvasRenderingContext2D;
  bitmapSize: { width: number; height: number };
  verticalPixelRatio: number;
  horizontalPixelRatio: number;
}

interface ZonePrices {
  entry: number | null;
  stop: number | null;
  tp: number | null;
}

/**
 * Translucent full-width risk (entry↔stop) and reward (entry↔TP) bands drawn
 * behind the candles. A lightweight-charts series primitive: paneViews() maps
 * the current prices to y-coordinates and the renderer fills two rectangles.
 */
class RiskZonesPrimitive {
  private series: ISeriesApi<"Candlestick"> | null = null;
  private requestUpdate?: () => void;
  private prices: ZonePrices = { entry: null, stop: null, tp: null };

  constructor(private readonly colors: { risk: string; reward: string }) {}

  attached(p: SeriesAttachedParameter<Time>) {
    this.series = p.series as ISeriesApi<"Candlestick">;
    this.requestUpdate = p.requestUpdate;
  }
  detached() {
    this.series = null;
    this.requestUpdate = undefined;
  }
  setPrices(prices: ZonePrices) {
    this.prices = prices;
    this.requestUpdate?.();
  }
  updateAllViews() {}

  paneViews() {
    const series = this.series;
    if (!series) return [];
    const yOf = (p: number | null) =>
      p != null && Number.isFinite(p) ? series.priceToCoordinate(p) : null;
    const eY = yOf(this.prices.entry);
    const sY = yOf(this.prices.stop);
    const tY = yOf(this.prices.tp);

    const bands: { top: number; bottom: number; color: string }[] = [];
    if (eY != null && sY != null) bands.push({ top: eY, bottom: sY, color: this.colors.risk });
    if (eY != null && tY != null) bands.push({ top: eY, bottom: tY, color: this.colors.reward });

    const renderer = {
      draw: (target: { useBitmapCoordinateSpace(cb: (s: BitmapScope) => void): void }) => {
        target.useBitmapCoordinateSpace((scope) => {
          const ctx = scope.context;
          for (const b of bands) {
            const y1 = Math.min(b.top, b.bottom) * scope.verticalPixelRatio;
            const y2 = Math.max(b.top, b.bottom) * scope.verticalPixelRatio;
            ctx.fillStyle = b.color;
            ctx.fillRect(0, y1, scope.bitmapSize.width, y2 - y1);
          }
        });
      },
    };
    return [{ zOrder: () => "bottom" as const, renderer: () => renderer }];
  }
}

const Box = styled.div`
  position: relative;
  /* Height is driven by the parent via --rc-chart-h (tall in the desktop
     two-pane layout); falls back to a sensible fixed height elsewhere. */
  height: var(--rc-chart-h, 380px);
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.zebra};
`;

const ChartHost = styled.div`
  position: absolute;
  inset: 0;
`;

const Tag = styled.div`
  position: absolute;
  top: 8px;
  left: 10px;
  z-index: 2;
  color: ${({ theme }) => theme.colors.muted};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11px;
`;

const Note = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
`;

export function RiskChart({
  symbol,
  interval,
  entry,
  stop,
  tp,
  onLoaded,
}: {
  symbol: string;
  interval: CandleInterval;
  entry: number | null;
  stop: number | null;
  tp: number | null;
  onLoaded?: (lastClose: number | null) => void;
}) {
  const theme = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const zonesRef = useRef<RiskZonesPrimitive | null>(null);

  const [data, setData] = useState<CandlesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep onLoaded in a ref so it doesn't churn the fetch effect.
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  // Fetch candles when the (committed) symbol or interval changes.
  useEffect(() => {
    const sym = symbol.trim();
    if (sym.length < 1) {
      setData(null);
      setError(null);
      setLoading(false);
      onLoadedRef.current?.(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const to = Date.now();
    const from = to - SPAN_DAYS[interval] * DAY_MS;
    const params = new URLSearchParams({
      symbol: sym,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      interval,
    });
    fetch(`/api/blotter/candles?${params.toString()}`)
      .then(async (res) => {
        const body = (await res.json()) as CandlesResponse | BlotterApiError;
        if (cancelled) return;
        if (!res.ok || "error" in body) {
          setData(null);
          setError("error" in body ? body.error : "График недоступен.");
          onLoadedRef.current?.(null);
        } else {
          setData(body);
          setError(null);
          onLoadedRef.current?.(body.candles.at(-1)?.close ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("График недоступен.");
          onLoadedRef.current?.(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  // Build the chart when candle data (or theme) changes.
  useEffect(() => {
    if (!data || !hostRef.current) return;

    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: theme.colors.muted,
        fontFamily: theme.fonts.sans,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: theme.colors.border },
        horzLines: { color: theme.colors.border },
      },
      rightPriceScale: { borderColor: theme.colors.border },
      timeScale: {
        borderColor: theme.colors.border,
        timeVisible: data.interval !== "1d",
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: theme.colors.green,
      downColor: theme.colors.red,
      wickUpColor: theme.colors.green,
      wickDownColor: theme.colors.red,
      borderVisible: false,
    });
    series.setData(
      data.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const zones = new RiskZonesPrimitive({
      risk: `${theme.colors.red}1f`,
      reward: `${theme.colors.green}1f`,
    });
    series.attachPrimitive(zones as unknown as ISeriesPrimitive<Time>);
    chart.timeScale().fitContent();

    seriesRef.current = series;
    zonesRef.current = zones;

    return () => {
      chart.remove();
      seriesRef.current = null;
      zonesRef.current = null;
    };
  }, [data, theme]);

  // Draw / refresh entry/stop/TP lines + zones when the levels change.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const lines: IPriceLine[] = [];
    const add = (price: number | null, color: string, label: string) => {
      if (price == null || !Number.isFinite(price)) return;
      lines.push(
        series.createPriceLine({
          price,
          color,
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          title: `${label} ${fmtPrice(price)}`,
        }),
      );
    };
    add(entry, theme.colors.accent, "Вход");
    add(stop, theme.colors.red, "Стоп");
    add(tp, theme.colors.green, "Тейк");
    zonesRef.current?.setPrices({ entry, stop, tp });

    return () => {
      for (const l of lines) {
        try {
          series.removePriceLine(l);
        } catch {
          /* chart already torn down */
        }
      }
      zonesRef.current?.setPrices({ entry: null, stop: null, tp: null });
    };
  }, [entry, stop, tp, data, theme]);

  const empty = symbol.trim().length < 1;
  return (
    <Box>
      {data && (
        <Tag>
          {data.symbol} · {data.interval}
        </Tag>
      )}
      <ChartHost ref={hostRef} />
      {empty && <Note>Введите тикер, чтобы загрузить график.</Note>}
      {!empty && loading && <Note>Загрузка графика…</Note>}
      {!empty && error && <Note>{error}</Note>}
    </Box>
  );
}
