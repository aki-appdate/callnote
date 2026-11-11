import { describe, expect, it } from "vitest";
import { addDays, startOfDay, toDateKey } from "./dates";
import { computeTeamStats } from "./kpi";
import { applyLogToLead, createSeedData, LEAD_COUNT } from "./seed";
import { mergeWorkspace } from "./store/types";
import type { CallInsight, CallLog, Lead } from "./types";

const NOW = new Date(2026, 10, 11, 17, 0);

function log(partial: Partial<CallLog>): CallLog {
  return {
    id: "x",
    leadId: "lead-0001",
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

  it("断りの理由は、担当者と話せた・お断りの記録だけ数える（受付止まりの記録は数えない）", () => {
    const { members, leads } = createSeedData(NOW);
    const insight = (objection: CallInsight["objection"]): CallInsight => ({
      summary: "x",
      temperature: "mid",
      objection,
      nextAction: { date: null, talkPoints: [] },
      coachingTip: "",
      uncertainties: [],
    });
    const logs = [
      log({ id: "a", outcome: "gatekeeper", insight: insight("not_decision_maker") }),
      log({ id: "b", outcome: "callback", insight: insight("busy") }),
      log({ id: "c", outcome: "decision_maker", insight: insight("not_decision_maker") }),
      log({ id: "d", outcome: "rejected", insight: insight("no_need") }),
    ];
    const s = computeTeamStats({ logs, members, leads, from: startOfDay(NOW), to: addDays(startOfDay(NOW), 1), now: NOW });
    expect(s.objections.not_decision_maker).toBe(1);
    expect(s.objections.busy).toBe(0);
    expect(s.objections.no_need).toBe(1);
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

describe("デモデータの数字が現場らしい", () => {
  const d = createSeedData(NOW);
  const from = addDays(startOfDay(NOW), -13);
  const to = addDays(startOfDay(NOW), 1);
  const s = computeTeamStats({ ...d, from, to, now: NOW });
  const workDays = s.daily.filter((x) => x.calls > 0).length;

  it("1人1日40〜60件かけ、担当者接続率15〜25%、アポ率2〜4%、アポは1人1日1〜2件", () => {
    const perPersonDay = s.team.calls / workDays / 4;
    expect(perPersonDay).toBeGreaterThanOrEqual(40);
    expect(perPersonDay).toBeLessThanOrEqual(60);
    expect(s.team.connectRate).toBeGreaterThanOrEqual(0.15);
    expect(s.team.connectRate).toBeLessThanOrEqual(0.25);
    expect(s.team.appointmentRate).toBeGreaterThanOrEqual(0.02);
    expect(s.team.appointmentRate).toBeLessThanOrEqual(0.04);
    const apptPerPersonDay = s.team.appointments / workDays / 4;
    expect(apptPerPersonDay).toBeGreaterThanOrEqual(1);
    expect(apptPerPersonDay).toBeLessThanOrEqual(2);
  });

  it("案件は2,500社以上・社名と電話番号に重複なし", () => {
    expect(d.leads.length).toBe(LEAD_COUNT);
    expect(LEAD_COUNT).toBeGreaterThanOrEqual(2500);
    expect(new Set(d.leads.map((l) => l.company.replace("株式会社", ""))).size).toBe(d.leads.length);
    expect(new Set(d.leads.map((l) => l.phone)).size).toBe(d.leads.length);
  });

  it("2週間かけてもリストが尽きず、全員に今日かける案件がある", () => {
    const today = toDateKey(NOW);
    for (const m of d.members.filter((x) => x.role === "member")) {
      const due = d.leads.filter(
        (l) =>
          l.assigneeId === m.id &&
          (l.status === "new" || l.status === "calling" || l.status === "followup") &&
          (l.nextCallAt === null || toDateKey(new Date(l.nextCallAt)) <= today),
      );
      expect(due.length).toBeGreaterThan(0);
      expect(d.leads.filter((l) => l.assigneeId === m.id && l.status === "new").length).toBeGreaterThan(100);
    }
  });

  it("N日後に開いても、予定日を過ぎたフォローはほぼ同じ件数（数日で膨らまない）", () => {
    const counts = [0, 1, 2, 7, 14, 30]
      .map((n) => addDays(NOW, n))
      .filter((day) => day.getDay() !== 0 && day.getDay() !== 6)
      .map((day) => {
        const x = createSeedData(day);
        return computeTeamStats({ ...x, from: startOfDay(day), to: addDays(startOfDay(day), 1), now: day }).overdueFollowups;
      });
    for (const c of counts) {
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThanOrEqual(30);
    }
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(15);
  });
});

describe("applyLogToLead", () => {
  const at = new Date(2026, 10, 13, 15, 0); // 金曜
  const lead = (): Lead => ({ ...createSeedData(NOW).leads[0], status: "calling", nextCallAt: null });
  const insight = (date: string | null): CallInsight => ({
    summary: "x",
    temperature: "mid",
    objection: "none",
    nextAction: { date, talkPoints: [] },
    coachingTip: "",
    uncertainties: [],
  });

  it("「次に電話する日」を空欄で保存したら見送り（今日かける一覧から外れる）", () => {
    const l = lead();
    applyLogToLead(l, "decision_maker", insight(null), at);
    expect(l.status).toBe("lost");
    expect(l.nextCallAt).toBeNull();
  });

  it("日付を入れて保存したら、その日の10時にフォロー", () => {
    const l = lead();
    applyLogToLead(l, "decision_maker", insight("2026-11-18"), at);
    expect(l.status).toBe("followup");
    expect(new Date(l.nextCallAt!).getDate()).toBe(18);
    expect(new Date(l.nextCallAt!).getHours()).toBe(10);
  });

  it("AIを使わずに保存したら、結果ごとの標準の間隔（不在なら翌営業日）", () => {
    const l = lead();
    applyLogToLead(l, "no_answer", null, at);
    expect(l.status).toBe("calling");
    expect(toDateKey(new Date(l.nextCallAt!))).toBe("2026-11-16");
    const r = lead();
    applyLogToLead(r, "rejected", null, at);
    expect(r.status).toBe("lost");
  });
});

describe("mergeWorkspace", () => {
  it("追加した記録と案件の変更を重ねる", () => {
    const seed = createSeedData(NOW);
    const added = log({ id: "new-1", at: new Date(2026, 10, 11, 17, 59).toISOString() });
    const merged = mergeWorkspace(seed, [added], [{ id: "lead-0001", status: "appointment", nextCallAt: null }]);
    expect(merged.logs.at(-1)?.id).toBe("new-1");
    expect(merged.leads.find((l) => l.id === "lead-0001")?.status).toBe("appointment");
  });
});
