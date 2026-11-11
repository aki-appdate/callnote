import { describe, expect, it } from "vitest";
import { createSeedData } from "./seed";
import type { Lead } from "./types";
import { buildTodayList, DAILY_CALL_TARGET } from "./worklist";

const NOW = new Date(2026, 10, 11, 11, 0);
const lead = (id: string, status: Lead["status"], nextCallAt: string | null = null): Lead => ({
  id,
  company: id,
  industry: "製造業",
  prefecture: "愛知県",
  employees: 10,
  contactName: null,
  phone: "052-000-0000",
  product: "複合機",
  status,
  assigneeId: "m-1",
  nextCallAt,
});

describe("buildTodayList", () => {
  const fresh = Array.from({ length: 300 }, (_, i) => lead(`new-${i}`, "new"));
  const due = [
    lead("f-2", "followup", new Date(2026, 10, 10, 10).toISOString()),
    lead("f-1", "calling", new Date(2026, 10, 5, 10).toISOString()),
  ];
  const later = lead("f-later", "followup", new Date(2026, 10, 20, 10).toISOString());

  it("フォローは全部、新規は1日の目安の残りだけ並べる", () => {
    const r = buildTodayList([...fresh, ...due, later], NOW, 10);
    expect(r.followups).toBe(2);
    expect(r.remaining).toBe(DAILY_CALL_TARGET - 10);
    expect(r.fresh).toBe(DAILY_CALL_TARGET - 10 - 2);
    expect(r.leads).toHaveLength(r.followups + r.fresh);
    // 予定日の古い順にフォロー、そのあと新規
    expect(r.leads.slice(0, 2).map((l) => l.id)).toEqual(["f-1", "f-2"]);
    expect(r.leads.some((l) => l.id === "f-later")).toBe(false);
  });

  it("目安に届いたら新規は並べない。フォローは目安を超えても全部残す", () => {
    const r = buildTodayList([...fresh, ...due], NOW, 60);
    expect(r.fresh).toBe(0);
    expect(r.leads.map((l) => l.id)).toEqual(["f-1", "f-2"]);
  });

  it("デモデータでも「今日かける」は数百件にならない", () => {
    const seed = createSeedData(NOW);
    const myLeads = seed.leads.filter((l) => l.assigneeId === "m-1");
    const r = buildTodayList(myLeads, NOW, 0);
    expect(r.leads.length).toBeLessThanOrEqual(Math.max(DAILY_CALL_TARGET, r.followups));
  });
});
