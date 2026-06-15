"use client";

import styled from "styled-components";

import { cls, fmtChg, fmtPct, fmtPrice } from "@/lib/format";
import { getRuDescription, getTvSymbol } from "@/lib/display";
import type { MarketRow as Row } from "@/lib/types";
import { ChangeCell } from "./ChangeCell";
import { ChartFrame } from "./ChartFrame";
import { TickerIcon } from "./TickerIcon";

const TickerCell = styled.td`
  padding: 14px 12px;
  text-align: left;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.accent};
  width: 300px;
  min-width: 300px;
  max-width: 300px;
  white-space: normal;
  vertical-align: middle;
`;

const TickerHead = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
`;

const TickerLink = styled.a`
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const RuDesc = styled.span`
  display: block;
  margin-top: 6px;
  color: ${({ theme }) => theme.colors.muted};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  white-space: normal;
`;

const PriceCell = styled.td`
  padding: 14px 12px;
  text-align: right;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.fg};
`;

const TodayCell = styled(PriceCell)`
  color: ${({ theme }) => theme.colors.price};
  font-weight: 600;
`;

const ChartCell = styled.td`
  width: 340px;
  min-width: 340px;
  padding: 8px 10px;
  vertical-align: middle;
`;

export function MarketRow({ row }: { row: Row }) {
  const tvSymbol = getTvSymbol(row);
  const tooltip = `${row.name} - ${row.desc}`;

  return (
    <tr>
      <TickerCell>
        <TickerHead>
          <TickerIcon symbol={row.symbol} />
          <TickerLink
            href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
            target="_blank"
            rel="noopener noreferrer"
            title={tooltip}
          >
            {row.symbol}
          </TickerLink>
        </TickerHead>
        <RuDesc>{getRuDescription(row)}</RuDesc>
      </TickerCell>
      <PriceCell>{fmtPrice(row.yest)}</PriceCell>
      <TodayCell>{fmtPrice(row.today)}</TodayCell>
      <ChangeCell $tone={cls(row.chg)}>{fmtChg(row.chg)}</ChangeCell>
      <ChangeCell $tone={cls(row.chg_pct)}>{fmtPct(row.chg_pct)}</ChangeCell>
      <ChangeCell $tone={cls(row.wk_pct)} $bold>
        {fmtPct(row.wk_pct)}
      </ChangeCell>
      <ChangeCell $tone={cls(row.mtd_pct)}>{fmtPct(row.mtd_pct)}</ChangeCell>
      <ChangeCell $tone={cls(row.ytd_pct)}>{fmtPct(row.ytd_pct)}</ChangeCell>
      <ChartCell>
        <ChartFrame row={row} />
      </ChartCell>
    </tr>
  );
}
