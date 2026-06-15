"use client";

import styled from "styled-components";

// Per-symbol category iconography for the overview table. Each instrument maps
// to a recognizable glyph + an asset-class tint so the row reads at a glance:
// what kind of thing is this (index / semis / biotech / bonds / energy /
// crypto …) before you even read the name. Icons are lucide-style stroke SVGs,
// authored at a 24x24 viewBox and rendered inside a tinted circular badge.

interface IconDef {
  /** SVG path/shape markup (stroke-styled). */
  paths: string;
  /** Asset-class accent color (hex). */
  color: string;
  /** Accessible label / what the glyph represents. */
  label: string;
}

const ICONS: Record<string, IconDef> = {
  // Broad equity benchmark — bar chart with axis.
  SPY: {
    color: "#60a5fa",
    label: "Broad market index",
    paths: '<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-3"/>',
  },
  // Growth / tech-heavy index — trending-up arrow.
  QQQ: {
    color: "#a78bfa",
    label: "Growth / tech index",
    paths: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  },
  // Small caps — sprout.
  IWM: {
    color: "#34d399",
    label: "Small-cap index",
    paths:
      '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  },
  // Semiconductors — chip / CPU.
  SMH: {
    color: "#c084fc",
    label: "Semiconductors",
    paths:
      '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/>',
  },
  // Biotech — conical flask.
  XBI: {
    color: "#f472b6",
    label: "Biotech",
    paths:
      '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>',
  },
  // Industrial blue chips — factory.
  DIA: {
    color: "#38bdf8",
    label: "Blue-chip industrials",
    paths:
      '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h.01"/><path d="M12 18h.01"/><path d="M7 18h.01"/>',
  },
  // Financials — landmark / bank.
  XLF: {
    color: "#22d3ee",
    label: "Financials",
    paths:
      '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  },
  // Long Treasuries — shield (safe haven).
  TLT: {
    color: "#5eead4",
    label: "Government bonds",
    paths: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  },
  // Energy sector — flame.
  XLE: {
    color: "#fbbf24",
    label: "Energy sector",
    paths:
      '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  },
  // Technology sector — circuit board.
  XLK: {
    color: "#818cf8",
    label: "Technology sector",
    paths:
      '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M11 9h4a2 2 0 0 0 2-2V3"/><circle cx="9" cy="9" r="2"/><path d="M7 21v-4a2 2 0 0 1 2-2h4"/><circle cx="15" cy="15" r="2"/>',
  },
  // Crude oil future — droplet.
  "CL1!": {
    color: "#f59e0b",
    label: "Crude oil",
    paths:
      '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  },
  // Bitcoin.
  BTC: {
    color: "#f7931a",
    label: "Bitcoin",
    paths:
      '<path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"/>',
  },
  // Ethereum — diamond.
  ETH: {
    color: "#8b5cf6",
    label: "Ethereum",
    paths: '<path d="M12 2 5 12l7 4 7-4-7-10z"/><path d="M5 13.5 12 22l7-8.5-7 4-7-4z"/>',
  },
};

const Badge = styled.span<{ $color: string }>`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => `${$color}22`};

  svg {
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

export function TickerIcon({ symbol }: { symbol: string }) {
  const icon = ICONS[symbol];
  if (!icon) return null;

  return (
    <Badge $color={icon.color} role="img" aria-label={icon.label} title={icon.label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: icon.paths }} />
    </Badge>
  );
}
