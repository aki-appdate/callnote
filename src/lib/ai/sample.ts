// 「見本の返答」。AIが使えないとき（未設定・無料枠の上限・通信エラー）に使う、ルールベースの整理。
// AIと同じ形（CallInsight / TeamInsight）を返すので、画面側はどちらが動いたかを気にしなくてよい。

import { OBJECTION_LABEL, OUTCOME_LABEL } from "../labels";
import {
  addBusinessDays,
  addDays,
  fromDateKey,
  nextBusinessDayIfWeekend,
  toDateKey,
} from "../dates";
import type {
  CallInsight,
  CallLog,
  CallOutcome,
  Member,
  Objection,
  Temperature,
  TeamInsight,
} from "../types";
import type { TeamStats } from "../kpi";

const OBJECTION_RULES: { objection: Exclude<Objection, "none" | "other">; pattern: RegExp }[] = [
  { objection: "already_have", pattern: /他社|契約中|リース中|入れたばかり|導入済|既に|すでに/ },
  { objection: "price", pattern: /高い|費用|コスト|予算|値段|料金/ },
  { objection: "not_decision_maker", pattern: /決裁|社長|上の者|上長|担当じゃない|担当ではない|分からない|わからない/ },
  { objection: "busy", pattern: /忙し|時間がない|手が離せ|会議中|バタバタ/ },
  { objection: "no_need", pattern: /必要ない|いらない|間に合って|興味ない|不要|結構です/ },
];

const POSITIVE = /前向き|興味|資料|見積|検討|聞きたい|詳しく|比較/;

export function detectObjection(memo: string, outcome: CallOutcome): Objection {
  if (outcome === "appointment") return "none";
  for (const rule of OBJECTION_RULES) {
    if (rule.pattern.test(memo)) return rule.objection;
  }
  return outcome === "rejected" ? "other" : "none";
}

export function detectTemperature(memo: string, outcome: CallOutcome, objection: Objection): Temperature {
  if (outcome === "appointment") return "high";
  if (outcome === "rejected") return "low";
  if (POSITIVE.test(memo)) return outcome === "decision_maker" || outcome === "callback" ? "high" : "mid";
  if (objection === "no_need" || objection === "already_have") return "low";
  return "mid";
}

const WEEKDAY_CHARS = ["日", "月", "火", "水", "木", "金", "土"];

/** メモの中の「来週」「明日」「金曜」「15日」などから日付を読み取る。読めなければnull */
export function parseDateFromMemo(memo: string, now: Date): Date | null {
  const md = memo.match(/(\d{1,2})月(\d{1,2})日/);
  if (md) {
    const d = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  if (/明後日|あさって/.test(memo)) return addDays(now, 2);
  if (/明日/.test(memo)) return addDays(now, 1);
  const wd = memo.match(/(来週)?\s*([月火水木金])曜/);
  if (wd) {
    const target = WEEKDAY_CHARS.indexOf(wd[2]);
    if (wd[1]) return addDays(nextMonday(now), target - 1);
    const diff = (target - now.getDay() + 7) % 7 || 7;
    return addDays(now, diff);
  }
  if (/来週/.test(memo)) return nextMonday(now);
  if (/来月/.test(memo)) return nextBusinessDayIfWeekend(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  if (/月末/.test(memo)) {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return end > now ? end : new Date(now.getFullYear(), now.getMonth() + 2, 0);
  }
  const day = memo.match(/(\d{1,2})日/);
  if (day) {
    const n = Number(day[1]);
    const d = new Date(now.getFullYear(), now.getMonth(), n);
    if (d <= now) d.setMonth(d.getMonth() + 1);
    return d;
  }
  return null;
}

function nextMonday(now: Date): Date {
  return addDays(now, (8 - now.getDay()) % 7 || 7);
}

function defaultNextDate(outcome: CallOutcome, objection: Objection, now: Date): Date | null {
  switch (outcome) {
    case "no_answer":
      return addBusinessDays(now, 1);
    case "gatekeeper":
      return addBusinessDays(now, 2);
    case "decision_maker":
      return addBusinessDays(now, 3);
    case "callback":
      return addBusinessDays(now, 2);
    case "appointment":
      return null;
    case "rejected":
      // 他社契約中なら、契約の見直し時期を狙って3か月後にもう一度
      return objection === "already_have" ? nextBusinessDayIfWeekend(addDays(now, 90)) : null;
  }
}

const TALK_POINTS: Record<Objection, string[]> = {
  none: ["前回の話の続きから入る", "困りごとを1つ具体的に聞く"],
  busy: ["冒頭で「1分だけ」と時間を区切る", "相手の都合の良い時間帯を聞く"],
  no_need: ["今の運用で不便な点がないか、質問から入る", "同業種の事例を1つだけ伝える"],
  already_have: ["今の契約の満了時期を聞く", "見直しの比較材料として資料送付を提案"],
  price: ["月額の総額で比べる提案をする", "今の費用を聞いて削減額を試算する"],
  not_decision_maker: ["決裁者の名前と在席時間を聞く", "決裁者向けの1枚資料を渡せるか確認"],
  other: ["前回断られた理由をもう一度確かめる"],
};

const COACHING: Record<Objection, string> = {
  none: "相手が話してくれた困りごとは、次回の最初に言い換えて返すと信頼につながります。",
  busy: "最初の10秒で用件と所要時間を言い切ると、忙しい相手でも聞いてもらいやすくなります。",
  no_need: "「必要ない」は情報不足のことが多いです。売り込む前に、今の運用を質問で聞きましょう。",
  already_have: "他社契約中は失注ではありません。満了時期を聞けば、次に電話する理由になります。",
  price: "単価ではなく、月々の総額や手間の削減で比べてもらう言い方を試しましょう。",
  not_decision_maker: "受付や担当者を味方にして、決裁者の名前と在席時間を教えてもらいましょう。",
  other: "断りの理由をはっきり聞けると、次の打ち手が決めやすくなります。",
};

export function sampleCallInsight(input: {
  memo: string;
  outcome: CallOutcome;
  now: Date;
}): CallInsight {
  const memo = input.memo.trim();
  const objection = detectObjection(memo, input.outcome);
  const temperature = detectTemperature(memo, input.outcome, objection);
  const parsed = parseDateFromMemo(memo, input.now);
  const next = parsed ?? defaultNextDate(input.outcome, objection, input.now);

  const uncertainties: string[] = [];
  if (memo.length < 10) uncertainties.push("メモが短く、相手の反応までは読み取れません");
  if (!parsed && input.outcome === "callback") uncertainties.push("折り返しの日時がメモにありません");
  if (input.outcome === "rejected" && objection === "other")
    uncertainties.push("断られた理由がメモから分かりません");

  // 結果ラベルと同じことを言っているだけの文（「担当者と話せた」など）は要約から外す
  const sentences = memo
    .split(/[。\n]/)
    .map((x) => x.trim())
    .filter((x) => x && !/^(担当者|.{1,12}さん|.{1,12}様)と話せた$/.test(x));
  const body = sentences.slice(0, 2).join("。");
  const summary = body
    ? `${OUTCOME_LABEL[input.outcome]}。${body.slice(0, 90)}${body.length > 90 ? "…" : "。"}`
    : `${OUTCOME_LABEL[input.outcome]}。`;

  const talkPoints =
    input.outcome === "appointment"
      ? ["訪問前に相手の困りごとを整理しておく", "決裁者の同席をお願いする"]
      : TALK_POINTS[objection];

  return {
    summary,
    temperature,
    objection,
    nextAction: { date: next ? toDateKey(next) : null, talkPoints },
    coachingTip:
      input.outcome === "appointment"
        ? "アポにつながった一言をチームに共有しましょう。"
        : input.outcome === "no_answer"
          ? "時間帯を変えてかけ直すと、つながる確率が上がります。"
          : COACHING[objection],
    uncertainties,
  };
}

export function sampleTeamInsight(stats: TeamStats, logs: CallLog[], members: Member[]): TeamInsight {
  const findings: TeamInsight["findings"] = [];
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "メンバー";

  const withCalls = stats.members.filter((m) => m.calls >= 5);
  const worstGate = [...withCalls].sort((a, b) => b.gatekeeperRate - a.gatekeeperRate)[0];
  if (worstGate && worstGate.gatekeeperRate > stats.team.gatekeeperRate + 0.05) {
    const ev = logs.filter((l) => l.memberId === worstGate.memberId && l.outcome === "gatekeeper").slice(0, 3);
    if (ev.length) {
      findings.push({
        title: `${name(worstGate.memberId)}さんが受付で止まりがち`,
        detail: `受付で止まった割合が${pct(worstGate.gatekeeperRate)}で、チーム平均（${pct(stats.team.gatekeeperRate)}）より高めです。最初の名乗りと用件の伝え方に原因がありそうです。`,
        evidenceLogIds: ev.map((l) => l.id),
      });
    }
  }

  const topObjection = Object.entries(stats.objections)
    .filter(([k]) => k !== "none")
    .sort((a, b) => b[1] - a[1])[0];
  if (topObjection && topObjection[1] > 0) {
    const key = topObjection[0] as Objection;
    const ev = logs.filter((l) => l.insight?.objection === key).slice(0, 3);
    if (ev.length) {
      findings.push({
        title: `一番多い断りは「${OBJECTION_LABEL[key]}」`,
        detail: `断りのうち${topObjection[1]}件がこの理由です。${COACHING[key]}`,
        evidenceLogIds: ev.map((l) => l.id),
      });
    }
  }

  const best = [...withCalls].filter((m) => m.appointments >= 2).sort((a, b) => b.appointmentRate - a.appointmentRate)[0];
  if (best) {
    const ev = logs.filter((l) => l.memberId === best.memberId && l.outcome === "appointment").slice(0, 3);
    if (ev.length) {
      findings.push({
        title: `${name(best.memberId)}さんのアポ率が高い`,
        detail: `アポ率${pct(best.appointmentRate)}でチームトップです。アポにつながった電話の流れを共有する価値があります。`,
        evidenceLogIds: ev.map((l) => l.id),
      });
    }
  }

  if (!findings.length && logs[0]) {
    findings.push({
      title: "まだ傾向を出すには記録が少なめです",
      detail: "架電記録が増えると、メンバーごとの傾向が見えてきます。",
      evidenceLogIds: [logs[0].id],
    });
  }

  const actions: string[] = [];
  if (worstGate) actions.push(`${name(worstGate.memberId)}さんと受付突破のトークを10分ロープレする`);
  if (best) actions.push(`朝会で${name(best.memberId)}さんのアポ獲得トークを共有してもらう`);
  if (stats.overdueFollowups > 0) actions.push(`予定日を過ぎたフォロー${stats.overdueFollowups}件を、担当者と今日中に整理する`);
  if (!actions.length) actions.push("架電の記録を続けて、来週もう一度傾向を見る");

  return {
    headline:
      stats.team.appointmentRate >= 0.04
        ? "アポ率は安定。受付突破に伸びしろあり"
        : "接続はできているが、アポにつながる一押しが課題",
    findings: findings.slice(0, 3),
    actions: actions.slice(0, 3),
  };
}

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

/** テスト・画面用：YYYY-MM-DD が今日より後か */
export function isFutureKey(key: string, now: Date): boolean {
  return fromDateKey(key) > now;
}
