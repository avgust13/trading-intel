"use client";

// Shared visual primitives for the Market News Calendar feature: color mapping,
// badges and a few layout atoms reused across panels.

import styled from "styled-components";

import {
  CONFIRMATION_LABELS,
  IMPORTANCE_LABELS,
  type Confirmation,
  type Importance,
  type MarketEvent,
  TYPE_LABELS,
} from "@/lib/calendar/types";
import { theme } from "@/lib/theme";

/* --- color mapping (static theme, no provider needed) --- */

/** Marker/border color: category overrides impact (earnings/CB/crypto), else impact. */
export function markerColor(e: Pick<MarketEvent, "type" | "importance">): string {
  if (e.type === "earnings") return theme.event.earnings;
  if (e.type === "central_bank") return theme.event.centralBank;
  if (e.type === "crypto") return theme.event.crypto;
  return importanceColor(e.importance);
}

export function importanceColor(i: Importance): string {
  return i === "high" ? theme.event.high : i === "medium" ? theme.event.medium : theme.event.low;
}

/* --- layout atoms --- */

export const Page = styled.div`
  max-width: ${({ theme }) => theme.layout.content};
  margin: 0 auto;
  padding: 24px ${({ theme }) => theme.layout.gutter} 64px;
`;

export const SectionTitle = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 12px;
`;

export const Panel = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 16px;
  background: ${({ theme }) => theme.colors.zebra};
`;

/* --- badges --- */

const BadgeBase = styled.span<{ $c: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ $c }) => `${$c}1f`};
  border: 1px solid ${({ $c }) => `${$c}66`};
  color: ${({ theme }) => theme.colors.fg};
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
`;

const Dot = styled.span<{ $c: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ $c }) => $c};
`;

export function ImportanceBadge({ importance }: { importance: Importance }) {
  return (
    <BadgeBase $c={importanceColor(importance)}>
      <Dot $c={importanceColor(importance)} />
      {IMPORTANCE_LABELS[importance]}
    </BadgeBase>
  );
}

const NeutralBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
`;

export function TypeBadge({ type }: { type: MarketEvent["type"] }) {
  return <NeutralBadge>{TYPE_LABELS[type]}</NeutralBadge>;
}

const CONFIRMATION_COLOR: Record<Confirmation, string> = {
  confirmed: theme.colors.green,
  estimated: theme.colors.accent,
  tentative: theme.event.medium,
  unknown: theme.colors.muted,
};

export function ConfirmationBadge({ confirmation }: { confirmation: Confirmation }) {
  // Confirmed is the default expectation — only flag the uncertain ones.
  if (confirmation === "confirmed") return null;
  return <BadgeBase $c={CONFIRMATION_COLOR[confirmation]}>{CONFIRMATION_LABELS[confirmation]}</BadgeBase>;
}
