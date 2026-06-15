"use client";

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";

/* ----------------------------------------------------------------------------
 * Session data — all times in Georgia time (GET = UTC+4, no daylight saving).
 * Russian notes/hints are from the user's trading brief.
 * -------------------------------------------------------------------------- */

interface SessionInfo {
  key: string;
  name: string;
  ru: string;
  range: string;
  start: number; // hours (0–24)
  end: number; // hours (24 = midnight)
  color: string;
  assets: string;
  notes: string[];
  look: string;
}

const SESSIONS: SessionInfo[] = [
  {
    key: "asia",
    name: "Asia",
    ru: "Азия",
    range: "03:00–12:00",
    start: 3,
    end: 12,
    color: "#22d3ee",
    assets: "JPY · AUD · NZD · азиатские индексы",
    notes: [
      "Движение спокойнее, чем в Европе и США",
      "Хорошо работает range / боковая торговля",
      "Важна для USD/JPY, AUD/USD, NZD/USD",
    ],
    look: "Формируется дневной диапазон — отметь его верх и низ.",
  },
  {
    key: "london",
    name: "London",
    ru: "Лондон",
    range: "11:00–19:30",
    start: 11,
    end: 19.5,
    color: "#60a5fa",
    assets: "EUR · GBP · CHF",
    notes: [
      "Часто начинается сильное движение дня, высокая ликвидность",
      "Пробивает азиатский диапазон",
      "Хорошо видны тренды и ложные пробои",
    ],
    look: "Пробой азиатского диапазона — настоящий breakout или ложный (false breakout).",
  },
  {
    key: "newyork",
    name: "New York",
    ru: "Нью-Йорк",
    range: "17:30–00:00",
    start: 17.5,
    end: 24,
    color: "#f59e0b",
    assets: "USD · индексы США · золото · нефть",
    notes: [
      "Самая сильная волатильность на открытии США",
      "Важные новости: CPI, NFP, FOMC, ставки ФРС",
      "Первые 1–2 часа после открытия NYSE — резкие",
    ],
    look: "Подтверждение или разворот движения Лондона.",
  },
];

interface RowDef {
  key: string;
  name: string;
  range: string;
  start: number;
  end: number;
  color: string;
  overlap?: boolean;
}

const OVERLAP: RowDef = {
  key: "overlap",
  name: "Overlap",
  range: "17:30–19:30",
  start: 17.5,
  end: 19.5,
  color: "#f43f5e",
  overlap: true,
};

const ROWS: RowDef[] = [
  ...SESSIONS.map((s) => ({
    key: s.key,
    name: s.name,
    range: s.range,
    start: s.start,
    end: s.end,
    color: s.color,
  })),
  OVERLAP,
];

const PLAYBOOK: { num: number; color: string; html: { name: string; rest: string } }[] = [
  { num: 1, color: "#22d3ee", html: { name: "Азия", rest: " формирует диапазон — цена ходит в боковике." } },
  { num: 2, color: "#60a5fa", html: { name: "Лондон", rest: " пробивает диапазон — настоящий breakout или ложный пробой." } },
  { num: 3, color: "#f59e0b", html: { name: "Нью-Йорк", rest: " подтверждает или разворачивает — продолжение тренда или резкий reversal." } },
];

const EXAMPLE = [
  "Ночью BTC или EUR/USD ходит между 100 и 105.",
  "На открытии Лондона цена пробивает 105.",
  "Сильный объём и импульс → может начаться тренд.",
  "Быстрый возврат обратно → возможно false breakout.",
];

const ASSETS: { name: string; win: string }[] = [
  { name: "EUR/USD", win: "Лондон + Нью-Йорк" },
  { name: "GBP/USD", win: "Лондон + Нью-Йорк" },
  { name: "USD/JPY", win: "Азия + Нью-Йорк" },
  { name: "Gold · XAU/USD", win: "Лондон + Нью-Йорк" },
  { name: "NASDAQ · S&P 500", win: "Открытие США" },
  { name: "Crypto", win: "24/7, сильнее в США" },
  { name: "Oil", win: "Европа + США" },
];

const KEY_WINDOWS = [
  { time: "11:00–13:00", label: "Старт Лондона — первый пробой азиатского диапазона" },
  { time: "17:30–20:00", label: "Открытие США + overlap — пик волатильности" },
  { time: "после 20:00", label: "Продолжение тренда или затухание движения" },
];

const GRID_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ----------------------------------------------------------------------------
 * Time helpers
 * -------------------------------------------------------------------------- */

function georgiaNow(): Date {
  return new Date(Date.now() + 4 * 3600 * 1000); // UTC+4, no DST
}
function hoursFloat(d: Date): number {
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function pct(h: number): number {
  return (h / 24) * 100;
}
function fmtDur(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function isActive(s: { start: number; end: number }, h: number): boolean {
  return h >= s.start && h < s.end;
}
function nextOpen(h: number): { name: string; inMin: number } {
  let best: { name: string; start: number } | null = null;
  for (const s of SESSIONS) {
    if (s.start > h && (!best || s.start < best.start)) best = { name: s.ru, start: s.start };
  }
  if (!best) {
    const earliest = SESSIONS.reduce((a, b) => (a.start < b.start ? a : b));
    best = { name: earliest.ru, start: earliest.start + 24 };
  }
  return { name: best.name, inMin: Math.round((best.start - h) * 60) };
}

/* ----------------------------------------------------------------------------
 * Styles
 * -------------------------------------------------------------------------- */

const GUTTER = 120;
const PAD_X = 16;
const PAD_TOP = 30;
const ROWS_H = ROWS.length * 46;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

const Page = styled.div`
  max-width: ${({ theme }) => theme.layout.content};
  margin: 0 auto;
  padding: 24px ${({ theme }) => theme.layout.gutter} 64px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
`;

const Title = styled.h1`
  margin: 0;
  color: ${({ theme }) => theme.colors.fg};
  font-size: 22px;
  font-weight: 700;
`;

const Subtitle = styled.div`
  margin-top: 4px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
`;

const Clock = styled.div`
  text-align: right;
`;

const ClockTime = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.02em;
`;

const ClockDate = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
  margin-top: 2px;
`;

const StatusRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 30px;
  margin-bottom: 16px;
`;

const Pill = styled.span<{ $bg: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  background: ${({ $bg }) => `${$bg}1f`};
  border: 1px solid ${({ $bg }) => `${$bg}66`};
  color: ${({ theme }) => theme.colors.fg};
  font-size: 12px;
  font-weight: 600;
`;

const PillMuted = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
  font-weight: 600;
`;

const PillGhost = styled(PillMuted)`
  margin-left: auto;
`;

const PlotScroll = styled.div`
  overflow-x: auto;
`;

const Plot = styled.div`
  position: relative;
  min-width: 580px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: ${PAD_TOP}px ${PAD_X}px 10px;
  background: ${({ theme }) => theme.colors.bg};
`;

const Rows = styled.div`
  position: relative;
  z-index: 1;
`;

const Row = styled.div`
  display: flex;
  align-items: stretch;
  height: 46px;
`;

const Gutter = styled.div`
  width: ${GUTTER}px;
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-right: 12px;
`;

const GName = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;
  font-weight: 700;
`;

const GRange = styled.div`
  margin-top: 2px;
  color: ${({ theme }) => theme.colors.muted};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11px;
`;

const LiveDot = styled.span<{ $c: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ $c }) => $c};
  box-shadow: 0 0 8px ${({ $c }) => $c};
  animation: ${pulse} 1.6s ease-in-out infinite;
`;

const Track = styled.div`
  position: relative;
  flex: 1;
  height: 100%;
`;

const Bar = styled.div<{ $color: string; $active: boolean; $overlap: boolean }>`
  position: absolute;
  top: ${({ $overlap }) => ($overlap ? 15 : 9)}px;
  bottom: ${({ $overlap }) => ($overlap ? 15 : 9)}px;
  border-radius: 6px;
  background: ${({ $color, $active }) => ($active ? $color : `${$color}3d`)};
  box-shadow: ${({ $active, $color }) =>
    $active ? `0 0 0 1px ${$color}, 0 0 14px ${$color}66` : "none"};
  transition:
    background 200ms ease,
    box-shadow 200ms ease;
`;

const Overlay = styled.div`
  position: absolute;
  left: ${PAD_X + GUTTER}px;
  right: ${PAD_X}px;
  top: ${PAD_TOP}px;
  height: ${ROWS_H}px;
  pointer-events: none;
  z-index: 2;
`;

const GridLine = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: ${({ theme }) => theme.colors.border};
  transform: translateX(-0.5px);
`;

const Now = styled.div`
  position: absolute;
  top: 0;
  height: 100%;
  width: 0;
`;

const NowLine = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  transform: translateX(-1px);
  background: ${({ theme }) => theme.colors.fg};
  box-shadow: 0 0 8px rgba(229, 231, 235, 0.5);
`;

const NowDot = styled.div`
  position: absolute;
  top: -5px;
  left: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transform: translateX(-50%);
  background: ${({ theme }) => theme.colors.fg};
  box-shadow: 0 0 10px rgba(229, 231, 235, 0.7);
`;

const NowTag = styled.div`
  position: absolute;
  top: -25px;
  left: 0;
  transform: translateX(-50%);
  padding: 1px 6px;
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.fg};
  color: ${({ theme }) => theme.colors.bg};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
`;

const Axis = styled.div`
  display: flex;
  justify-content: space-between;
  margin-left: ${GUTTER}px;
  margin-top: 6px;
`;

const AxisLabel = styled.span`
  color: ${({ theme }) => theme.colors.muted};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 10px;
`;

/* --- session cards --- */

const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  margin-top: 20px;
`;

const Card = styled.div<{ $c: string; $active: boolean }>`
  border: 1px solid ${({ theme, $active, $c }) => ($active ? $c : theme.colors.border)};
  border-left: 3px solid ${({ $c }) => $c};
  border-radius: 10px;
  padding: 12px 14px;
  background: ${({ theme }) => theme.colors.zebra};
  box-shadow: ${({ $active, $c }) => ($active ? `0 0 16px ${$c}33` : "none")};
`;

const CardHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CardName = styled.span`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 15px;
  font-weight: 700;
`;

const CardEn = styled.span`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
`;

const CardLive = styled.span<{ $c: string }>`
  margin-left: auto;
  color: ${({ $c }) => $c};
  font-size: 11px;
  font-weight: 700;
`;

const CardTime = styled.div`
  margin-top: 2px;
  color: ${({ theme }) => theme.colors.muted};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11px;
`;

const CardAssets = styled.div`
  margin-top: 10px;
  color: ${({ theme }) => theme.colors.fg};
  font-size: 12px;

  b {
    color: ${({ theme }) => theme.colors.muted};
    font-weight: 600;
  }
`;

const NoteList = styled.ul`
  margin: 8px 0 0;
  padding-left: 16px;
  list-style: disc;
`;

const NoteLi = styled.li`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 12.5px;
  line-height: 1.5;
  margin: 2px 0;
`;

const Look = styled.div`
  margin-top: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  background: rgba(96, 165, 250, 0.08);
  border-left: 2px solid ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.fg};
  font-size: 12.5px;
  line-height: 1.45;

  b {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

/* --- overlap callout --- */

const Callout = styled.div<{ $c: string; $active: boolean }>`
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid ${({ $c, $active }) => ($active ? $c : `${$c}66`)};
  border-left: 3px solid ${({ $c }) => $c};
  background: ${({ $c }) => `${$c}14`};
  box-shadow: ${({ $active, $c }) => ($active ? `0 0 16px ${$c}40` : "none")};
`;

const CalloutTitle = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 14px;
  font-weight: 700;
`;

const CalloutText = styled.div`
  margin-top: 6px;
  color: ${({ theme }) => theme.colors.fg};
  font-size: 12.5px;
  line-height: 1.55;
`;

/* --- generic section --- */

const Section = styled.div`
  margin-top: 24px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding-top: 16px;
`;

const SectionTitle = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 12px;
`;

/* --- playbook --- */

const Step = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin: 8px 0;
`;

const StepNum = styled.div<{ $c: string }>`
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: ${({ $c }) => `${$c}22`};
  border: 1px solid ${({ $c }) => $c};
  color: ${({ $c }) => $c};
  font-size: 12px;
  font-weight: 700;
`;

const StepText = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;
  line-height: 1.5;
  padding-top: 2px;

  b {
    font-weight: 700;
  }
`;

const Example = styled.div`
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.zebra};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const ExampleTitle = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 6px;
`;

const ExampleLi = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 12.5px;
  line-height: 1.6;
`;

/* --- assets table --- */

const Assets = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2px 24px;
`;

const AssetRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const AssetName = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;
  font-weight: 600;
`;

const AssetWin = styled.div`
  color: ${({ theme }) => theme.colors.accent};
  font-size: 13px;
  text-align: right;
`;

/* --- key windows + tip --- */

const WindowItem = styled.div`
  display: flex;
  gap: 12px;
  padding: 6px 0;
`;

const WTime = styled.div`
  flex: none;
  width: 110px;
  color: ${({ theme }) => theme.colors.accent};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  font-weight: 600;
`;

const WLabel = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;
`;

const Tip = styled.div`
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid ${({ theme }) => `${theme.colors.accent}55`};
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;
  line-height: 1.55;

  b {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const Note = styled.div`
  margin-top: 12px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
  line-height: 1.5;
`;

/* ----------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------- */

export function Sessions() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(georgiaNow());
    const id = setInterval(() => setNow(georgiaNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = now ? hoursFloat(now) : null;
  const activeSessions = h != null ? SESSIONS.filter((s) => isActive(s, h)) : [];
  const inOverlap = h != null && isActive(OVERLAP, h);
  const next = h != null ? nextOpen(h) : null;

  return (
    <Page>
      <Header>
        <div>
          <Title>Market Sessions</Title>
          <Subtitle>When the major markets are open — Georgia time (GET, UTC+4)</Subtitle>
        </div>
        <Clock>
          <ClockTime>
            {now
              ? `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
              : "––:––:––"}
          </ClockTime>
          <ClockDate>
            {now ? `${WEEKDAYS[now.getUTCDay()]}, ${MONTHS[now.getUTCMonth()]} ${now.getUTCDate()}` : " "}
          </ClockDate>
        </Clock>
      </Header>

      <StatusRow>
        {activeSessions.map((s) => (
          <Pill key={s.key} $bg={s.color}>
            ● {s.ru} — открыта
          </Pill>
        ))}
        {inOverlap && <Pill $bg={OVERLAP.color}>⚡ Overlap — пик волатильности</Pill>}
        {now && activeSessions.length === 0 && <PillMuted>Тихо — между сессиями</PillMuted>}
        {next && (
          <PillGhost>
            Дальше: {next.name} через {fmtDur(next.inMin)}
          </PillGhost>
        )}
      </StatusRow>

      <PlotScroll>
        <Plot>
          <Rows>
            {ROWS.map((s) => {
              const active = h != null && isActive(s, h);
              return (
                <Row key={s.key}>
                  <Gutter>
                    <GName>
                      {s.name}
                      {active && <LiveDot $c={s.color} />}
                    </GName>
                    <GRange>{s.range}</GRange>
                  </Gutter>
                  <Track>
                    <Bar
                      $color={s.color}
                      $active={active}
                      $overlap={Boolean(s.overlap)}
                      style={{ left: `${pct(s.start)}%`, width: `${pct(s.end) - pct(s.start)}%` }}
                    />
                  </Track>
                </Row>
              );
            })}
          </Rows>

          <Overlay>
            {GRID_HOURS.map((gh) => (
              <GridLine key={gh} style={{ left: `${pct(gh)}%` }} />
            ))}
            {now && h != null && (
              <Now style={{ left: `${pct(h)}%` }}>
                <NowTag>{`${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`}</NowTag>
                <NowDot />
                <NowLine />
              </Now>
            )}
          </Overlay>

          <Axis>
            {GRID_HOURS.map((gh) => (
              <AxisLabel key={gh}>{pad(gh % 24)}:00</AxisLabel>
            ))}
          </Axis>
        </Plot>
      </PlotScroll>

      <Cards>
        {SESSIONS.map((s) => {
          const active = h != null && isActive(s, h);
          return (
            <Card key={s.key} $c={s.color} $active={active}>
              <CardHead>
                <CardName>{s.ru}</CardName>
                <CardEn>{s.name}</CardEn>
                {active && <CardLive $c={s.color}>● сейчас</CardLive>}
              </CardHead>
              <CardTime>{s.range} · GET</CardTime>
              <CardAssets>
                <b>Активы:</b> {s.assets}
              </CardAssets>
              <NoteList>
                {s.notes.map((n) => (
                  <NoteLi key={n}>{n}</NoteLi>
                ))}
              </NoteList>
              <Look>
                <b>Что искать:</b> {s.look}
              </Look>
            </Card>
          );
        })}
      </Cards>

      <Callout $c={OVERLAP.color} $active={inOverlap}>
        <CalloutTitle>
          ⚡ Лондон + Нью-Йорк (overlap) · 17:30–19:30{inOverlap ? " · идёт сейчас" : ""}
        </CalloutTitle>
        <CalloutText>
          Одновременно торгуют Европа и США — самая высокая ликвидность дня. Сильные движения по
          EUR/USD, GBP/USD, XAU/USD, NASDAQ, S&amp;P 500; часто breakout или reversal. Один из лучших
          периодов для внутридневной торговли.
        </CalloutText>
      </Callout>

      <Section>
        <SectionTitle>Как торговать</SectionTitle>
        {PLAYBOOK.map((p) => (
          <Step key={p.num}>
            <StepNum $c={p.color}>{p.num}</StepNum>
            <StepText>
              <b>{p.html.name}</b>
              {p.html.rest}
            </StepText>
          </Step>
        ))}
        <Example>
          <ExampleTitle>Пример</ExampleTitle>
          {EXAMPLE.map((e) => (
            <ExampleLi key={e}>• {e}</ExampleLi>
          ))}
        </Example>
      </Section>

      <Section>
        <SectionTitle>Лучшее время по активам</SectionTitle>
        <Assets>
          {ASSETS.map((a) => (
            <AssetRow key={a.name}>
              <AssetName>{a.name}</AssetName>
              <AssetWin>{a.win}</AssetWin>
            </AssetRow>
          ))}
        </Assets>
      </Section>

      <Section>
        <SectionTitle>Ключевые окна (по Грузии)</SectionTitle>
        {KEY_WINDOWS.map((w) => (
          <WindowItem key={w.time}>
            <WTime>{w.time}</WTime>
            <WLabel>{w.label}</WLabel>
          </WindowItem>
        ))}
        <Tip>
          <b>Совет:</b> новичку лучше не торговать весь день — выбери 1–2 окна и наблюдай, как ведёт
          себя цена именно там.
        </Tip>
        <Note>
          Время привязано к Грузии (UTC+4). Лондон и Нью-Йорк смещаются на час относительно Грузии в
          периоды их летнего времени. Акции и форекс не торгуются по выходным; крипта — 24/7.
        </Note>
      </Section>
    </Page>
  );
}
