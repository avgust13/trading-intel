"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";

import {
  DEFAULT_RISK_SETTINGS,
  getRiskSettings,
  type BaseRiskMode,
  type RiskSettings,
} from "@/lib/blotter/risk";
import type { Exchange } from "@/lib/blotter/types";
import { TZ_OPTIONS, type TzMode } from "@/lib/calendar/datetime";

interface Form {
  baseRiskMode: BaseRiskMode;
  baseRiskPerTrade: string;
  maxDailyLoss: string;
  maxWeeklyLoss: string;
  profitRiskScalingEnabled: boolean;
  profitBufferBeforeScaling: string;
  profitRiskSharePct: string;
  maxScaledRiskPerTrade: string;
  maxDailyGivebackPercent: string;
  timezone: TzMode;
}

function toForm(s: RiskSettings): Form {
  return {
    baseRiskMode: s.baseRiskMode,
    baseRiskPerTrade: String(s.baseRiskPerTrade),
    maxDailyLoss: String(s.maxDailyLoss),
    maxWeeklyLoss: String(s.maxWeeklyLoss),
    profitRiskScalingEnabled: s.profitRiskScalingEnabled,
    profitBufferBeforeScaling: String(s.profitBufferBeforeScaling),
    profitRiskSharePct: String(Math.round(s.profitRiskShare * 100)),
    maxScaledRiskPerTrade: String(s.maxScaledRiskPerTrade),
    maxDailyGivebackPercent: String(s.maxDailyGivebackPercent),
    timezone: s.timezone,
  };
}

function parseNum(v: string, fallback: number): number {
  const n = parseFloat(v.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function fromForm(f: Form): RiskSettings {
  const d = DEFAULT_RISK_SETTINGS;
  return {
    maxDailyLoss: Math.max(0, parseNum(f.maxDailyLoss, d.maxDailyLoss)),
    maxWeeklyLoss: Math.max(0, parseNum(f.maxWeeklyLoss, d.maxWeeklyLoss)),
    baseRiskPerTrade: Math.max(0, parseNum(f.baseRiskPerTrade, d.baseRiskPerTrade)),
    baseRiskMode: f.baseRiskMode,
    profitRiskScalingEnabled: f.profitRiskScalingEnabled,
    profitBufferBeforeScaling: Math.max(0, parseNum(f.profitBufferBeforeScaling, d.profitBufferBeforeScaling)),
    profitRiskShare: Math.min(1, Math.max(0, parseNum(f.profitRiskSharePct, d.profitRiskShare * 100) / 100)),
    maxScaledRiskPerTrade: Math.max(0, parseNum(f.maxScaledRiskPerTrade, d.maxScaledRiskPerTrade)),
    maxDailyGivebackPercent: Math.min(100, Math.max(0, parseNum(f.maxDailyGivebackPercent, d.maxDailyGivebackPercent))),
    timezone: f.timezone,
    weekStartsOn: "monday",
  };
}

/* ---------------------------------------------------------------- styles */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 55;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px;
  background: rgba(0, 0, 0, 0.6);
  overflow-y: auto;
`;

const Dialog = styled.div`
  width: 100%;
  max-width: 560px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-top: 3px solid ${({ theme }) => theme.colors.accent};
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.bg};
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h2`
  margin: 0;
  flex: 1;
  color: ${({ theme }) => theme.colors.fg};
  font-size: 18px;
  font-weight: 700;
`;

const CloseBtn = styled.button`
  appearance: none;
  cursor: pointer;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.zebra};
  color: ${({ theme }) => theme.colors.muted};
  font-size: 16px;
  line-height: 1;

  &:hover {
    color: ${({ theme }) => theme.colors.fg};
  }
`;

const Body = styled.div`
  padding: 16px 18px 18px;
`;

const Empty = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
`;

const FieldLabel = styled.label`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
  margin-bottom: 6px;
`;

const Block = styled.div`
  margin-bottom: 14px;
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
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
  padding: ${({ $right }) => ($right ? "0 10px 0 6px" : "0 6px 0 10px")};
  color: ${({ theme }) => theme.colors.muted};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
`;

const Input = styled.input`
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.fg};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  padding: 8px 10px;
  text-align: right;
`;

const Seg = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
`;

const SegBtn = styled.button<{ $active: boolean }>`
  appearance: none;
  cursor: pointer;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.border)};
  background: ${({ theme, $active }) => ($active ? `${theme.colors.accent}22` : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.muted)};
`;

const ToggleRow = styled.button<{ $on: boolean }>`
  appearance: none;
  cursor: pointer;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme, $on }) => ($on ? theme.colors.accent : theme.colors.border)};
  background: ${({ theme, $on }) => ($on ? `${theme.colors.accent}14` : "transparent")};
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;
  font-weight: 600;
`;

const Knob = styled.span<{ $on: boolean }>`
  flex: none;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  position: relative;
  background: ${({ theme, $on }) => ($on ? theme.colors.accent : theme.colors.border)};
  transition: background 120ms ease;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: ${({ $on }) => ($on ? "18px" : "2px")};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: left 120ms ease;
  }
`;

const SectionTitle = styled.div`
  margin: 18px 0 10px;
  color: ${({ theme }) => theme.colors.fg};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const Saved = styled.span`
  color: ${({ theme }) => theme.colors.green};
  font-size: 12.5px;
  font-weight: 600;
`;

const Spacer = styled.div`
  flex: 1;
`;

const ResetBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
  font-weight: 600;

  &:hover {
    color: ${({ theme }) => theme.colors.fg};
  }
`;

const SaveBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 9px 18px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.accent};
  background: ${({ theme }) => `${theme.colors.accent}22`};
  color: ${({ theme }) => theme.colors.accent};
  font-size: 13px;
  font-weight: 700;

  &:hover:not(:disabled) {
    background: ${({ theme }) => `${theme.colors.accent}33`};
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

/* ---------------------------------------------------------------- field helpers */

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Block>
      <FieldLabel>{label}</FieldLabel>
      <InputWrap>
        <Affix>$</Affix>
        <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      </InputWrap>
    </Block>
  );
}

function PercentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Block>
      <FieldLabel>{label}</FieldLabel>
      <InputWrap>
        <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
        <Affix $right>%</Affix>
      </InputWrap>
    </Block>
  );
}

/* ---------------------------------------------------------------- component */

export function RiskSettingsModal({
  exchanges,
  riskSettings,
  initialExchangeId,
  onSave,
  onReset,
  onClose,
}: {
  exchanges: Exchange[];
  riskSettings: Record<string, RiskSettings> | undefined;
  initialExchangeId?: string | null;
  onSave: (exchangeId: string, settings: RiskSettings) => void;
  onReset: (exchangeId: string) => void;
  onClose: () => void;
}) {
  const firstId = initialExchangeId && exchanges.some((e) => e.id === initialExchangeId)
    ? initialExchangeId
    : exchanges[0]?.id ?? "";

  const [selId, setSelId] = useState(firstId);
  const [form, setForm] = useState<Form>(() => toForm(getRiskSettings(riskSettings, firstId)));
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Reload the form whenever the selected exchange (or its stored settings) changes.
  useEffect(() => {
    setForm(toForm(getRiskSettings(riskSettings, selId)));
    setDirty(false);
  }, [selId, riskSettings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setJustSaved(false);
  }

  const selExchange = exchanges.find((e) => e.id === selId) ?? null;

  const save = () => {
    if (!selExchange) return;
    onSave(selExchange.id, fromForm(form));
    setDirty(false);
    setJustSaved(true);
  };

  const reset = () => {
    if (!selExchange) return;
    if (!window.confirm(`Сбросить риск-лимиты «${selExchange.name}» к значениям по умолчанию?`)) return;
    onReset(selExchange.id);
    setForm(toForm(DEFAULT_RISK_SETTINGS));
    setDirty(false);
    setJustSaved(true);
  };

  return (
    <Overlay onClick={onClose} role="dialog" aria-modal="true" aria-label="Риск-лимиты">
      <Dialog onClick={(e) => e.stopPropagation()}>
        <Head>
          <Title>Риск-лимиты</Title>
          <CloseBtn type="button" onClick={onClose} aria-label="Закрыть">
            ✕
          </CloseBtn>
        </Head>
        <Body>
          {exchanges.length === 0 ? (
            <Empty>Сначала добавьте биржу — лимиты задаются на каждую биржу отдельно.</Empty>
          ) : (
            <>
              <Block>
                <FieldLabel>Биржа</FieldLabel>
                <Select value={selId} onChange={(e) => setSelId(e.target.value)}>
                  {exchanges.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </Select>
              </Block>

              <SectionTitle>Лимиты убытка</SectionTitle>
              <TwoCol>
                <MoneyField
                  label="Дневной лимит убытка"
                  value={form.maxDailyLoss}
                  onChange={(v) => update("maxDailyLoss", v)}
                />
                <MoneyField
                  label="Недельный лимит убытка"
                  value={form.maxWeeklyLoss}
                  onChange={(v) => update("maxWeeklyLoss", v)}
                />
              </TwoCol>

              <SectionTitle>Базовый риск на сделку</SectionTitle>
              <Block>
                <FieldLabel>Единица измерения</FieldLabel>
                <Seg>
                  <SegBtn
                    type="button"
                    $active={form.baseRiskMode === "usd"}
                    onClick={() => update("baseRiskMode", "usd")}
                  >
                    USD
                  </SegBtn>
                  <SegBtn
                    type="button"
                    $active={form.baseRiskMode === "pct"}
                    onClick={() => update("baseRiskMode", "pct")}
                  >
                    % капитала
                  </SegBtn>
                </Seg>
              </Block>
              {form.baseRiskMode === "usd" ? (
                <MoneyField
                  label="Базовый риск на сделку"
                  value={form.baseRiskPerTrade}
                  onChange={(v) => update("baseRiskPerTrade", v)}
                />
              ) : (
                <PercentField
                  label="Базовый риск на сделку (% капитала)"
                  value={form.baseRiskPerTrade}
                  onChange={(v) => update("baseRiskPerTrade", v)}
                />
              )}

              <SectionTitle>Увеличение риска при прибыли</SectionTitle>
              <Block>
                <ToggleRow
                  type="button"
                  $on={form.profitRiskScalingEnabled}
                  onClick={() => update("profitRiskScalingEnabled", !form.profitRiskScalingEnabled)}
                >
                  <span>Разрешить увеличение риска из прибыли</span>
                  <Knob $on={form.profitRiskScalingEnabled} />
                </ToggleRow>
              </Block>
              <TwoCol>
                <MoneyField
                  label="Буфер прибыли до увеличения"
                  value={form.profitBufferBeforeScaling}
                  onChange={(v) => update("profitBufferBeforeScaling", v)}
                />
                <PercentField
                  label="Доля прибыли в доп. риск"
                  value={form.profitRiskSharePct}
                  onChange={(v) => update("profitRiskSharePct", v)}
                />
                <MoneyField
                  label="Макс. риск на сделку (после увелич.)"
                  value={form.maxScaledRiskPerTrade}
                  onChange={(v) => update("maxScaledRiskPerTrade", v)}
                />
                <PercentField
                  label="Giveback: макс. возврат прибыли"
                  value={form.maxDailyGivebackPercent}
                  onChange={(v) => update("maxDailyGivebackPercent", v)}
                />
              </TwoCol>

              <SectionTitle>Торговый день</SectionTitle>
              <TwoCol>
                <Block>
                  <FieldLabel>Часовой пояс</FieldLabel>
                  <Select
                    value={form.timezone}
                    onChange={(e) => update("timezone", e.target.value as TzMode)}
                  >
                    {TZ_OPTIONS.map((o) => (
                      <option key={o.mode} value={o.mode}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Block>
                <Block>
                  <FieldLabel>Начало недели</FieldLabel>
                  <Select value="monday" disabled>
                    <option value="monday">Понедельник</option>
                  </Select>
                </Block>
              </TwoCol>

              <Footer>
                <ResetBtn type="button" onClick={reset}>
                  Сбросить к дефолту
                </ResetBtn>
                {justSaved && !dirty && <Saved>✓ Сохранено</Saved>}
                <Spacer />
                <SaveBtn type="button" disabled={!dirty} onClick={save}>
                  Сохранить
                </SaveBtn>
              </Footer>
            </>
          )}
        </Body>
      </Dialog>
    </Overlay>
  );
}
