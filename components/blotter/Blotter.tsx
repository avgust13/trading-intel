"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import { groupFills } from "@/lib/blotter/grouping";
import { computeExchangeSummaries, computeStats } from "@/lib/blotter/stats";
import type { RiskSettings } from "@/lib/blotter/risk";
import {
  apiAddExchange,
  apiAddFills,
  apiClearAll,
  apiDeleteExchange,
  apiDeleteFills,
  apiResetRiskSettings,
  apiSaveNote,
  apiSaveRiskSettings,
  apiUpdateExchange,
  fetchBlotterState,
} from "@/lib/blotter/storage";
import type { BlotterState, Exchange, Fill, Trade } from "@/lib/blotter/types";
import type { TzMode } from "@/lib/calendar/datetime";
import { EquityCurve } from "./EquityCurve";
import { ExchangeManager } from "./ExchangeManager";
import { ExchangesPanel } from "./ExchangesPanel";
import { ImportPanel, readImageFile, type PastedImage } from "./ImportPanel";
import { RiskPanel } from "./RiskPanel";
import { RiskSettingsModal } from "./RiskSettingsModal";
import { StatsBar } from "./StatsBar";
import { TradeDetails } from "./TradeDetails";
import { TradesTable } from "./TradesTable";

/** Display timezone for dates/times and the "today" P&L boundary. */
const DISPLAY_TZ: TzMode = "local";

const Page = styled.div`
  max-width: ${({ theme }) => theme.layout.content};
  margin: 0 auto;
  padding: 24px ${({ theme }) => theme.layout.gutter} 64px;
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
`;

const HeaderMain = styled.div`
  flex: 1;
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

const ImportBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 9px 16px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.accent};
  background: ${({ theme }) => `${theme.colors.accent}22`};
  color: ${({ theme }) => theme.colors.accent};
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => `${theme.colors.accent}33`};
  }
`;

const SecondaryBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.fg};
  }
`;

const ClearBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.red};
    border-color: ${({ theme }) => `${theme.colors.red}55`};
  }
`;

const ErrorStrip = styled.div`
  margin-bottom: 14px;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => `${theme.colors.red}55`};
  background: ${({ theme }) => `${theme.colors.red}14`};
  color: ${({ theme }) => theme.colors.fg};
  font-size: 13px;
  line-height: 1.5;
`;

const RetryBtn = styled.button`
  appearance: none;
  cursor: pointer;
  margin-left: 10px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.accent};
  font-size: 12px;
  font-weight: 600;
`;

const LoadingNote = styled.div`
  padding: 48px 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13.5px;
`;

export function Blotter() {
  // null until the first server response arrives.
  const [state, setState] = useState<BlotterState | null>(null);
  const stateRef = useRef<BlotterState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<PastedImage | null>(null);
  const [activeExchangeId, setActiveExchangeId] = useState<string | "all">("all");

  const load = useCallback(() => {
    setLoadError(null);
    fetchBlotterState()
      .then((s) => {
        stateRef.current = s;
        setState(s);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Не удалось загрузить журнал.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Update local state + ref without persisting (used after an awaited call). */
  const applyLocal = useCallback((fn: (s: BlotterState) => BlotterState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      stateRef.current = next;
      return next;
    });
  }, []);

  /**
   * Optimistic mutation: apply locally right away, persist via the API, and
   * roll back to the pre-mutation snapshot if the server call fails.
   */
  const mutate = useCallback(
    (fn: (s: BlotterState) => BlotterState, persist: () => Promise<unknown>) => {
      const snapshot = stateRef.current;
      if (!snapshot) return;
      const next = fn(snapshot);
      stateRef.current = next;
      setState(next);
      setSaveError(null);
      persist().catch((err: unknown) => {
        stateRef.current = snapshot;
        setState(snapshot);
        setSaveError(
          err instanceof Error ? err.message : "Не удалось сохранить изменения на сервере.",
        );
      });
    },
    [],
  );

  const fills = state?.fills;
  const exchanges = useMemo(() => state?.exchanges ?? [], [state]);
  const trades = useMemo(() => (fills ? groupFills(fills) : []), [fills]);
  const breakdown = useMemo(
    () => computeExchangeSummaries(trades, exchanges, DISPLAY_TZ),
    [trades, exchanges],
  );

  const visibleTrades = useMemo(
    () => (activeExchangeId === "all" ? trades : trades.filter((t) => t.exchangeId === activeExchangeId)),
    [trades, activeExchangeId],
  );
  const stats = useMemo(() => computeStats(visibleTrades, DISPLAY_TZ), [visibleTrades]);
  const capital =
    activeExchangeId === "all"
      ? breakdown.total.capital
      : (exchanges.find((e) => e.id === activeExchangeId)?.capital ?? 0);

  const existingIds = useMemo(() => new Set((fills ?? []).map((f) => f.id)), [fills]);
  const exchangeNameOf = useCallback(
    (id: string) => exchanges.find((e) => e.id === id)?.name ?? "—",
    [exchanges],
  );
  const tradeCountByExchange = useCallback(
    (id: string) => trades.filter((t) => t.exchangeId === id).length,
    [trades],
  );
  const selectedTrade: Trade | null = trades.find((t) => t.id === selectedTradeId) ?? null;

  // Drop the filter if its exchange disappears.
  useEffect(() => {
    if (activeExchangeId !== "all" && !exchanges.some((e) => e.id === activeExchangeId)) {
      setActiveExchangeId("all");
    }
  }, [exchanges, activeExchangeId]);

  // Pasting or dropping a screenshot directly on the blotter page opens the
  // import modal with that image.
  useEffect(() => {
    if (importOpen) return;
    const openWith = (file: File) => {
      readImageFile(file, (img) => {
        setPendingImage(img);
        setImportOpen(true);
      });
    };
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) return;
          e.preventDefault();
          openWith(file);
          return;
        }
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files) return;
      const image = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (!image) return;
      e.preventDefault();
      openWith(image);
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [importOpen]);

  const addFills = useCallback(
    (newFills: Fill[]) => {
      mutate(
        (s) => ({ ...s, fills: [...s.fills, ...newFills] }),
        () => apiAddFills(newFills),
      );
      setImportOpen(false);
      setPendingImage(null);
    },
    [mutate],
  );

  const deleteTrade = useCallback(
    (trade: Trade) => {
      if (!window.confirm(`Удалить сделку ${trade.symbol} со всеми её исполнениями?`)) return;
      const ids = new Set([...trade.entries, ...trade.exits].map((f) => f.fillId));
      const hadNote = Boolean(stateRef.current?.tradeNotes[trade.id]);
      mutate(
        (s) => {
          const tradeNotes = { ...s.tradeNotes };
          delete tradeNotes[trade.id];
          return { ...s, fills: s.fills.filter((f) => !ids.has(f.id)), tradeNotes };
        },
        async () => {
          await apiDeleteFills([...ids]);
          if (hadNote) await apiSaveNote(trade.id, "");
        },
      );
      setSelectedTradeId((cur) => (cur === trade.id ? null : cur));
    },
    [mutate],
  );

  const deleteFill = useCallback(
    (fillId: string) => {
      if (!window.confirm("Удалить это исполнение? Сделка будет пересчитана.")) return;
      mutate(
        (s) => ({ ...s, fills: s.fills.filter((f) => f.id !== fillId) }),
        () => apiDeleteFills([fillId]),
      );
    },
    [mutate],
  );

  const saveNote = useCallback(
    (tradeId: string, text: string) => {
      const current = stateRef.current?.tradeNotes[tradeId] ?? "";
      if (current === text) return; // blur without changes — no request
      mutate(
        (s) => {
          const tradeNotes = { ...s.tradeNotes };
          if (text.trim()) tradeNotes[tradeId] = text;
          else delete tradeNotes[tradeId];
          return { ...s, tradeNotes };
        },
        () => apiSaveNote(tradeId, text),
      );
    },
    [mutate],
  );

  const clearAll = useCallback(() => {
    if (!window.confirm("Очистить весь журнал сделок? Биржи и капитал останутся.")) return;
    mutate(
      (s) => ({ ...s, fills: [], tradeNotes: {} }),
      () => apiClearAll(),
    );
    setSelectedTradeId(null);
  }, [mutate]);

  // Exchange CRUD. Add is non-optimistic (the server assigns the id).
  const addExchange = useCallback(
    async (name: string, capitalValue: number) => {
      setSaveError(null);
      try {
        const ex = await apiAddExchange(name, capitalValue);
        applyLocal((s) => ({ ...s, exchanges: [...s.exchanges, ex] }));
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Не удалось создать биржу.");
      }
    },
    [applyLocal],
  );

  const updateExchange = useCallback(
    (id: string, patch: { name?: string; capital?: number }) => {
      mutate(
        (s) => ({
          ...s,
          exchanges: s.exchanges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }),
        () => apiUpdateExchange(id, patch),
      );
    },
    [mutate],
  );

  const deleteExchange = useCallback(
    (ex: Exchange) => {
      const count = tradeCountByExchange(ex.id);
      if (
        !window.confirm(
          `Удалить биржу «${ex.name}»? Будут удалены её сделки (${count}) и капитал. Действие необратимо.`,
        )
      ) {
        return;
      }
      mutate(
        (s) => {
          const removedFillIds = new Set(
            s.fills.filter((f) => f.exchangeId === ex.id).map((f) => f.id),
          );
          const tradeNotes = { ...s.tradeNotes };
          for (const k of Object.keys(tradeNotes)) {
            if (removedFillIds.has(k)) delete tradeNotes[k];
          }
          const riskSettings = { ...(s.riskSettings ?? {}) };
          delete riskSettings[ex.id];
          return {
            ...s,
            exchanges: s.exchanges.filter((e) => e.id !== ex.id),
            fills: s.fills.filter((f) => f.exchangeId !== ex.id),
            tradeNotes,
            riskSettings,
          };
        },
        () => apiDeleteExchange(ex.id),
      );
    },
    [mutate, tradeCountByExchange],
  );

  const saveRiskSettings = useCallback(
    (exchangeId: string, settings: RiskSettings) => {
      mutate(
        (s) => ({ ...s, riskSettings: { ...(s.riskSettings ?? {}), [exchangeId]: settings } }),
        () => apiSaveRiskSettings(exchangeId, settings),
      );
    },
    [mutate],
  );

  const resetRiskSettings = useCallback(
    (exchangeId: string) => {
      mutate(
        (s) => {
          const riskSettings = { ...(s.riskSettings ?? {}) };
          delete riskSettings[exchangeId];
          return { ...s, riskSettings };
        },
        () => apiResetRiskSettings(exchangeId),
      );
    },
    [mutate],
  );

  return (
    <Page>
      <Header>
        <HeaderMain>
          <Title>Журнал сделок</Title>
          <Subtitle>
            Вставьте скриншот или текст ордеров из брокера — AI распознает исполнения и соберёт
            их в сделки.
          </Subtitle>
        </HeaderMain>
        {state && state.fills.length > 0 && (
          <ClearBtn type="button" onClick={clearAll}>
            Очистить журнал
          </ClearBtn>
        )}
        <SecondaryBtn type="button" onClick={() => setManagerOpen(true)}>
          ⚙ Биржи
        </SecondaryBtn>
        <ImportBtn type="button" onClick={() => setImportOpen(true)}>
          + Импорт сделок
        </ImportBtn>
      </Header>

      {saveError && <ErrorStrip>⚠ {saveError}</ErrorStrip>}

      {loadError ? (
        <ErrorStrip>
          ⚠ {loadError}
          <RetryBtn type="button" onClick={load}>
            Повторить
          </RetryBtn>
        </ErrorStrip>
      ) : !state ? (
        <LoadingNote>Загрузка журнала…</LoadingNote>
      ) : (
        <>
          <ExchangesPanel
            breakdown={breakdown}
            activeExchangeId={activeExchangeId}
            onSelect={setActiveExchangeId}
            onManage={() => setManagerOpen(true)}
          />
          <StatsBar stats={stats} capital={capital} />
          <RiskPanel
            activeExchangeId={activeExchangeId}
            exchanges={exchanges}
            trades={trades}
            riskSettings={state.riskSettings}
            onEditSettings={() => setRiskOpen(true)}
          />
          <EquityCurve trades={visibleTrades} capital={capital} />
          <TradesTable
            trades={visibleTrades}
            tz={DISPLAY_TZ}
            showExchange={activeExchangeId === "all" && exchanges.length > 1}
            exchangeName={exchangeNameOf}
            onSelect={setSelectedTradeId}
            onDelete={deleteTrade}
          />
        </>
      )}

      {importOpen && (
        <ImportPanel
          exchanges={exchanges}
          existingIds={existingIds}
          initialImage={pendingImage}
          onAdd={addFills}
          onManageExchanges={() => setManagerOpen(true)}
          onClose={() => {
            setImportOpen(false);
            setPendingImage(null);
          }}
        />
      )}

      {managerOpen && (
        <ExchangeManager
          exchanges={exchanges}
          tradeCountByExchange={tradeCountByExchange}
          onAdd={addExchange}
          onUpdate={updateExchange}
          onDelete={deleteExchange}
          onClose={() => setManagerOpen(false)}
        />
      )}

      {riskOpen && (
        <RiskSettingsModal
          exchanges={exchanges}
          riskSettings={state?.riskSettings}
          initialExchangeId={activeExchangeId === "all" ? null : activeExchangeId}
          onSave={saveRiskSettings}
          onReset={resetRiskSettings}
          onClose={() => setRiskOpen(false)}
        />
      )}

      <TradeDetails
        trade={selectedTrade}
        note={selectedTrade && state ? (state.tradeNotes[selectedTrade.id] ?? "") : ""}
        tz={DISPLAY_TZ}
        exchangeName={selectedTrade ? exchangeNameOf(selectedTrade.exchangeId) : null}
        onClose={() => setSelectedTradeId(null)}
        onSaveNote={saveNote}
        onDeleteFill={deleteFill}
      />
    </Page>
  );
}
