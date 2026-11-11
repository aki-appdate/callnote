"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { aiMode } from "@/lib/ai";
import { applyLogToLead } from "@/lib/seed";
import { createStore } from "@/lib/store";
import type { DataStore } from "@/lib/store/types";
import type { AiSource, CallLog, Lead, Member } from "@/lib/types";

// 画面全体で共有する状態：データ・今だれとして使っているか・保存の操作。

type Ctx = {
  ready: boolean;
  error: string | null;
  members: Member[];
  leads: Lead[];
  logs: CallLog[];
  me: Member | null;
  setMe: (id: string) => void;
  storeKind: DataStore["kind"];
  aiSource: AiSource;
  saveCall: (log: CallLog) => Promise<void>;
  resetDemo: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);
const ME_KEY = "callnote:me";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<DataStore | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [meId, setMeId] = useState<string>("m-1");
  const [source, setSource] = useState<AiSource>("sample");
  const [kind, setKind] = useState<DataStore["kind"]>("local");

  const load = useCallback(async () => {
    const store = storeRef.current ?? createStore();
    storeRef.current = store;
    try {
      const data = await store.load();
      setKind(store.kind);
      setSource(aiMode());
      try {
        const saved = localStorage.getItem(ME_KEY);
        if (saved && data.members.some((m) => m.id === saved)) setMeId(saved);
      } catch {}
      setMembers(data.members);
      setLeads(data.leads);
      setLogs(data.logs);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("データを読み込めませんでした。時間をおいて再読み込みしてください。");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setMe = useCallback((id: string) => {
    setMeId(id);
    try {
      localStorage.setItem(ME_KEY, id);
    } catch {}
  }, []);

  const saveCall = useCallback(
    async (log: CallLog) => {
      const lead = leads.find((l) => l.id === log.leadId);
      if (!lead) return;
      const updated: Lead = { ...lead };
      applyLogToLead(updated, log.outcome, log.insight, new Date(log.at));
      // 先に画面へ反映し、保存に失敗したら元に戻す
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setLogs((prev) => [...prev, log]);
      try {
        await storeRef.current!.saveCall(log, updated);
      } catch (e) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
        setLogs((prev) => prev.filter((l) => l.id !== log.id));
        throw e;
      }
    },
    [leads],
  );

  const resetDemo = useCallback(async () => {
    setReady(false);
    await storeRef.current?.reset();
    await load();
  }, [load]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      error,
      members,
      leads,
      logs,
      me: members.find((m) => m.id === meId) ?? null,
      setMe,
      storeKind: kind,
      aiSource: source,
      saveCall,
      resetDemo,
    }),
    [ready, error, members, leads, logs, meId, setMe, kind, source, saveCall, resetDemo],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp は AppProvider の中で使ってください");
  return ctx;
}
