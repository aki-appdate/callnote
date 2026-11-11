import { describe, expect, it } from "vitest";
import { callInsightSchema } from "../schemas";
import { toDateKey } from "../dates";
import { detectObjection, parseDateFromMemo, sampleCallInsight } from "./sample";

// 2026-11-11 は水曜日
const WED = new Date(2026, 10, 11, 11, 0);

describe("parseDateFromMemo", () => {
  it.each([
    ["明日の午前に折り返し", "2026-11-12"],
    ["来週また電話してほしい", "2026-11-16"],
    ["来週火曜の14時に訪問", "2026-11-17"],
    ["金曜に再度連絡", "2026-11-13"],
    ["月曜に連絡", "2026-11-16"],
    ["12月3日に来てほしい", "2026-12-03"],
    ["20日以降に", "2026-11-20"],
    ["5日以降に", "2026-12-05"],
  ])("「%s」→ %s", (memo, expected) => {
    const d = parseDateFromMemo(memo, WED);
    expect(d && toDateKey(d)).toBe(expected);
  });

  it("日付の言及がなければ null", () => {
    expect(parseDateFromMemo("担当者と話せた", WED)).toBeNull();
  });
});

describe("detectObjection", () => {
  it("他社契約中を見分ける", () => {
    expect(detectObjection("複合機は他社でリース中", "decision_maker")).toBe("already_have");
  });
  it("アポ獲得なら断りなし", () => {
    expect(detectObjection("予算は気になるが前向き", "appointment")).toBe("none");
  });
  it("理由が分からないお断りは other", () => {
    expect(detectObjection("切られた", "rejected")).toBe("other");
  });
});

describe("sampleCallInsight", () => {
  it("AIと同じ形の返答を返す", () => {
    const r = sampleCallInsight({ memo: "担当者と話せた。見積があれば比較したい", outcome: "decision_maker", now: WED });
    expect(callInsightSchema.safeParse(r).success).toBe(true);
    expect(r.temperature).toBe("high");
  });

  it("他社契約中のお断りは約3か月後に再架電", () => {
    const r = sampleCallInsight({ memo: "他社と契約したばかり", outcome: "rejected", now: WED });
    expect(r.objection).toBe("already_have");
    expect(r.nextAction.date).toBe("2027-02-09");
  });

  it("折り返しの日時が無ければ人に確認を求める", () => {
    const r = sampleCallInsight({ memo: "担当者が会議中で折り返し", outcome: "callback", now: WED });
    expect(r.uncertainties).toContain("折り返しの日時がメモにありません");
  });

  it("次回日は土日を避ける", () => {
    const fri = new Date(2026, 10, 13, 15, 0);
    const r = sampleCallInsight({ memo: "不在", outcome: "no_answer", now: fri });
    expect(r.nextAction.date).toBe("2026-11-16");
  });
});
