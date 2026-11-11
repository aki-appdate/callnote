import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, startOfDay } from "../dates";
import { computeTeamStats } from "../kpi";
import { createSeedData } from "../seed";
import type { CallLog } from "../types";
import { LocalStore } from "./local";

// localStorage の代わり（テストはNode上で動くため）
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    keys: () => [...m.keys()],
  };
}

const DAY0 = new Date(2026, 10, 11, 12, 0); // 水曜

function overdueAt(now: Date, data: Awaited<ReturnType<LocalStore["load"]>>) {
  return computeTeamStats({ ...data, from: startOfDay(now), to: addDays(startOfDay(now), 1), now }).overdueFollowups;
}

describe("LocalStore：何日後に開いてもデモデータが古びない", () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("7日後に開いても、予定超過・今日の架電・今日かける案件がほぼ同じ", async () => {
    vi.setSystemTime(DAY0);
    const first = await new LocalStore().load();
    const lead = first.leads.find((l) => l.status === "new" && l.assigneeId === "m-1")!;
    const added: CallLog = {
      id: "log-user-1",
      leadId: lead.id,
      memberId: "m-1",
      at: DAY0.toISOString(),
      outcome: "decision_maker",
      memo: "担当者と話せた",
      insight: null,
      aiSource: null,
      editedFields: [],
    };
    await new LocalStore().saveCall(added, { ...lead, status: "followup", nextCallAt: addDays(DAY0, 1).toISOString() });

    const later = addDays(DAY0, 7);
    vi.setSystemTime(later);
    const reopened = await new LocalStore().load();
    const fresh = createSeedData(later);

    // 予定超過は、その日に新しく作ったデモデータと同じ＋自分が入れた1件だけ
    expect(overdueAt(later, reopened)).toBe(overdueAt(later, fresh) + 1);
    expect(overdueAt(later, reopened)).toBeLessThanOrEqual(overdueAt(DAY0, first) + 15);

    // 今日の架電がある（初日の日付のまま止まっていない）
    const todayCalls = (d: typeof reopened) =>
      computeTeamStats({ ...d, from: startOfDay(later), to: addDays(startOfDay(later), 1), now: later }).team.calls;
    expect(todayCalls(reopened)).toBeGreaterThan(0);

    // 自分の記録は保存した日時のまま残る
    const mine = reopened.logs.find((l) => l.id === "log-user-1")!;
    expect(mine.at).toBe(DAY0.toISOString());
    expect(reopened.leads.find((l) => l.id === lead.id)?.status).toBe("followup");
  });

  it("「お試しを始めた日時」は保存しない", async () => {
    vi.setSystemTime(DAY0);
    const store = new LocalStore();
    await store.load();
    await store.saveCall(
      { id: "x", leadId: "lead-0001", memberId: "m-1", at: DAY0.toISOString(), outcome: "no_answer", memo: "", insight: null, aiSource: null, editedFields: [] },
      { ...(await store.load()).leads[0], status: "calling" },
    );
    const raw = JSON.parse(storage.getItem("callnote:workspace:v2")!);
    expect(Object.keys(raw).sort()).toEqual(["logs", "patches"]);
  });
});
