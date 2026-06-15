"use client";

import { useState } from "react";
import styled from "styled-components";

import { Blotter } from "./blotter/Blotter";
import { MarketCalendar } from "./calendar/MarketCalendar";
import { Dashboard } from "./Dashboard";
import { RiskCalculator } from "./RiskCalculator";
import { Sessions } from "./Sessions";

type TabKey = "overview" | "sessions" | "calendar" | "risk" | "blotter";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sessions", label: "Sessions" },
  { key: "calendar", label: "Calendar" },
  { key: "risk", label: "Risk" },
  { key: "blotter", label: "Blotter" },
];

const Bar = styled.nav`
  display: flex;
  align-items: stretch;
  height: 48px;
  padding: 0 8px;
  background: ${({ theme }) => theme.colors.bg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  /* On very narrow screens the tabs scroll horizontally instead of forcing the
     whole page wider. */
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding: 0 14px;
  appearance: none;
  background: none;
  border: none;
  border-bottom: 2px solid
    ${({ theme, $active }) => ($active ? theme.colors.accent : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.fg : theme.colors.muted)};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease;

  &:hover {
    color: ${({ theme }) => theme.colors.fg};
  }
`;

export function Tabs() {
  const [active, setActive] = useState<TabKey>("overview");

  return (
    <>
      <Bar>
        {TABS.map((t) => (
          <TabButton
            key={t.key}
            type="button"
            $active={active === t.key}
            aria-current={active === t.key ? "page" : undefined}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </TabButton>
        ))}
      </Bar>
      {active === "overview" && <Dashboard />}
      {active === "sessions" && <Sessions />}
      {active === "calendar" && <MarketCalendar />}
      {active === "risk" && <RiskCalculator />}
      {active === "blotter" && <Blotter />}
    </>
  );
}
