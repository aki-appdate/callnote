// 「見本の返答」。AIが使えないとき（未設定・無料枠の上限・通信エラー）に使う、ルールベースの整理。
// AIと同じ形（CallInsight / TeamInsight）を返すので、画面側はどちらが動いたかを気にしなくてよい。

import { OBJECTION_LABEL, OBJECTION_OUTCOMES, OUTCOME_LABEL } from "../labels";
import { addBusinessDays, addDays, isBusinessDay, nextBusinessDay, startOfDay, toDateKey } from "../dates";
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
 * メモの中の「来週」「明日」「金曜」「15日」「2〜3日後」「来年の3月」「3月末」などから日付を読み取る。読めなければnull。
 * 「明日」「N日後」「来週」「金曜」のような言い方で土日・祝日・年末年始に当たったら、次の営業日にずらす。
 * 「11月13日」「20日」のようにはっきり書かれた日は、今日を含めてそのまま使う（過ぎていれば翌年・翌月）。
 * 「3月」「来年の3月」のように月だけなら、その月の最初の営業日。「3月末」なら、その月の最後の営業日。
 */
export function parseDateFromMemo(memo: string, now: Date): Date | null {
  const today = startOfDay(now);
  const md = memo.match(/(\d{1,2})月(\d{1,2})日/);
  if (md) {
    const d = new Date(today.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  // 「来年の3月」「3月末」「4月中旬」：日にちのない月の言い方（「3か月」「3ヶ月」は数字の直後が「月」でないので拾わない）
  const month = memo.match(/(来年)?(?:の)?\s*(\d{1,2})月(末|下旬|中旬|上旬|頭|初め)?/);
  if (month && Number(month[2]) >= 1 && Number(month[2]) <= 12) {
    return monthToDate(today, Number(month[2]) - 1, Boolean(month[1]), month[3]);
  }
  // 「2〜3日後」「3日後」：幅があるときは早いほうに合わせる
  const after = memo.match(/(\d{1,2})(?:\s*[〜~～\-ー]\s*\d{1,2})?\s*日後/);
  if (after) return nextBusinessDay(addDays(today, Number(after[1])));
  const weeks = memo.match(/(\d{1,2})\s*週間後/);
  if (weeks) return nextBusinessDay(addDays(today, Number(weeks[1]) * 7));
  if (/明後日|あさって/.test(memo)) return nextBusinessDay(addDays(today, 2));
  if (/明日/.test(memo)) return nextBusinessDay(addDays(today, 1));
  const wd = memo.match(/(来週)?(?:の)?\s*([月火水木金])曜/);
  if (wd) {
    const target = WEEKDAY_CHARS.indexOf(wd[2]);
    if (wd[1]) return nextBusinessDay(addDays(nextMonday(today), target - 1));
    const diff = (target - today.getDay() + 7) % 7 || 7;
    return nextBusinessDay(addDays(today, diff));
  }
  if (/来週/.test(memo)) return nextBusinessDay(nextMonday(today));
  if (/来月/.test(memo)) return nextBusinessDay(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  if (/月末/.test(memo)) {
    const end = lastBusinessDayOfMonth(today.getFullYear(), today.getMonth());
    return end >= today ? end : lastBusinessDayOfMonth(today.getFullYear(), today.getMonth() + 1);
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

function lastBusinessDayOfMonth(year: number, month: number): Date {
  let d = new Date(year, month + 1, 0);
  while (!isBusinessDay(d)) d = addDays(d, -1);
  return d;
}

/** 「(来年の)M月(末)」を日付にする。来年と書いていなければ、今日以降で一番近いその月 */
function monthToDate(today: Date, month: number, nextYear: boolean, part: string | undefined): Date {
  const at = (year: number): Date => {
    if (part === "末" || part === "下旬") {
      return part === "末" ? lastBusinessDayOfMonth(year, month) : nextBusinessDay(new Date(year, month, 21));
    }
    if (part === "中旬") return nextBusinessDay(new Date(year, month, 11));
    return nextBusinessDay(new Date(year, month, 1));
  };
  if (nextYear) return at(today.getFullYear() + 1);
  if (month === today.getMonth()) {
    // 今月の話：もう過ぎた区切り（今月の頭など）なら、今日から数えて次の営業日
    const d = at(today.getFullYear());
    return d >= today ? d : nextBusinessDay(today);
  }
  return at(month > today.getMonth() ? today.getFullYear() : today.getFullYear() + 1);
}

/** 契約の満了・更新に触れた文。ここに書かれた日付は「満了日」で、次に電話する日ではない */
const CONTRACT_END = /満了|契約の?更新|更新時期|リースが?切れ|契約が?切れ/;

/**
 * メモから契約の満了時期を読む。満了に触れていなければ null。
 * 触れていても月が書かれていなければ date は null（「来年の春」など）。
 */
export function findContractEnd(memo: string, now: Date): { sentence: string; date: Date | null } | null {
  const sentence = contractEndSentence(memo);
  if (!sentence) return null;
  return { sentence, date: parseDateFromMemo(sentence, now) };
}

/** 満了・更新に触れた文（読点・句点で区切った1つ）。日付は読まない */
function contractEndSentence(memo: string): string | undefined {
  return memo.split(/[。\n、]/).find((x) => CONTRACT_END.test(x));
}

/** 満了の何か月前に比較見積を出すか。満了月の2か月前の月の初め＝満了（月末）の約3か月前 */
export const PROPOSE_MONTHS_BEFORE_END = 2;

export function proposalDateForContractEnd(end: Date): Date {
  return nextBusinessDay(new Date(end.getFullYear(), end.getMonth() - PROPOSE_MONTHS_BEFORE_END, 1));
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
      return objection === "already_have" ? nextBusinessDay(addDays(now, 90)) : null;
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
  // 満了の話は、担当者本人と話せた（断られた）ときだけ次の一手に使う。満了日そのものは次回日にしない
  const contractEnd = OBJECTION_OUTCOMES.has(input.outcome) ? findContractEnd(memo, input.now) : null;
  const parsed = parseDateFromMemo(contractEnd ? memo.replace(contractEnd.sentence, "") : memo, input.now);
  let next = parsed ?? defaultNextDate(input.outcome, objection, input.now);
  let talkPoints = OUTCOME_TALK_POINTS[input.outcome] ?? TALK_POINTS[objection];
  let coachingTip = OUTCOME_COACHING[input.outcome] ?? COACHING[objection];

  const uncertainties: string[] = [];
  if (contractEnd) {
    const proposal = contractEnd.date ? proposalDateForContractEnd(contractEnd.date) : null;
    const soon = addBusinessDays(input.now, 3);
    if (!contractEnd.date) {
      talkPoints = ["満了の月を確かめる", "見直しの比較材料として資料送付を提案"];
      uncertainties.push("満了の月がメモから読み取れません（分かれば次回日を合わせられます）");
    } else if (proposal && proposal > soon) {
      next = parsed ?? proposal;
      talkPoints = ["満了の2〜3か月前に比較見積を提案", "今の月額と不満な点をもう一度確かめる"];
      coachingTip = "満了時期が聞けたのは前進です。満了の2〜3か月前が、乗り換えを比べてもらいやすい時期です。";
    } else {
      next = parsed ?? addBusinessDays(input.now, 1);
      talkPoints = ["満了が近いので、すぐに比較見積を出す", "乗り換えの手続きと時期を説明する"];
      coachingTip = "満了が近い相手は、比べる材料を早く渡した会社が有利です。";
    }
  }
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
      talkPoints: clampTalkPoints(talkPoints),
    },
    coachingTip,
    uncertainties: uncertainties.slice(0, 3),
  };
}

/** 「アポ率が高い」と言うのに必要な最低件数。数件のまぐれで持ち上げないため */
export const BEST_MIN_APPOINTMENTS = 3;
export const BEST_MIN_CALLS = 30;

/**
 * チームの傾向を言うのに必要な最低の架電数。これより少ない期間は「記録が少なめ」とだけ伝え、結論を出さない。
 * SV画面の初期表示（今週が少なければ直近2週間に広げる）も同じ数を使う。
 */
export const TEAM_MIN_CALLS = 30;
/** メンバー1人について「受付で止まりがち」と言うのに必要な最低の架電数 */
export const MEMBER_MIN_CALLS = 20;

/** 記録が少ない期間に返す分析。数件の偏りで「誰が悪い」と言わないため、結論は出さない */
/** 根拠は同じ文面のメモを避けて選ぶ（同じ文が並ぶと、同じ電話が何度も出ているように見えるため） */
function uniqueByMemo(xs: CallLog[]): CallLog[] {
  return [...new Map(xs.map((l) => [l.memo, l])).values()];
}

export function thinTeamInsight(stats: TeamStats, logs: CallLog[]): TeamInsight {
  return {
    headline: `記録が少なめ（${stats.team.calls}件）のため、まだ傾向は言い切れません`,
    findings: [
      {
        title: "記録が少なめです",
        detail: `この期間の架電は${stats.team.calls}件で、傾向を見る目安（${TEAM_MIN_CALLS}件）に届いていません。数件の偏りで判断しないよう、気づきは出していません。`,
        evidenceLogIds: uniqueByMemo(logs).slice(0, 3).map((l) => l.id),
      },
    ],
    actions: ["期間を「直近2週間」に広げて、もう一度分析する"],
  };
}

export function sampleTeamInsight(stats: TeamStats, logs: CallLog[], members: Member[]): TeamInsight {
  if (stats.team.calls < TEAM_MIN_CALLS && logs.length > 0) return thinTeamInsight(stats, logs);
  const findings: TeamInsight["findings"] = [];
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "メンバー";

  // 受付で止まりがちな人
  const withCalls = stats.members.filter((m) => m.calls >= MEMBER_MIN_CALLS);
  const gateCandidate = [...withCalls].sort((a, b) => b.gatekeeperRate - a.gatekeeperRate)[0];
  const gateLogs = gateCandidate
    ? uniqueByMemo(logs.filter((l) => l.memberId === gateCandidate.memberId && l.outcome === "gatekeeper")).slice(0, 3)
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
  // 同じ件数で並んだ理由があれば、どちらか一方を「一番」と言い切らない
  const tied = topObjection
    ? (Object.entries(stats.objections) as [Objection, number][]).filter(([k, v]) => k !== "none" && k !== topObjection[0] && v === topObjection[1])
    : [];
  const objLogs = topObjection
    ? uniqueByMemo(logs.filter((l) => countsAsObjection(l) && (l.insight?.objection === topObjection[0] || tied.some(([k]) => l.insight?.objection === k)))).slice(0, 3)
    : [];
  const objection = topObjection && objLogs.length ? topObjection : null;
  if (objection) {
    const labels = [objection[0], ...tied.map(([k]) => k)].map((k) => `「${OBJECTION_LABEL[k]}」`).join("と");
    findings.push({
      title: tied.length ? `断りの理由は${labels}が同数で最多` : `一番多い断りは${labels}`,
      detail: tied.length
        ? `担当者と話せた電話の断りのうち、どちらも${objection[1]}件ずつでした。${COACHING[objection[0]]}`
        : `担当者と話せた電話の断りのうち、${objection[1]}件がこの理由です。${COACHING[objection[0]]}`,
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
  const bestLogs = best ? uniqueByMemo(logs.filter((l) => l.memberId === best.memberId && l.outcome === "appointment")).slice(0, 3) : [];
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

/** 結果ごとに、メモのどこが判断の決め手になったかを示す言葉 */
const OUTCOME_KEYS: Partial<Record<CallOutcome, RegExp>> = {
  gatekeeper: /受付|外出中|在席|戻り時間|お断り|メールで/,
  callback: /折り返し|かけ直/,
  appointment: /アポ|面談|訪問/,
};

export type MemoPiece = { text: string; mark: boolean };

/**
 * メモを「蛍光ペンを引く部分」と「そのままの部分」に分ける。
 * 見本の返答が判断に使った言葉（断りの理由・前向きな言葉・満了の時期・結果の決め手）に線を引く。
 * 画面では、AIが読んだところを人がすぐ確かめられるように使う（判断そのものには使わない）。
 */
export function memoHighlights(memo: string, outcome: CallOutcome): MemoPiece[] {
  const patterns: RegExp[] = [];
  if (OBJECTION_OUTCOMES.has(outcome)) {
    patterns.push(...OBJECTION_RULES.map((r) => r.pattern), POSITIVE);
    const end = contractEndSentence(memo);
    if (end) patterns.push(new RegExp(end.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const key = OUTCOME_KEYS[outcome];
  if (key) patterns.push(key);

  const marked = new Array<boolean>(memo.length).fill(false);
  for (const p of patterns) {
    const re = new RegExp(p.source, "g");
    for (const m of memo.matchAll(re)) {
      for (let i = m.index; i < m.index + m[0].length; i++) marked[i] = true;
    }
  }
  const pieces: MemoPiece[] = [];
  for (let i = 0; i < memo.length; i++) {
    const last = pieces[pieces.length - 1];
    if (last && last.mark === marked[i]) last.text += memo[i];
    else pieces.push({ text: memo[i], mark: marked[i] });
  }
  return pieces;
}
