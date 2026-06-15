"use client";

import { useState } from "react";
import styled from "styled-components";

import { Blotter } from "./blotter/Blotter";
import { MarketCalendar } from "./calendar/MarketCalendar";
import { Dashboard } from "./Dashboard";
import { RiskCalculator } from "./RiskCalculator";
import { Sessions } from "./Sessions";

type TabKey = "overview" | "sessions" | "calendar" | "risk" | "blotter";

// Each tab carries a lucide-style stroke glyph (24x24 viewBox), authored the same
// way as the per-symbol icons in components/TickerIcon.tsx. The left rail shows the
// glyph only; the human-readable label flies out as a tooltip on hover.
const TABS: { key: TabKey; label: string; icon: string }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: '<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-3"/>',
  },
  {
    key: "sessions",
    label: "Sessions",
    icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  },
  {
    key: "risk",
    label: "Risk",
    icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  },
  {
    key: "blotter",
    label: "Blotter",
    icon: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  },
];

const Shell = styled.div`
  display: flex;
  /* flex-start keeps the sticky rail at its own 100vh height instead of being
     stretched to match the (taller) content column. */
  align-items: flex-start;
`;

const Rail = styled.nav`
  flex: 0 0 56px;
  align-self: flex-start;
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  background: ${({ theme }) => theme.colors.bg};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  /* On very short viewports the icons scroll vertically rather than overflow. */
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tip = styled.span`
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  padding: 4px 9px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.fg};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  z-index: 20;
  transition: opacity 120ms ease;
`;

const TabButton = styled.button<{ $active: boolean }>`
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  appearance: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: ${({ theme, $active }) => ($active ? `${theme.colors.accent}22` : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.muted)};
  transition:
    color 120ms ease,
    background 120ms ease;

  /* Active indicator: a short accent bar on the left edge. Absolutely positioned
     so toggling it never shifts the centered glyph. */
  &::before {
    content: "";
    position: absolute;
    left: -6px;
    top: 9px;
    bottom: 9px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: ${({ theme }) => theme.colors.accent};
    opacity: ${({ $active }) => ($active ? 1 : 0)};
    transition: opacity 120ms ease;
  }

  &:hover {
    color: ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.fg)};
  }

  svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover ${Tip} {
    opacity: 1;
  }
`;

const Main = styled.div`
  flex: 1;
  min-width: 0;
`;

export function Tabs() {
  const [active, setActive] = useState<TabKey>("overview");

  return (
    <Shell>
      <Rail>
        {TABS.map((t) => (
          <TabButton
            key={t.key}
            type="button"
            $active={active === t.key}
            aria-current={active === t.key ? "page" : undefined}
            aria-label={t.label}
            onClick={() => setActive(t.key)}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              dangerouslySetInnerHTML={{ __html: t.icon }}
            />
            <Tip>{t.label}</Tip>
          </TabButton>
        ))}
      </Rail>
      <Main>
        {active === "overview" && <Dashboard />}
        {active === "sessions" && <Sessions />}
        {active === "calendar" && <MarketCalendar />}
        {active === "risk" && <RiskCalculator />}
        {active === "blotter" && <Blotter />}
      </Main>
    </Shell>
  );
}
