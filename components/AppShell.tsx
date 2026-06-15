"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styled from "styled-components";

// Primary navigation for the app. Each entry is a route segment, shown in the left
// rail as a lucide-style glyph (authored the same way as components/TickerIcon.tsx);
// the human-readable label flies out as a tooltip on hover. Active state is derived
// from the URL via usePathname so deep-links and browser back/forward stay in sync
// with the highlight.
const NAV: { href: string; label: string; icon: string }[] = [
  {
    href: "/",
    label: "Overview",
    icon: '<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-3"/>',
  },
  {
    href: "/sessions",
    label: "Sessions",
    icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  },
  {
    href: "/risk",
    label: "Risk",
    icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  },
  {
    href: "/blotter",
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

const NavLink = styled(Link)<{ $active: boolean }>`
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  text-decoration: none;
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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <Shell>
      <Rail>
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <NavLink
              key={item.href}
              href={item.href}
              $active={active}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
                dangerouslySetInnerHTML={{ __html: item.icon }}
              />
              <Tip>{item.label}</Tip>
            </NavLink>
          );
        })}
      </Rail>
      <Main>{children}</Main>
    </Shell>
  );
}
