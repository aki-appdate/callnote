import { describe, expect, it } from "vitest";
import { addDays, startOfDay } from "./dates";
import { computeTeamStats } from "./kpi";
import { createSeedData } from "./seed";
import { mergeWorkspace } from "./store/types";
import type { CallLog } from "./types";

const NOW = new Date(2026, 10, 11, 17, 0);

function log(partial: Partial<CallLog>): CallLog {
  return {
    id: "x",
    leadId: "lead-001",
    memberId: "m-1",
    at: new Date(2026, 10, 11, 10, 0).toISOString(),
    outcome: "no_answer",
    memo: "",
    insight: null,
    aiSource: null,
    editedFields: [],
    ...partial,
  };
}

describe("computeTeamStats", () => {
  it("接続率・アポ率を正しく数える", () => {
    const { members, leads } = createSeedData(NOW);
    const logs = [
      log({ id: "a", outcome: "no_answer" }),
      log({ id: "b", outcome: "gatekeeper" }),
      log({ id: "c", outcome: "decision_maker" }),
      log({ id: "d", outcome: "appointment" }),
    ];
    const s = computeTeamStats({ logs, members, leads, from: startOfDay(NOW), to: addDays(startOfDay(NOW), 1), now: NOW });
    expect(s.team.calls).toBe(4);
    expect(s.team.connects).toBe(2);
    expect(s.team.connectRate).toBe(0.5);
    expect(s.team.appointmentRate).toBe(0.25);
    expect(s.members.find((m) => m.memberId === "m-1")?.calls).toBe(4);
    expect(s.members.find((m) => m.memberId === "m-2")?.calls).toBe(0);
  });

  it("期間外の記録は数えない", () => {
    const { members, leads } = createSeedData(NOW);
    const logs = [log({ at: new Date(2026, 10, 10, 10).toISOString() })];
    const s = computeTeamStats({ logs, members, leads, from: startOfDay(NOW), to: addDays(startOfDay(NOW), 1), now: NOW });
    expect(s.team.calls).toBe(0);
  });
});

describe("createSeedData", () => {
  it("同じ日付なら同じデータになる", () => {
    const a = createSeedData(NOW);
    const b = createSeedData(NOW);
    expect(a.logs.length).toBe(b.logs.length);
    expect(a.logs[10]).toEqual(b.logs[10]);
  });

  it("未来の架電記録は作らない", () => {
    const morning = new Date(2026, 10, 11, 9, 0);
    const d = createSeedData(morning);
    expect(d.logs.every((l) => new Date(l.at) <= morning)).toBe(true);
  });

  it("メンバーのクセがデータに出ている（鈴木さんは受付止まりが多い）", () => {
    const d = createSeedData(NOW);
    const rate = (id: string) => {
      const mine = d.logs.filter((l) => l.memberId === id);
      return mine.filter((l) => l.outcome === "gatekeeper").length / mine.length;
    };
    expect(rate("m-2")).toBeGreaterThan(rate("m-1"));
  });
});

describe("mergeWorkspace", () => {
  it("追加した記録と案件の変更を重ねる", () => {
    const seed = createSeedData(NOW);
    const added = log({ id: "new-1", at: new Date(2026, 10, 11, 17, 59).toISOString() });
    const merged = mergeWorkspace(seed, [added], [{ id: "lead-001", status: "appointment", nextCallAt: null }]);
    expect(merged.logs.at(-1)?.id).toBe("new-1");
    expect(merged.leads.find((l) => l.id === "lead-001")?.status).toBe("appointment");
  });
});
