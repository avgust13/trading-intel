"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import { groupFills } from "@/lib/blotter/grouping";
import { canOpenTrade, computeRiskState, getRiskSettings, type RiskStatus } from "@/lib/blotter/risk";
import { fetchBlotterState } from "@/lib/blotter/storage";
import type { BlotterState } from "@/lib/blotter/types";

/* ----------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

type Dir = "long" | "short";
type Tone = "fg" | "green" | "red" | "accent";

const RISK_PRESETS = ["0.5", "1", "2", "3"];

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}
function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function units(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const max = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}
function plain(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
function pctStr(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function statusTone(s: RiskStatus): Tone {
  if (s === "ACTIVE") return "green";
  if (s.startsWith("RISK_LOCKED")) return "red";
  return "accent"; // WARNING_*
}

// Remember the last-used exchange + risk % across sessions. Reads/writes are
// guarded so a locked-down localStorage (private mode) silently no-ops.
const LS_EXCHANGE = "rc.exchangeId";
const LS_RISK = "rc.riskPct";
function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, val: string): void {
  try {
    window.localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

const RISK_RULES = [
  "Риск на сделку — 1–2% депозита, не больше.",
  "Цель Reward : Risk ≥ 2 — прибыль минимум вдвое больше риска.",
  "Стоп ставь по структуре рынка (за уровень / свинг), а не «на глаз».",
  "После движения в твою сторону перенеси стоп в безубыток.",
  "Не усредняй убыточную позицию и не двигай стоп против себя.",
];

/* ----------------------------------------------------------------------------
 * Styles
 * -------------------------------------------------------------------------- */

const Page = styled.div`
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 16px 64px;
`;

const Header = styled.div`
  margin-bottom: 18px;
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

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Panel = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 16px;
  background: ${({ theme }) => theme.colors.zebra};
`;

const PanelTitle = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 14px;
`;

const SegRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
`;

const SegBtn = styled.button<{ $active: boolean; $tone: "green" | "red" }>`
  appearance: none;
  cursor: pointer;
  padding: 9px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid
    ${({ theme, $active, $tone }) =>
      $active ? theme.colors[$tone] : theme.colors.border};
  background: ${({ theme, $active, $tone }) =>
    $active ? `${theme.colors[$tone]}22` : "transparent"};
  color: ${({ theme, $active, $tone }) => ($active ? theme.colors[$tone] : theme.colors.muted)};
  transition:
    background 120ms ease,
    color 120ms ease,
    border-color 120ms ease;
`;

const FieldWrap = styled.div`
  margin-bottom: 14px;
`;

const Label = styled.label`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
  margin-bottom: 6px;
`;

const InputWrap = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.bg};
  overflow: hidden;

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const Affix = styled.span<{ $right?: boolean }>`
  padding: ${({ $right }) => ($right ? "0 12px 0 8px" : "0 8px 0 12px")};
  color: ${({ theme }) => theme.colors.muted};
  font-size: 14px;
`;

const Input = styled.input`
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.fg};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 15px;
  padding: 10px 12px;
`;

const Chips = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 8px;
`;

const Chip = styled.button<{ $active: boolean }>`
  appearance: none;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid
    ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.border)};
  background: ${({ theme, $active }) => ($active ? `${theme.colors.accent}1f` : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.fg : theme.colors.muted)};
`;

const Hero = styled.div`
  padding: 14px;
  border-radius: 10px;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid ${({ theme }) => `${theme.colors.accent}55`};
  margin-bottom: 14px;
`;

const HeroLabel = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
`;

const HeroValue = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  margin-top: 2px;
`;

const HeroSub = styled.div`
  color: ${({ theme }) => theme.colors.price};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  margin-top: 4px;
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const StatLabel = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
`;

const StatValue = styled.div<{ $tone?: Tone }>`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  font-weight: 600;
  text-align: right;
  color: ${({ theme, $tone }) =>
    $tone === "green"
      ? theme.colors.green
      : $tone === "red"
        ? theme.colors.red
        : $tone === "accent"
          ? theme.colors.accent
          : theme.colors.fg};
`;

const StatSub = styled.span`
  color: ${({ theme }) => theme.colors.muted};
  font-weight: 400;
  font-size: 12px;
  margin-left: 6px;
`;

const Warn = styled.div`
  margin-top: 12px;
  padding: 8px 11px;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.5);
  color: ${({ theme }) => theme.colors.fg};
  font-size: 12.5px;
  line-height: 1.45;
`;

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
  margin-bottom: 10px;
`;

const TipList = styled.ul`
  margin: 0;
  padding-left: 18px;
  list-style: disc;
`;

const TipLi = styled.li`
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;
  line-height: 1.6;
  margin: 3px 0;
`;

const Footnote = styled.div`
  margin-top: 14px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
  line-height: 1.5;
`;

const GateSelect = styled.select`
  width: 100%;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.fg};
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const GateBanner = styled.div<{ $tone: "green" | "red" | "muted" }>`
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.fg};
  border: 1px solid
    ${({ theme, $tone }) =>
      $tone === "green"
        ? `${theme.colors.green}66`
        : $tone === "red"
          ? `${theme.colors.red}66`
          : theme.colors.border};
  background: ${({ theme, $tone }) =>
    $tone === "green"
      ? `${theme.colors.green}14`
      : $tone === "red"
        ? `${theme.colors.red}14`
        : "transparent"};
`;

const Hint = styled.div`
  margin-top: 6px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11.5px;
  line-height: 1.4;
`;

const LimitChip = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid ${({ theme }) => `${theme.colors.accent}88`};
  background: ${({ theme }) => `${theme.colors.accent}1f`};
  color: ${({ theme }) => theme.colors.accent};

  &:hover {
    background: ${({ theme }) => `${theme.colors.accent}33`};
  }
`;

/* ----------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------- */

export function RiskCalculator() {
  const [dir, setDir] = useState<Dir>("long");
  const [balance, setBalance] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("100");
  const [stop, setStop] = useState("95");
  const [tp, setTp] = useState("110");

  // Risk-limit gate: read the blotter journal (read-only) to check a prospective
  // trade against the selected exchange's daily/weekly/giveback limits.
  const [blotterState, setBlotterState] = useState<BlotterState | null>(null);
  const [selExId, setSelExId] = useState("");
  const initRef = useRef(false);

  useEffect(() => {
    let alive = true;
    fetchBlotterState()
      .then((s) => {
        if (alive) setBlotterState(s);
      })
      .catch((err: unknown) => {
        console.error("[RiskCalculator] failed to load blotter state:", err);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Restore the remembered risk % on mount (read-only — writes happen in changeRisk).
  useEffect(() => {
    const saved = lsGet(LS_RISK);
    if (saved) setRiskPct(saved);
  }, []);

  // One-time init once the journal loads: restore the remembered exchange (or the
  // first one) and seed the balance from its capital.
  useEffect(() => {
    if (!blotterState || initRef.current) return;
    initRef.current = true;
    const saved = lsGet(LS_EXCHANGE);
    // "" = explicitly remembered "Manual"; a known id = that exchange; otherwise
    // (null / stale id) default to the first exchange.
    const candidate =
      saved === ""
        ? ""
        : saved && blotterState.exchanges.some((e) => e.id === saved)
          ? saved
          : (blotterState.exchanges[0]?.id ?? "");
    setSelExId(candidate);
    const ex = blotterState.exchanges.find((e) => e.id === candidate);
    if (ex) setBalance(String(ex.capital));
  }, [blotterState]);

  // If the selected exchange disappears later, fall back to "Manual".
  useEffect(() => {
    if (selExId && blotterState && !blotterState.exchanges.some((e) => e.id === selExId)) {
      setSelExId("");
    }
  }, [blotterState, selExId]);

  const selExchange = blotterState?.exchanges.find((e) => e.id === selExId) ?? null;

  // Pick an exchange: remember it and seed the balance from its capital.
  // "Manual" (id === "") leaves the balance editable as-is.
  const pickExchange = (id: string) => {
    setSelExId(id);
    lsSet(LS_EXCHANGE, id);
    const ex = blotterState?.exchanges.find((e) => e.id === id);
    if (ex) setBalance(String(ex.capital));
  };

  // Change risk % and remember it.
  const changeRisk = (v: string) => {
    setRiskPct(v);
    lsSet(LS_RISK, v);
  };

  const riskState = useMemo(() => {
    if (!blotterState) return null;
    const ex = blotterState.exchanges.find((x) => x.id === selExId);
    if (!ex) return null;
    const exTrades = groupFills(blotterState.fills).filter((tr) => tr.exchangeId === ex.id);
    const settings = getRiskSettings(blotterState.riskSettings, ex.id);
    return computeRiskState(exTrades, settings, ex.capital);
  }, [blotterState, selExId]);

  const bal = num(balance);
  const risk = num(riskPct);
  const e = num(entry);
  const s = num(stop);
  const t = num(tp);

  const stopDist = Math.abs(e - s);
  const valid = bal > 0 && risk > 0 && e > 0 && s > 0 && stopDist > 0;

  const stopPct = valid ? (stopDist / e) * 100 : NaN;
  const riskAmt = bal > 0 && risk > 0 ? bal * (risk / 100) : NaN;
  const size = valid ? riskAmt / stopDist : NaN;
  const notional = valid ? size * e : NaN;
  const leverage = valid && bal > 0 ? notional / bal : NaN;

  const hasTp = t > 0;
  const rewardDist = hasTp ? Math.abs(t - e) : NaN;
  const rr = valid && hasTp ? rewardDist / stopDist : NaN;
  const profit = valid && hasTp ? size * rewardDist : NaN;
  const profitPct = valid && hasTp && bal > 0 ? (profit / bal) * 100 : NaN;

  // The dollars at risk on this trade = the gate's estimatedRisk.
  const gateRisk = Number.isFinite(riskAmt) && riskAmt > 0 ? riskAmt : null;
  const gate = riskState && gateRisk !== null ? canOpenTrade(riskState, gateRisk) : null;

  const warns: string[] = [];
  if (e > 0 && s > 0) {
    if (dir === "long" && s >= e) warns.push("For a long, the stop-loss should be below entry.");
    if (dir === "short" && s <= e) warns.push("For a short, the stop-loss should be above entry.");
  }
  if (hasTp && e > 0) {
    if (dir === "long" && t <= e) warns.push("For a long, take-profit should be above entry.");
    if (dir === "short" && t >= e) warns.push("For a short, take-profit should be below entry.");
  }
  if (risk > 5) warns.push("Risking more than 5% per trade is aggressive.");
  if (Number.isFinite(leverage) && leverage > 20) warns.push("Implied leverage is very high (> 20×).");
  if (
    riskState &&
    riskState.canOpen &&
    Number.isFinite(riskAmt) &&
    riskState.allowedRiskPerTrade > 0 &&
    riskAmt > riskState.allowedRiskPerTrade
  ) {
    warns.push(
      `Риск ${money(riskAmt)} превышает допустимый ${money(riskState.allowedRiskPerTrade)}${selExchange ? ` по бирже ${selExchange.name}` : ""}.`,
    );
  }

  return (
    <Page>
      <Header>
        <Title>Risk Calculator</Title>
        <Subtitle>Position sizing from your account risk and stop-loss</Subtitle>
      </Header>

      <Grid>
        <Panel>
          <PanelTitle>Trade</PanelTitle>

          <SegRow>
            <SegBtn $active={dir === "long"} $tone="green" type="button" onClick={() => setDir("long")}>
              Long
            </SegBtn>
            <SegBtn $active={dir === "short"} $tone="red" type="button" onClick={() => setDir("short")}>
              Short
            </SegBtn>
          </SegRow>

          {blotterState && blotterState.exchanges.length > 0 && (
            <FieldWrap>
              <Label>Биржа (журнал)</Label>
              <GateSelect value={selExId} onChange={(ev) => pickExchange(ev.target.value)}>
                <option value="">Вручную</option>
                {blotterState.exchanges.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </GateSelect>
            </FieldWrap>
          )}

          <FieldWrap>
            <Label>Account balance</Label>
            <InputWrap>
              <Affix>$</Affix>
              <Input inputMode="decimal" value={balance} onChange={(ev) => setBalance(ev.target.value)} placeholder="10000" />
            </InputWrap>
            {selExchange && (
              <Hint>
                из биржи {selExchange.name} (капитал ${selExchange.capital.toLocaleString("en-US")})
              </Hint>
            )}
          </FieldWrap>

          <FieldWrap>
            <Label>Risk per trade</Label>
            <InputWrap>
              <Input inputMode="decimal" value={riskPct} onChange={(ev) => setRiskPct(ev.target.value)} placeholder="1" />
              <Affix $right>%</Affix>
            </InputWrap>
            <Chips>
              {RISK_PRESETS.map((p) => (
                <Chip key={p} $active={riskPct === p} type="button" onClick={() => changeRisk(p)}>
                  {p}%
                </Chip>
              ))}
              {riskState && riskState.allowedRiskPerTrade > 0 && bal > 0 && (
                <LimitChip
                  type="button"
                  title="Подставить допустимый риск из лимитов"
                  onClick={() => changeRisk(((riskState.allowedRiskPerTrade / bal) * 100).toFixed(2))}
                >
                  Лимит {money(riskState.allowedRiskPerTrade)}
                </LimitChip>
              )}
            </Chips>
          </FieldWrap>

          <FieldWrap>
            <Label>Entry price</Label>
            <InputWrap>
              <Input inputMode="decimal" value={entry} onChange={(ev) => setEntry(ev.target.value)} placeholder="100" />
            </InputWrap>
          </FieldWrap>

          <FieldWrap>
            <Label>Stop-loss</Label>
            <InputWrap>
              <Input inputMode="decimal" value={stop} onChange={(ev) => setStop(ev.target.value)} placeholder="95" />
            </InputWrap>
          </FieldWrap>

          <FieldWrap>
            <Label>Take-profit (optional)</Label>
            <InputWrap>
              <Input inputMode="decimal" value={tp} onChange={(ev) => setTp(ev.target.value)} placeholder="110" />
            </InputWrap>
          </FieldWrap>
        </Panel>

        <Panel>
          <PanelTitle>Result</PanelTitle>

          <Hero>
            <HeroLabel>Position size</HeroLabel>
            <HeroValue>{valid ? `${units(size)} units` : "—"}</HeroValue>
            <HeroSub>
              {valid
                ? `≈ ${money(notional)} notional · ${pctStr((notional / bal) * 100)} от баланса`
                : "Enter balance, risk, entry & stop"}
            </HeroSub>
          </Hero>

          <StatRow>
            <StatLabel>Risk amount (max loss)</StatLabel>
            <StatValue $tone="red">{Number.isFinite(riskAmt) ? money(riskAmt) : "—"}</StatValue>
          </StatRow>

          {riskState && (
            <StatRow>
              <StatLabel>Макс. под лимит</StatLabel>
              <StatValue $tone="accent">
                {valid && riskState.allowedRiskPerTrade > 0
                  ? `${units(riskState.allowedRiskPerTrade / stopDist)} units`
                  : "—"}
                {valid && riskState.allowedRiskPerTrade > 0 && (
                  <StatSub>({money(riskState.allowedRiskPerTrade)})</StatSub>
                )}
              </StatValue>
            </StatRow>
          )}

          <StatRow>
            <StatLabel>Stop distance</StatLabel>
            <StatValue>
              {valid ? plain(stopDist) : "—"}
              {valid && <StatSub>({pctStr(stopPct)})</StatSub>}
            </StatValue>
          </StatRow>

          <StatRow>
            <StatLabel>Leverage</StatLabel>
            <StatValue $tone={Number.isFinite(leverage) && leverage > 20 ? "red" : "fg"}>
              {Number.isFinite(leverage) ? `${leverage.toFixed(2)}×` : "—"}
            </StatValue>
          </StatRow>

          <StatRow>
            <StatLabel>Reward : Risk</StatLabel>
            <StatValue $tone="accent">{Number.isFinite(rr) ? `${rr.toFixed(2)}R` : "—"}</StatValue>
          </StatRow>

          <StatRow>
            <StatLabel>Potential profit</StatLabel>
            <StatValue $tone="green">
              {Number.isFinite(profit) ? money(profit) : "—"}
              {Number.isFinite(profitPct) && <StatSub>(+{profitPct.toFixed(2)}%)</StatSub>}
            </StatValue>
          </StatRow>

          {warns.map((w) => (
            <Warn key={w}>⚠ {w}</Warn>
          ))}
        </Panel>
      </Grid>

      {blotterState && blotterState.exchanges.length > 0 && (
        <Section>
          <SectionTitle>Проверка риск-лимитов</SectionTitle>

          {!riskState && (
            <Hint>Выберите биржу в поле «Биржа (журнал)» сверху, чтобы проверить сделку по лимитам.</Hint>
          )}

          {riskState && (
            <>
              <GateBanner $tone={gate ? (gate.allowed ? "green" : "red") : "muted"}>
                {gate
                  ? gate.allowed
                    ? `✅ Можно открыть сделку с риском ${money(gateRisk ?? 0)}`
                    : `⛔ ${gate.reason}`
                  : "Введите баланс, риск, вход и стоп — проверю сделку по лимитам."}
              </GateBanner>

              <StatRow>
                <StatLabel>Risk status</StatLabel>
                <StatValue $tone={statusTone(riskState.status)}>{riskState.status}</StatValue>
              </StatRow>
              <StatRow>
                <StatLabel>Allowed risk per trade</StatLabel>
                <StatValue $tone="accent">{money(riskState.allowedRiskPerTrade)}</StatValue>
              </StatRow>
              <StatRow>
                <StatLabel>Remaining daily risk</StatLabel>
                <StatValue>{money(riskState.remainingDailyRisk)}</StatValue>
              </StatRow>
              <StatRow>
                <StatLabel>Remaining weekly risk</StatLabel>
                <StatValue>{money(riskState.remainingWeeklyRisk)}</StatValue>
              </StatRow>
              <StatRow>
                <StatLabel>P&L сегодня / неделя</StatLabel>
                <StatValue
                  $tone={riskState.totalPnLToday > 0 ? "green" : riskState.totalPnLToday < 0 ? "red" : "fg"}
                >
                  {money(riskState.totalPnLToday)} / {money(riskState.totalPnLWeek)}
                </StatValue>
              </StatRow>
            </>
          )}
        </Section>
      )}

      <Section>
        <SectionTitle>Правила риска</SectionTitle>
        <TipList>
          {RISK_RULES.map((r) => (
            <TipLi key={r}>{r}</TipLi>
          ))}
        </TipList>
        <Footnote>
          Расчёт в «единицах»: считается, что 1 единица даёт $1 P&amp;L на каждый $1 движения цены
          (акции, крипта, спот). Для форекса и фьючерсов масштабируй по стоимости пункта / тика.
        </Footnote>
      </Section>
    </Page>
  );
}
