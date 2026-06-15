"use client";

import { useMemo } from "react";
import styled from "styled-components";

import { fmtMoney } from "@/lib/blotter/format";
import {
  RISK_MESSAGES,
  computeRiskState,
  getRiskSettings,
  type RiskSettings,
  type RiskState,
  type RiskStatus,
} from "@/lib/blotter/risk";
import type { Exchange, Trade } from "@/lib/blotter/types";

type Tone = "green" | "orange" | "red" | "accent" | "plain";

/** Unsigned USD, e.g. "$46.00" — for risk budgets / capacities (never negative). */
function usd(n: number): string {
  return `$${Math.max(0, n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pnlTone(v: number): Tone {
  if (v > 0.001) return "green";
  if (v < -0.001) return "red";
  return "plain";
}

function statusMeta(s: RiskStatus): { label: string; tone: "green" | "orange" | "red" } {
  switch (s) {
    case "ACTIVE":
      return { label: "ACTIVE", tone: "green" };
    case "WARNING_DAILY_LIMIT_NEAR":
      return { label: "WARNING · DAILY", tone: "orange" };
    case "WARNING_WEEKLY_LIMIT_NEAR":
      return { label: "WARNING · WEEKLY", tone: "orange" };
    case "RISK_LOCKED_DAILY":
      return { label: "LOCKED · DAILY", tone: "red" };
    case "RISK_LOCKED_WEEKLY":
      return { label: "LOCKED · WEEKLY", tone: "red" };
    case "RISK_LOCKED_GIVEBACK":
      return { label: "LOCKED · GIVEBACK", tone: "red" };
  }
}

function bannerMessage(state: RiskState): string {
  if (state.weeklyLossHit) return RISK_MESSAGES.weekly;
  if (state.dailyLossHit) return RISK_MESSAGES.daily;
  if (state.givebackHit) return RISK_MESSAGES.giveback;
  if (state.status === "WARNING_WEEKLY_LIMIT_NEAR")
    return "Использовано ≥80% недельного лимита убытка — торгуйте осторожно.";
  if (state.status === "WARNING_DAILY_LIMIT_NEAR")
    return "Использовано ≥80% дневного лимита убытка — торгуйте осторожно.";
  return "Можно открывать новые сделки.";
}

/* ---------------------------------------------------------------- styles */

const Wrap = styled.div`
  margin-bottom: 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 14px;
  background: ${({ theme }) => theme.colors.zebra};
`;

const Top = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
`;

const Title = styled.div`
  flex: 1;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Badge = styled.span<{ $tone: "green" | "orange" | "red" }>`
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: ${({ theme, $tone }) =>
    $tone === "green" ? theme.colors.green : $tone === "orange" ? theme.event.medium : theme.colors.red};
  border: 1px solid
    ${({ theme, $tone }) =>
      $tone === "green" ? theme.colors.green : $tone === "orange" ? theme.event.medium : theme.colors.red};
  background: ${({ theme, $tone }) =>
    $tone === "green"
      ? `${theme.colors.green}1f`
      : $tone === "orange"
        ? `${theme.event.medium}1f`
        : `${theme.colors.red}1f`};
`;

const EditBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.fg};
  }
`;

const Banner = styled.div<{ $tone: "green" | "orange" | "red" }>`
  padding: 11px 13px;
  border-radius: 10px;
  margin-bottom: 12px;
  border: 1px solid
    ${({ theme, $tone }) =>
      $tone === "green"
        ? `${theme.colors.green}66`
        : $tone === "orange"
          ? `${theme.event.medium}66`
          : `${theme.colors.red}66`};
  background: ${({ theme, $tone }) =>
    $tone === "green"
      ? `${theme.colors.green}14`
      : $tone === "orange"
        ? `${theme.event.medium}14`
        : `${theme.colors.red}14`};
`;

const BannerMsg = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.45;
`;

const BannerSub = styled.div`
  margin-top: 4px;
  color: ${({ theme }) => theme.colors.muted};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12.5px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
`;

const Box = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 8px 10px;
  background: ${({ theme }) => theme.colors.bg};
`;

const BoxLabel = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const BoxValue = styled.div<{ $tone: Tone }>`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme, $tone }) =>
    $tone === "green"
      ? theme.colors.green
      : $tone === "red"
        ? theme.colors.red
        : $tone === "orange"
          ? theme.event.medium
          : $tone === "accent"
            ? theme.colors.accent
            : theme.colors.price};
`;

const Bars = styled.div`
  margin-top: 12px;
  display: grid;
  gap: 10px;
`;

const BarHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11.5px;
`;

const BarHeadVal = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
`;

const Track = styled.div`
  height: 5px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

const Fill = styled.div<{ $pct: number; $tone: "green" | "orange" | "red" }>`
  height: 100%;
  width: ${({ $pct }) => Math.max(0, Math.min(100, $pct))}%;
  background: ${({ theme, $tone }) =>
    $tone === "green" ? theme.colors.green : $tone === "orange" ? theme.event.medium : theme.colors.red};
`;

const Empty = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
`;

/* --- "all" aggregate view --- */

const AllList = styled.div`
  display: grid;
  gap: 6px;
`;

const AllRow = styled.div`
  display: grid;
  grid-template-columns: minmax(90px, 1.3fr) auto 1fr 1fr 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.bg};

  @media (max-width: 640px) {
    grid-template-columns: 1fr auto;
    row-gap: 4px;
  }
`;

const ExName = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;
  font-weight: 700;
`;

const Cell = styled.div<{ $tone?: Tone }>`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12.5px;
  text-align: right;
  color: ${({ theme, $tone }) =>
    $tone === "green"
      ? theme.colors.green
      : $tone === "red"
        ? theme.colors.red
        : $tone === "accent"
          ? theme.colors.accent
          : theme.colors.muted};

  @media (max-width: 640px) {
    text-align: left;
  }
`;

const CellLabel = styled.span`
  color: ${({ theme }) => theme.colors.muted};
  margin-right: 4px;
`;

/* ---------------------------------------------------------------- view */

function Metric({ label, value, tone = "plain" }: { label: string; value: string; tone?: Tone }) {
  return (
    <Box>
      <BoxLabel>{label}</BoxLabel>
      <BoxValue $tone={tone}>{value}</BoxValue>
    </Box>
  );
}

function FullView({ state, scaling }: { state: RiskState; scaling: boolean }) {
  const meta = statusMeta(state.status);
  const dailyUsedPct = state.maxDailyLoss > 0 ? (state.dailyDrawdownUsed / state.maxDailyLoss) * 100 : 0;
  const weeklyUsedPct =
    state.maxWeeklyLoss > 0 ? (state.weeklyDrawdownUsed / state.maxWeeklyLoss) * 100 : 0;
  const dailyBarTone = state.dailyLossHit ? "red" : dailyUsedPct >= 80 ? "orange" : "green";
  const weeklyBarTone = state.weeklyLossHit ? "red" : weeklyUsedPct >= 80 ? "orange" : "green";

  return (
    <>
      <Banner $tone={meta.tone}>
        <BannerMsg>
          {meta.tone === "red" ? "⛔ " : meta.tone === "orange" ? "⚠ " : "✅ "}
          {bannerMessage(state)}
        </BannerMsg>
        <BannerSub>
          Допустимый риск на сделку: {usd(state.allowedRiskPerTrade)}
          {scaling && state.allowedRiskPerTrade > state.baseRiskPerTrade ? " · увеличен из прибыли" : ""}
        </BannerSub>
      </Banner>

      <Grid>
        <Metric label="P&L сегодня" value={fmtMoney(state.totalPnLToday)} tone={pnlTone(state.totalPnLToday)} />
        <Metric label="P&L за неделю" value={fmtMoney(state.totalPnLWeek)} tone={pnlTone(state.totalPnLWeek)} />
        <Metric label="Дневной лимит убытка" value={fmtMoney(-state.maxDailyLoss)} tone="red" />
        <Metric label="Недельный лимит убытка" value={fmtMoney(-state.maxWeeklyLoss)} tone="red" />
        <Metric label="Остаток дневного риска" value={usd(state.remainingDailyRisk)} />
        <Metric label="Остаток недельного риска" value={usd(state.remainingWeeklyRisk)} />
        <Metric label="Риск на сделку" value={usd(state.allowedRiskPerTrade)} tone="accent" />
        <Metric label="Пик за день" value={fmtMoney(state.peakDailyPnL)} tone={pnlTone(state.peakDailyPnL)} />
        <Metric
          label="Giveback-стоп"
          value={state.givebackStopLevel === null ? "—" : fmtMoney(state.givebackStopLevel)}
        />
      </Grid>

      <Bars>
        <div>
          <BarHead>
            <span>Дневной лимит</span>
            <BarHeadVal>
              {usd(state.dailyDrawdownUsed)} / {usd(state.maxDailyLoss)}
            </BarHeadVal>
          </BarHead>
          <Track>
            <Fill $pct={dailyUsedPct} $tone={dailyBarTone} />
          </Track>
        </div>
        <div>
          <BarHead>
            <span>Недельный лимит</span>
            <BarHeadVal>
              {usd(state.weeklyDrawdownUsed)} / {usd(state.maxWeeklyLoss)}
            </BarHeadVal>
          </BarHead>
          <Track>
            <Fill $pct={weeklyUsedPct} $tone={weeklyBarTone} />
          </Track>
        </div>
      </Bars>
    </>
  );
}

export function RiskPanel({
  activeExchangeId,
  exchanges,
  trades,
  riskSettings,
  onEditSettings,
}: {
  activeExchangeId: string | "all";
  exchanges: Exchange[];
  /** All grouped trades (unfiltered); the panel slices per exchange itself. */
  trades: Trade[];
  riskSettings: Record<string, RiskSettings> | undefined;
  onEditSettings: () => void;
}) {
  const active = activeExchangeId === "all" ? null : exchanges.find((e) => e.id === activeExchangeId) ?? null;

  const single = useMemo(() => {
    if (!active) return null;
    const own = trades.filter((t) => t.exchangeId === active.id);
    const settings = getRiskSettings(riskSettings, active.id);
    return { settings, state: computeRiskState(own, settings, active.capital) };
  }, [active, trades, riskSettings]);

  const allRows = useMemo(() => {
    if (activeExchangeId !== "all") return [];
    return exchanges.map((ex) => {
      const own = trades.filter((t) => t.exchangeId === ex.id);
      const settings = getRiskSettings(riskSettings, ex.id);
      return { exchange: ex, state: computeRiskState(own, settings, ex.capital) };
    });
  }, [activeExchangeId, exchanges, trades, riskSettings]);

  if (exchanges.length === 0) return null;

  return (
    <Wrap>
      <Top>
        <Title>Контроль риска</Title>
        {single && <Badge $tone={statusMeta(single.state.status).tone}>{statusMeta(single.state.status).label}</Badge>}
        <EditBtn type="button" onClick={onEditSettings}>
          ⚖ Лимиты риска
        </EditBtn>
      </Top>

      {single ? (
        <FullView state={single.state} scaling={single.state.scalingApplied} />
      ) : allRows.length === 0 ? (
        <Empty>Нет бирж для отображения риск-статуса.</Empty>
      ) : (
        <AllList>
          {allRows.map(({ exchange, state }) => {
            const meta = statusMeta(state.status);
            return (
              <AllRow key={exchange.id}>
                <ExName>{exchange.name}</ExName>
                <Badge $tone={meta.tone}>{meta.label}</Badge>
                <Cell $tone={pnlTone(state.totalPnLToday)}>
                  <CellLabel>день</CellLabel>
                  {fmtMoney(state.totalPnLToday)}
                </Cell>
                <Cell $tone={pnlTone(state.totalPnLWeek)}>
                  <CellLabel>нед.</CellLabel>
                  {fmtMoney(state.totalPnLWeek)}
                </Cell>
                <Cell $tone="accent">
                  <CellLabel>риск</CellLabel>
                  {usd(state.allowedRiskPerTrade)}
                </Cell>
              </AllRow>
            );
          })}
        </AllList>
      )}
    </Wrap>
  );
}
