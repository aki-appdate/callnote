// 「見本の返答」。AIが使えないとき（未設定・無料枠の上限・通信エラー）に使う、ルールベースの整理。
// AIと同じ形（CallInsight / TeamInsight）を返すので、画面側はどちらが動いたかを気にしなくてよい。

import { OBJECTION_LABEL, OBJECTION_OUTCOMES, OUTCOME_LABEL } from "../labels";
import {
  addBusinessDays,
  addDays,
  nextBusinessDayIfWeekend,
  startOfDay,
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
import { countsAsObjection, type TeamStats } from "../kpi";

// 「分からない」のような広すぎる言葉は使わない（受付の「戻り時間は分からない」まで拾ってしまうため）
const OBJECTION_RULES: { objection: Exclude<Objection, "none" | "other">; pattern: RegExp }[] = [
  { objection: "already_have", pattern: /他社|契約中|リース中|入れたばかり|導入済|既に|すでに/ },
  { objection: "price", pattern: /高い|費用|コスト|予算|値段|料金/ },
  { objection: "not_decision_maker", pattern: /決裁|社長|上の者|上長|担当じゃない|担当ではない/ },
  { objection: "busy", pattern: /忙し|時間がない|手が離せ|会議中|バタバタ/ },
  { objection: "no_need", pattern: /必要ない|いらない|間に合って|興味ない|不要|結構です/ },
];

const POSITIVE = /前向き|興味|資料|見積|検討|聞きたい|詳しく|比較/;

/**
 * 断りの理由を読み取る。
 * 断りは「担当者と話せた」「お断り」のときだけ数える。受付止まり・不在・折り返し待ちは、
 * 担当者本人の反応ではないので常に「断りなし」にする（アポ獲得も同じ）。
 */
export function detectObjection(memo: string, outcome: CallOutcome): Objection {
  if (!OBJECTION_OUTCOMES.has(outcome)) return "none";
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

/**
 * メモの中の「来週」「明日」「金曜」「15日」「2〜3日後」などから日付を読み取る。読めなければnull。
 * 「明日」「N日後」のような相対的な言い方で土日に当たったら、次の営業日にずらす。
 * 「11月13日」「20日」のようにはっきり書かれた日は、今日を含めてそのまま使う（過ぎていれば翌年・翌月）。
 */
export function parseDateFromMemo(memo: string, now: Date): Date | null {
  const today = startOfDay(now);
  const md = memo.match(/(\d{1,2})月(\d{1,2})日/);
  if (md) {
    const d = new Date(today.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  // 「2〜3日後」「3日後」：幅があるときは早いほうに合わせる
  const after = memo.match(/(\d{1,2})(?:\s*[〜~～\-ー]\s*\d{1,2})?\s*日後/);
  if (after) return nextBusinessDayIfWeekend(addDays(today, Number(after[1])));
  const weeks = memo.match(/(\d{1,2})\s*週間後/);
  if (weeks) return nextBusinessDayIfWeekend(addDays(today, Number(weeks[1]) * 7));
  if (/明後日|あさって/.test(memo)) return nextBusinessDayIfWeekend(addDays(today, 2));
  if (/明日/.test(memo)) return nextBusinessDayIfWeekend(addDays(today, 1));
  const wd = memo.match(/(来週)?(?:の)?\s*([月火水木金])曜/);
  if (wd) {
    const target = WEEKDAY_CHARS.indexOf(wd[2]);
    if (wd[1]) return addDays(nextMonday(today), target - 1);
    const diff = (target - today.getDay() + 7) % 7 || 7;
    return addDays(today, diff);
  }
  if (/来週/.test(memo)) return nextMonday(today);
  if (/来月/.test(memo)) return nextBusinessDayIfWeekend(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  if (/月末/.test(memo)) {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return end > today ? end : new Date(today.getFullYear(), today.getMonth() + 2, 0);
  }
  const day = memo.match(/(\d{1,2})日/);
  if (day) {
    const n = Number(day[1]);
    const d = new Date(today.getFullYear(), today.getMonth(), n);
    if (d < today) d.setMonth(d.getMonth() + 1);
    return d;
  }
  return null;
}

function nextMonday(today: Date): Date {
  return addDays(today, (8 - today.getDay()) % 7 || 7);
}

/** メモに日付が無いときの次回日。保存時に「AIを使わずに保存」したときも同じ規則を使う */
export function defaultNextDate(outcome: CallOutcome, objection: Objection, now: Date): Date | null {
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

/** 「次に話すこと」の上限。画面の入力欄・AIの返答の両方をこの範囲に収める */
export const TALK_POINT_MAX_LINES = 3;
export const TALK_POINT_MAX_CHARS = 60;

export function clampTalkPoints(lines: string[]): string[] {
  return lines.slice(0, TALK_POINT_MAX_LINES).map((s) => s.slice(0, TALK_POINT_MAX_CHARS));
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

/** 担当者につながる前の結果は、断りの理由ではなく「どうつなぐか」で次の一手を決める */
const OUTCOME_TALK_POINTS: Partial<Record<CallOutcome, string[]>> = {
  no_answer: ["前回と違う時間帯にかける"],
  gatekeeper: ["担当者の名前と在席しやすい時間帯を聞く", "用件を一言で伝えて取り次いでもらう"],
  callback: ["約束した日時ちょうどにかけ直す", "伝言をもらったことを最初に伝える"],
  appointment: ["訪問前に相手の困りごとを整理しておく", "決裁者の同席をお願いする"],
};

const OUTCOME_COACHING: Partial<Record<CallOutcome, string>> = {
  no_answer: "時間帯を変えてかけ直すと、つながる確率が上がります。",
  gatekeeper: "受付では用件を短く言い切り、担当者の名前と在席時間を教えてもらいましょう。",
  callback: "折り返しの約束は日時を復唱して、確実に押さえましょう。",
  appointment: "アポにつながった一言をチームに共有しましょう。",
};

const COACHING: Record<Objection, string> = {
  none: "相手が話してくれた困りごとは、次回の最初に言い換えて返すと信頼につながります。",
  busy: "最初の10秒で用件と所要時間を言い切ると、忙しい相手でも聞いてもらいやすくなります。",
  no_need: "「必要ない」は情報不足のことが多いです。売り込む前に、今の運用を質問で聞きましょう。",
  already_have: "他社契約中は失注ではありません。満了時期を聞けば、次に電話する理由になります。",
  price: "単価ではなく、月々の総額や手間の削減で比べてもらう言い方を試しましょう。",
  not_decision_maker: "話せた方を味方にして、決裁者の名前と在席時間を教えてもらいましょう。",
  other: "断りの理由をはっきり聞けると、次の打ち手が決めやすくなります。",
};

/** 「担当者と話せた」だけの文は結果ラベルと同じなので要約から外す。名前が入っていれば残す */
const LABEL_ONLY = /^担当者と話せた$/;
const NAMED_CONTACT = /^.{1,15}(?:さん|様)と話せた$/;

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

  const sentences = memo
    .split(/[。\n]/)
    .map((x) => x.trim())
    .filter((x) => x && !LABEL_ONLY.test(x));
  // 「総務の山本さんと話せた」のように相手が分かる文は、結果ラベルの代わりに先頭へ置く
  let head = OUTCOME_LABEL[input.outcome];
  if (input.outcome === "decision_maker" && sentences[0] && NAMED_CONTACT.test(sentences[0])) {
    head = sentences.shift()!;
  }
  const body = sentences.slice(0, 2).join("。");
  const summary = body ? `${head}。${body.slice(0, 90)}${body.length > 90 ? "…" : "。"}` : `${head}。`;

  return {
    summary,
    temperature,
    objection,
    nextAction: {
      date: next ? toDateKey(next) : null,
      talkPoints: clampTalkPoints(OUTCOME_TALK_POINTS[input.outcome] ?? TALK_POINTS[objection]),
    },
    coachingTip: OUTCOME_COACHING[input.outcome] ?? COACHING[objection],
    uncertainties,
  };
}

/** 「アポ率が高い」と言うのに必要な最低件数。数件のまぐれで持ち上げないため */
export const BEST_MIN_APPOINTMENTS = 3;
export const BEST_MIN_CALLS = 30;

export function sampleTeamInsight(stats: TeamStats, logs: CallLog[], members: Member[]): TeamInsight {
  const findings: TeamInsight["findings"] = [];
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "メンバー";

  // 受付で止まりがちな人
  const withCalls = stats.members.filter((m) => m.calls >= 5);
  const gateCandidate = [...withCalls].sort((a, b) => b.gatekeeperRate - a.gatekeeperRate)[0];
  const gateLogs = gateCandidate
    ? logs.filter((l) => l.memberId === gateCandidate.memberId && l.outcome === "gatekeeper").slice(0, 3)
    : [];
  const worstGate =
    gateCandidate && gateCandidate.gatekeeperRate > stats.team.gatekeeperRate + 0.05 && gateLogs.length ? gateCandidate : null;
  if (worstGate) {
    findings.push({
      title: `${name(worstGate.memberId)}さんが受付で止まりがち`,
      detail: `受付で止まった割合が${pct(worstGate.gatekeeperRate)}で、チーム平均（${pct(stats.team.gatekeeperRate)}）より高めです。最初の名乗りと用件の伝え方に原因がありそうです。`,
      evidenceLogIds: gateLogs.map((l) => l.id),
    });
  }

  // 一番多い断り（担当者と話せた・お断りの記録だけを数えている）
  const topObjection = (Object.entries(stats.objections) as [Objection, number][])
    .filter(([k, v]) => k !== "none" && v > 0)
    .sort((a, b) => b[1] - a[1])[0];
  const objLogs = topObjection
    ? logs.filter((l) => countsAsObjection(l) && l.insight?.objection === topObjection[0]).slice(0, 3)
    : [];
  const objection = topObjection && objLogs.length ? topObjection : null;
  if (objection) {
    findings.push({
      title: `一番多い断りは「${OBJECTION_LABEL[objection[0]]}」`,
      detail: `担当者と話せた電話の断りのうち、${objection[1]}件がこの理由です。${COACHING[objection[0]]}`,
      evidenceLogIds: objLogs.map((l) => l.id),
    });
  }

  // アポ率が高い人。件数が少ない人・チーム平均と差がない人は出さない。
  // 一番アポ率が高いのが「受付で止まりがち」と挙げた人なら、2番手を持ち上げず、この気づき自体を出さない
  const top = [...stats.members]
    .filter((m) => m.calls >= BEST_MIN_CALLS)
    .sort((a, b) => b.appointmentRate - a.appointmentRate)[0];
  const best =
    top &&
    top.appointments >= BEST_MIN_APPOINTMENTS &&
    top.appointmentRate >= stats.team.appointmentRate * 1.15 &&
    top.memberId !== worstGate?.memberId
      ? top
      : undefined;
  const bestLogs = best ? logs.filter((l) => l.memberId === best.memberId && l.outcome === "appointment").slice(0, 3) : [];
  if (best && bestLogs.length) {
    findings.push({
      title: `${name(best.memberId)}さんのアポ率が高い`,
      detail: `アポ率${pct(best.appointmentRate)}（${best.appointments}件）でチーム平均（${pct(stats.team.appointmentRate)}）を上回っています。アポにつながった電話の流れを共有する価値があります。`,
      evidenceLogIds: bestLogs.map((l) => l.id),
    });
  }
  const bestShown = best && bestLogs.length ? best : null;

  if (!findings.length && logs[0]) {
    findings.push({
      title: "まだ傾向を出すには記録が少なめです",
      detail: "架電記録が増えると、メンバーごとの傾向が見えてきます。",
      evidenceLogIds: [logs[0].id],
    });
  }

  // 打ち手は、上で挙げた気づきとだけ対応させる（気づきに無い人や話題を持ち出さない）
  const actions: string[] = [];
  if (worstGate) actions.push(`${name(worstGate.memberId)}さんと受付突破のトークを10分ロープレする`);
  if (objection) actions.push(`「${OBJECTION_LABEL[objection[0]]}」と言われたときの切り返しを、朝会で1つ決めて全員で使う`);
  if (bestShown) actions.push(`朝会で${name(bestShown.memberId)}さんのアポ獲得トークを共有してもらう`);
  if (stats.overdueFollowups > 0) actions.push(`予定日を過ぎたフォロー${stats.overdueFollowups}件を、担当者と今日中に整理する`);
  if (!actions.length) actions.push("架電の記録を続けて、来週もう一度傾向を見る");

  return {
    headline: buildHeadline(stats, worstGate ? name(worstGate.memberId) : null, objection ? OBJECTION_LABEL[objection[0]] : null),
    findings: findings.slice(0, 3),
    actions: actions.slice(0, 3),
  };
}

/** アポ率の目安（架電数に対して2%以上）。見出しは、この目安と一番目の気づきだけから作る */
const APPOINTMENT_RATE_TARGET = 0.02;

function buildHeadline(stats: TeamStats, gateName: string | null, objectionLabel: string | null): string {
  if (stats.team.calls === 0) return "この期間の架電記録はまだありません";
  // 画面に出す数字（小数1桁の%）で比べる。「2%で目安（2%）を下回る」のような食い違いを出さない
  const shown = Math.round(stats.team.appointmentRate * 1000) / 1000;
  const rateText =
    shown >= APPOINTMENT_RATE_TARGET
      ? `アポ率${pct(stats.team.appointmentRate)}で目安（2%）は達成`
      : `アポ率${pct(stats.team.appointmentRate)}で目安（2%）を下回り気味`;
  if (gateName) return `${rateText}。${gateName}さんの受付突破が一番の伸びしろ`;
  if (objectionLabel) return `${rateText}。「${objectionLabel}」への切り返しが課題`;
  return rateText;
}

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}
