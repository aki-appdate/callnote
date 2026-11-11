import { describe, expect, it } from "vitest";
import { callInsightSchema, teamInsightSchema } from "../schemas";
import { addDays, startOfDay, startOfWeek, toDateKey } from "../dates";
import { computeTeamStats, filterLogsByRange } from "../kpi";
import { createSeedData } from "../seed";
import {
  BEST_MIN_APPOINTMENTS,
  BEST_MIN_CALLS,
  clampTalkPoints,
  detectObjection,
  findContractEnd,
  memoHighlights,
  parseDateFromMemo,
  sampleCallInsight,
  sampleTeamInsight,
  TEAM_MIN_CALLS,
} from "./sample";

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

  it("月曜に「来週の水曜」と書いたら、今週ではなく来週の水曜", () => {
    const mon = new Date(2026, 10, 16, 10, 0);
    expect(toDateKey(parseDateFromMemo("来週の水曜にもう一度", mon)!)).toBe("2026-11-25");
    expect(toDateKey(parseDateFromMemo("来週水曜にもう一度", mon)!)).toBe("2026-11-25");
  });

  it("「2〜3日後」は来月の3日ではなく、N日後として読む", () => {
    expect(toDateKey(parseDateFromMemo("2〜3日後にまた電話", WED)!)).toBe("2026-11-13");
    expect(toDateKey(parseDateFromMemo("3日後にかけ直す", WED)!)).toBe("2026-11-16"); // 土曜なので月曜へ
  });

  it("金曜の「明日」は土曜ではなく、次の営業日（月曜）", () => {
    const fri = new Date(2026, 10, 13, 15, 0);
    expect(toDateKey(parseDateFromMemo("明日の午前に折り返し", fri)!)).toBe("2026-11-16");
    expect(toDateKey(parseDateFromMemo("あさってまた電話", fri)!)).toBe("2026-11-16");
  });

  it("今日の日付を「11月13日」と書いたら、来年ではなく今日", () => {
    const fri = new Date(2026, 10, 13, 15, 0);
    expect(toDateKey(parseDateFromMemo("11月13日中に連絡する", fri)!)).toBe("2026-11-13");
    expect(toDateKey(parseDateFromMemo("11月20日に来てほしい", fri)!)).toBe("2026-11-20");
    expect(toDateKey(parseDateFromMemo("11月12日に話した件", fri)!)).toBe("2027-11-12");
  });

  it.each([
    ["満了は来年の3月", "2027-03-01"],
    ["3月末に満了", "2027-03-31"],
    ["来年の3月末", "2027-03-31"],
    ["4月中旬にもう一度", "2027-04-12"], // 4/11 は日曜なので 4/12
    ["12月にまた連絡", "2026-12-01"],
    ["11月末までに返事", "2026-11-30"],
    ["1月に連絡", "2027-01-04"], // 1/1〜1/3 は年始の休み
  ])("月の言い方「%s」→ %s", (memo, expected) => {
    expect(toDateKey(parseDateFromMemo(memo, WED)!)).toBe(expected);
  });

  it("「3か月」「3ヶ月」は月の名前として読まない", () => {
    expect(parseDateFromMemo("3か月ほど様子を見る", WED)).toBeNull();
    expect(parseDateFromMemo("3ヶ月前に入れ替えた", WED)).toBeNull();
  });

  it("相対的な言い方が祝日に当たったら、次の営業日", () => {
    const fri = new Date(2026, 10, 20, 15, 0); // 11/23（月）は勤労感謝の日
    expect(toDateKey(parseDateFromMemo("来週また電話", fri)!)).toBe("2026-11-24");
    expect(toDateKey(parseDateFromMemo("来週月曜にもう一度", fri)!)).toBe("2026-11-24");
    expect(toDateKey(parseDateFromMemo("3日後に", fri)!)).toBe("2026-11-24");
    const dec = new Date(2026, 11, 28, 10, 0);
    expect(toDateKey(parseDateFromMemo("明日の午前に", dec)!)).toBe("2027-01-04");
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
  it("受付止まり・不在・折り返しは、断りの理由にしない", () => {
    expect(detectObjection("担当者は外出中とのこと。戻り時間は分からない", "gatekeeper")).toBe("none");
    expect(detectObjection("受付で用件を聞かれて止められた。決裁は社長で、夕方なら在席", "gatekeeper")).toBe("none");
    expect(detectObjection("担当者が会議中。明日の午前に折り返し", "callback")).toBe("none");
    expect(detectObjection("話し中だった", "no_answer")).toBe("none");
  });
  it("「分からない」だけでは「決裁者ではない」にしない", () => {
    expect(detectObjection("担当者と話せたが、導入時期は分からないとのこと", "decision_maker")).toBe("none");
    expect(detectObjection("事務の方と話せたが、決めるのは社長とのこと", "decision_maker")).toBe("not_decision_maker");
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

  it("満了の時期が書いてあれば、満了日ではなく、満了の2〜3か月前を次回日にする", () => {
    const r = sampleCallInsight({
      memo: "総務の山本さんと話せた。複合機は他社でリース中で、満了は来年の3月。費用は高いと感じているので、比較の見積があれば見たいとのこと",
      outcome: "decision_maker",
      now: WED,
    });
    expect(r.objection).toBe("already_have");
    // 3月末の満了 → 1月の最初の営業日（1/1〜1/3は休み）
    expect(r.nextAction.date).toBe("2027-01-04");
    expect(r.nextAction.talkPoints[0]).toBe("満了の2〜3か月前に比較見積を提案");
    // 満了時期を「聞く」とは言わない（もう分かっているので）
    expect(r.nextAction.talkPoints.join("")).not.toContain("満了時期を聞く");
    expect(r.coachingTip).not.toContain("満了時期を聞けば");
  });

  it("満了が近ければ、すぐに比較見積を出す", () => {
    const r = sampleCallInsight({ memo: "他社でリース中。12月末で満了", outcome: "decision_maker", now: WED });
    expect(r.nextAction.talkPoints[0]).toContain("すぐに比較見積");
    expect(r.nextAction.date).toBe("2026-11-12");
  });

  it("満了に触れていても月が分からなければ、月を確かめる", () => {
    const r = sampleCallInsight({ memo: "他社でリース中で、満了は来年の春とのこと", outcome: "decision_maker", now: WED });
    expect(r.nextAction.talkPoints[0]).toBe("満了の月を確かめる");
    expect(r.uncertainties.some((u) => u.includes("満了の月"))).toBe(true);
  });

  it("受付止まりのメモに満了と書いてあっても、担当者の話としては使わない", () => {
    expect(findContractEnd("満了は来年の3月", WED)?.date && true).toBe(true);
    const r = sampleCallInsight({ memo: "受付の方いわく、満了は来年の3月", outcome: "gatekeeper", now: WED });
    expect(r.nextAction.talkPoints[0]).toContain("在席");
  });

  it("折り返しの日時が無ければ人に確認を求める", () => {
    const r = sampleCallInsight({ memo: "担当者が会議中で折り返し", outcome: "callback", now: WED });
    expect(r.uncertainties).toContain("折り返しの日時がメモにありません");
  });

  it("相手の名前が書いてあれば、要約に残す", () => {
    const r = sampleCallInsight({
      memo: "総務の山本さんと話せた。複合機は他社でリース中で、満了は来年の3月。費用は高いと感じている",
      outcome: "decision_maker",
      now: WED,
    });
    expect(r.summary.startsWith("総務の山本さんと話せた。")).toBe(true);
    expect(r.summary).toContain("他社でリース中");
  });

  it("「担当者と話せた」だけの文は、結果ラベルと重ねない", () => {
    const r = sampleCallInsight({ memo: "担当者と話せた。見積があれば比較したい", outcome: "decision_maker", now: WED });
    expect(r.summary).toBe("担当者と話せた。見積があれば比較したい。");
  });

  it("受付止まりでは、つなぎ方の話をする（断り理由は付けない）", () => {
    const r = sampleCallInsight({ memo: "担当者は外出中とのこと。戻り時間は分からない", outcome: "gatekeeper", now: WED });
    expect(r.objection).toBe("none");
    expect(r.nextAction.talkPoints[0]).toContain("在席");
  });

  it("次回日は土日を避ける", () => {
    const fri = new Date(2026, 10, 13, 15, 0);
    const r = sampleCallInsight({ memo: "不在", outcome: "no_answer", now: fri });
    expect(r.nextAction.date).toBe("2026-11-16");
  });
});

describe("memoHighlights", () => {
  it("判断の決め手になった言葉に線を引き、つなげると元のメモに戻る", () => {
    const memo = "総務の山本さんと話せた。複合機は他社でリース中で、満了は来年の3月。比較の見積があれば見たい";
    const pieces = memoHighlights(memo, "decision_maker");
    expect(pieces.map((p) => p.text).join("")).toBe(memo);
    const marked = pieces.filter((p) => p.mark).map((p) => p.text);
    expect(marked).toContain("満了は来年の3月");
    expect(marked.join("")).toContain("リース中");
    expect(marked.join("")).not.toContain("山本");
  });
});

describe("clampTalkPoints", () => {
  it("3行・1行60文字までに収める", () => {
    const r = clampTalkPoints(["a".repeat(80), "b", "c", "d"]);
    expect(r).toHaveLength(3);
    expect(r[0]).toHaveLength(60);
  });
});

describe("sampleTeamInsight（最初のデモデータ）", () => {
  const NOW = new Date(2026, 10, 11, 17, 0);
  const seed = createSeedData(NOW);
  const name = (id: string) => seed.members.find((m) => m.id === id)!.name;
  const ranges: [string, Date][] = [
    ["今日", startOfDay(NOW)],
    ["今週", startOfWeek(NOW)],
    ["直近2週間", addDays(startOfDay(NOW), -13)],
  ];

  it.each(ranges)("%s：同じ人を「受付で止まりがち」と「アポ率が高い」の両方で挙げない", (_, from) => {
    const to = addDays(startOfDay(NOW), 1);
    const stats = computeTeamStats({ ...seed, from, to, now: NOW });
    const r = sampleTeamInsight(stats, filterLogsByRange(seed.logs, from, to), seed.members);
    expect(teamInsightSchema.safeParse(r).success).toBe(true);

    const gate = r.findings.find((f) => f.title.includes("受付で止まりがち"));
    const best = r.findings.find((f) => f.title.includes("アポ率が高い"));
    for (const m of seed.members) {
      const n = name(m.id);
      expect(Boolean(gate?.title.includes(n) && best?.title.includes(n))).toBe(false);
    }

    // 「アポ率が高い」と言う人は、最低件数を満たしていて、チーム平均より上
    // しかも、件数の足りているメンバーの中で本当に一番（2番手を「高い」と言わない）
    if (best) {
      const s = stats.members.find((m) => best.title.includes(name(m.memberId)))!;
      expect(s.appointments).toBeGreaterThanOrEqual(BEST_MIN_APPOINTMENTS);
      expect(s.appointmentRate).toBeGreaterThan(stats.team.appointmentRate);
      for (const m of stats.members.filter((x) => x.calls >= BEST_MIN_CALLS)) {
        expect(m.appointmentRate).toBeLessThanOrEqual(s.appointmentRate);
      }
    }

    // 見出しと打ち手に出てくる名前は、気づきに出てくる人だけ
    const mentioned = r.findings.map((f) => f.title).join("");
    for (const m of seed.members) {
      const n = name(m.id);
      if (r.headline.includes(n) || r.actions.some((a) => a.includes(n))) expect(mentioned).toContain(n);
    }
    // 見出しで受付突破を課題と言うなら、その気づきが必ずある
    if (r.headline.includes("受付突破")) expect(gate).toBeDefined();
  });

  it(`記録が少ない（${TEAM_MIN_CALLS}件未満）ときは、結論を出さず「記録が少なめ」と言う`, () => {
    const from = startOfDay(NOW);
    const to = addDays(from, 1);
    const logs = filterLogsByRange(seed.logs, from, to).slice(0, 12);
    const stats = computeTeamStats({ ...seed, logs, from, to, now: NOW });
    const r = sampleTeamInsight(stats, logs, seed.members);
    expect(teamInsightSchema.safeParse(r).success).toBe(true);
    expect(r.headline).toContain("記録が少なめ");
    expect(r.findings).toHaveLength(1);
    for (const m of seed.members) expect(r.headline + r.findings[0].title).not.toContain(name(m.id));
  });

  it("見出しのアポ率の評価は、表示している数字と食い違わない", () => {
    const stats = computeTeamStats({ ...seed, from: startOfDay(NOW), to: addDays(startOfDay(NOW), 1), now: NOW });
    const fake = { ...stats, team: { ...stats.team, calls: 102, appointmentRate: 2 / 102 } };
    const r = sampleTeamInsight(fake, seed.logs.slice(0, 5), seed.members);
    expect(r.headline).toContain("アポ率2%で目安（2%）は達成");
  });

  it("断りの気づきの根拠は、担当者と話せた・お断りの記録だけ", () => {
    const from = addDays(startOfDay(NOW), -13);
    const to = addDays(startOfDay(NOW), 1);
    const logs = filterLogsByRange(seed.logs, from, to);
    const r = sampleTeamInsight(computeTeamStats({ ...seed, from, to, now: NOW }), logs, seed.members);
    const obj = r.findings.find((f) => f.title.includes("断り"));
    expect(obj).toBeDefined();
    const byId = new Map(logs.map((l) => [l.id, l]));
    for (const id of obj!.evidenceLogIds) expect(["decision_maker", "rejected"]).toContain(byId.get(id)!.outcome);
  });

  it("断りの理由が同数で並んだときは、一方を「一番」と言い切らない", () => {
    const from = addDays(startOfDay(NOW), -13);
    const to = addDays(startOfDay(NOW), 1);
    const logs = filterLogsByRange(seed.logs, from, to);
    const stats = computeTeamStats({ ...seed, from, to, now: NOW });
    const [a, b] = (Object.entries(stats.objections) as [keyof typeof stats.objections, number][])
      .filter(([k, v]) => k !== "none" && v > 0)
      .sort((x, y) => y[1] - x[1]);
    const tiedStats = { ...stats, objections: { ...stats.objections, [b[0]]: a[1] } };
    const r = sampleTeamInsight(tiedStats, logs, seed.members);
    const obj = r.findings.find((f) => f.title.includes("断り"));
    expect(obj?.title).toContain("同数で最多");
    expect(obj?.title).not.toContain("一番多い");
  });

  it("どの気づきの根拠にも、同じ文面のメモを並べない", () => {
    const from = addDays(startOfDay(NOW), -13);
    const to = addDays(startOfDay(NOW), 1);
    const logs = filterLogsByRange(seed.logs, from, to);
    const r = sampleTeamInsight(computeTeamStats({ ...seed, from, to, now: NOW }), logs, seed.members);
    const byId = new Map(logs.map((l) => [l.id, l]));
    for (const f of r.findings) {
      const memos = f.evidenceLogIds.map((id) => byId.get(id)!.memo);
      expect(new Set(memos).size).toBe(memos.length);
    }
  });

  it("断りの気づきの根拠に、同じ文面のメモを並べない", () => {
    const from = addDays(startOfDay(NOW), -13);
    const to = addDays(startOfDay(NOW), 1);
    const logs = filterLogsByRange(seed.logs, from, to);
    const r = sampleTeamInsight(computeTeamStats({ ...seed, from, to, now: NOW }), logs, seed.members);
    const obj = r.findings.find((f) => f.title.includes("断り"))!;
    const byId = new Map(logs.map((l) => [l.id, l]));
    const memos = obj.evidenceLogIds.map((id) => byId.get(id)!.memo);
    expect(new Set(memos).size).toBe(memos.length);
  });
});

describe("デモデータ（時刻が進んでも揺れない）", () => {
  it("同じ日のうちに時刻が進んでも、それより前の記録は変わらない", () => {
    const morning = createSeedData(new Date(2026, 10, 11, 10, 0));
    const evening = createSeedData(new Date(2026, 10, 11, 18, 30));
    const cutoff = new Date(2026, 10, 11, 10, 0).getTime();
    const before = (logs: typeof morning.logs) =>
      logs.filter((l) => new Date(l.at).getTime() <= cutoff).map((l) => `${l.id}|${l.at}|${l.outcome}|${l.memo}`).sort();
    expect(before(evening.logs)).toEqual(before(morning.logs));
  });
});
