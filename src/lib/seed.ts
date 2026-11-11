// デモ用のデータ。会社名・人名・電話番号はすべて架空。
// 乱数の種を固定しているので、誰が開いても同じ傾向のデータになる。
// 毎回「今日」を基準に作り直すので、何日後に開いても「過去2週間ぶんの記録がある今日」の状態になる。

import { defaultNextDate, sampleCallInsight } from "./ai/sample";
import { addDays, isWeekend, startOfDay, toDateKey } from "./dates";
import type { CallInsight, CallLog, CallOutcome, Lead, Member } from "./types";

export const MEMBERS: Member[] = [
  { id: "sv-1", name: "佐藤 美咲", role: "sv" },
  { id: "m-1", name: "田中 健太", role: "member" },
  { id: "m-2", name: "鈴木 翔", role: "member" },
  { id: "m-3", name: "高橋 彩", role: "member" },
  { id: "m-4", name: "伊藤 大輝", role: "member" },
];

/**
 * メンバーごとのクセ。SV画面で「誰が・どこでつまずいているか」が見えるようにしてある。
 * 数字は法人向けテレアポ（OA機器・法人携帯）の現場感に合わせている：
 * 1人1日40〜60件かけ、担当者につながるのは15〜25%、アポは架電の2〜4%（1人1日1〜2件）。
 * forgetRate は、入れたフォローの予定を見落とす割合。高い人ほど「予定日を過ぎたフォロー」がたまる。
 */
const PROFILES: Record<
  string,
  { callsPerDay: number; forgetRate: number; weights: Record<CallOutcome, number>; dmObjection: string[] }
> = {
  "m-1": {
    callsPerDay: 54,
    forgetRate: 0.004,
    weights: { no_answer: 43, gatekeeper: 33, decision_maker: 10, callback: 4, appointment: 3.6, rejected: 6.4 },
    dmObjection: ["none", "none", "price", "busy", "already_have"],
  },
  "m-2": {
    callsPerDay: 56,
    forgetRate: 0.008,
    weights: { no_answer: 32, gatekeeper: 51, decision_maker: 7, callback: 3, appointment: 1.5, rejected: 5.5 },
    dmObjection: ["none", "busy", "not_decision_maker", "price"],
  },
  "m-3": {
    callsPerDay: 48,
    forgetRate: 0.004,
    weights: { no_answer: 40, gatekeeper: 37, decision_maker: 10, callback: 4, appointment: 3.1, rejected: 5.9 },
    dmObjection: ["already_have", "already_have", "already_have", "none", "price"],
  },
  "m-4": {
    callsPerDay: 42,
    forgetRate: 0.03,
    weights: { no_answer: 42, gatekeeper: 37, decision_maker: 8, callback: 4, appointment: 2.5, rejected: 6.5 },
    dmObjection: ["no_need", "busy", "none", "not_decision_maker"],
  },
};

/** 担当者に一度もつながらないまま、この回数かけたら見送る（リストを回すための現場の運用ルール） */
const MAX_UNREACHED_ATTEMPTS = 4;

/** デモの案件数。1人1日50件前後かけても、2週間でリストが尽きない数にしてある */
export const LEAD_COUNT = 2600;

const MEMOS: Record<string, string[]> = {
  no_answer: ["呼び出すが誰も出ず", "話し中だった", "留守電。メッセージは残していない"],
  gatekeeper: [
    "受付の方に、営業の電話はお断りしていると言われた",
    "担当者は外出中とのこと。戻り時間は分からない",
    "受付で用件を聞かれ、資料をメールで送ってほしいと言われた",
  ],
  "dm:none": [
    "総務の担当者と話せた。コピーの枚数が増えて困っている様子。資料を送って金曜に再度連絡",
    "担当者と話せた。社用携帯の管理が手間になっていて、詳しく聞きたいとのこと。来週もう一度電話",
  ],
  "dm:busy": ["担当者と話せたが、今は忙しいので来週また電話してほしいとのこと"],
  "dm:already_have": [
    "担当者と話せた。複合機は他社でリース中で、満了は来年の春とのこと",
    "担当者と話せた。法人携帯は他社で契約中。不満は特にないとのこと",
  ],
  "dm:price": ["担当者と話せた。今の費用が高いとは感じているが、乗り換えの手間が気になる様子。見積があれば比較したい"],
  "dm:not_decision_maker": ["事務の方と話せたが、決めるのは社長なので分からないとのこと。社長は夕方なら在席"],
  "dm:no_need": ["担当者と話せたが、今の機械で間に合っているので必要ないとのこと"],
  callback: ["担当者が会議中。明日の午前に折り返し電話する約束", "担当者から、木曜の15時以降にかけ直してほしいと言われた"],
  appointment: [
    "担当者と話せて、来週火曜の14時に訪問のアポ。今のリース満了が近く、比較したいとのこと",
    "法人携帯の台数が増える予定で、見積を兼ねて来週木曜にオンライン面談",
  ],
  rejected: [
    "必要ないとはっきり断られた",
    "他社と契約したばかりなので結構ですとのこと",
    "予算がないので今年は無理と言われた",
  ],
};

const PREFIXES = [
  "あおば", "みどり", "ひかり", "さくら", "つばさ", "かえで", "すばる", "なごみ", "あさひ", "いぶき",
  "ことぶき", "やまびこ", "わかば", "ほしの", "くすのき", "しらかば", "あけぼの", "みなと", "はるか", "こだま",
  "たちばな", "ゆうき", "まほろば", "せせらぎ", "ひまわり", "あかね", "のぞみ", "やまと", "そよかぜ", "いずみ",
];
/** 社名の真ん中に入れる言葉。PREFIXES×MIDDLES×業種の語尾の組み合わせで、社名が重ならないようにする */
const MIDDLES = ["", "テック", "総合", "第一", "中部", "東海", "ニュー", "グリーン", "スター"];
const INDUSTRIES: { name: string; suffixes: string[] }[] = [
  { name: "製造業", suffixes: ["精工", "製作所", "金属工業", "樹脂"] },
  { name: "建設業", suffixes: ["建設", "工務店", "設備"] },
  { name: "卸売業", suffixes: ["商事", "産業", "物産"] },
  { name: "運送業", suffixes: ["運輸", "ロジテック", "急便"] },
  { name: "不動産業", suffixes: ["不動産", "ハウジング"] },
  { name: "介護事業所", suffixes: ["ケアサービス", "介護センター"] },
];
const PREFS = ["愛知県", "愛知県", "愛知県", "岐阜県", "三重県", "静岡県"];
const PRODUCTS = ["複合機", "法人携帯", "ビジネスフォン"];
const CONTACTS = ["総務部 山本様", "事務長 中村様", "総務課 小林様", "代表 加藤様", null, null];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SeedData = { members: Member[]; leads: Lead[]; logs: CallLog[] };

export function createSeedData(now: Date = new Date()): SeedData {
  const rand = mulberry32(20261111);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const callers = MEMBERS.filter((m) => m.role === "member");

  // 業種ごとに、重ならない社名の候補を作って混ぜておく
  const namePools = INDUSTRIES.map((ind) => {
    const names: string[] = [];
    for (const suffix of ind.suffixes) for (const pre of PREFIXES) for (const mid of MIDDLES) names.push(`${pre}${mid}${suffix}`);
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    return names;
  });

  const leads: Lead[] = [];
  for (let i = 0; i < LEAD_COUNT; i++) {
    const indIdx = i % INDUSTRIES.length;
    const base = namePools[indIdx][Math.floor(i / INDUSTRIES.length)];
    leads.push({
      id: `lead-${String(i + 1).padStart(4, "0")}`,
      company: i % 3 === 0 ? `${base}株式会社` : `株式会社${base}`,
      industry: INDUSTRIES[indIdx].name,
      prefecture: pick(PREFS),
      employees: 5 + Math.floor(rand() * 120),
      contactName: pick(CONTACTS),
      phone: `052-000-${String(1000 + i).padStart(4, "0")}`,
      product: pick(PRODUCTS),
      status: "new",
      assigneeId: callers[i % callers.length].id,
      nextCallAt: null,
    });
  }

  const logs: CallLog[] = [];
  const today = startOfDay(now);
  let day = addDays(today, -15);
  let seq = 0;
  const unreached = new Map<string, number>();
  const forgotten = new Set<string>();
  const leadsOf = new Map(callers.map((m) => [m.id, leads.filter((l) => l.assigneeId === m.id)]));
  const newCursor = new Map(callers.map((m) => [m.id, 0]));

  while (day <= today) {
    if (!isWeekend(day)) {
      for (const m of callers) {
        const prof = PROFILES[m.id];
        const myLeads = leadsOf.get(m.id)!;
        const n = prof.callsPerDay + Math.floor(rand() * 9) - 4;
        for (let k = 0; k < n; k++) {
          const minutes = 9 * 60 + 30 + Math.floor((k / n) * 8 * 60) + Math.floor(rand() * 8);
          const at = new Date(day);
          at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
          if (at > now) break;

          // 現場と同じく、予定日が来たフォローを先にかけ、空いた時間で新規にかける
          const atIso = at.toISOString();
          let due: Lead | undefined;
          for (const l of myLeads) {
            if (
              l.nextCallAt !== null &&
              l.nextCallAt <= atIso &&
              (l.status === "calling" || l.status === "followup") &&
              !forgotten.has(l.id)
            ) {
              if (!due || l.nextCallAt < due.nextCallAt!) due = l;
            }
          }
          let cur = newCursor.get(m.id)!;
          while (cur < myLeads.length && myLeads[cur].status !== "new") cur++;
          newCursor.set(m.id, cur);
          const fresh = myLeads[cur];
          const lead: Lead | undefined = due ?? fresh;
          if (!lead) break;

          const outcome = weighted(prof.weights, rand);
          let memo: string;
          if (outcome === "decision_maker") {
            const obj = pick(prof.dmObjection);
            memo = pick(MEMOS[`dm:${obj}`]);
          } else {
            memo = pick(MEMOS[outcome]);
          }
          const insight = outcome === "no_answer" ? null : sampleCallInsight({ memo, outcome, now: at });

          seq++;
          logs.push({
            id: `log-${String(seq).padStart(5, "0")}`,
            leadId: lead.id,
            memberId: m.id,
            at: at.toISOString(),
            outcome,
            memo,
            insight,
            aiSource: insight ? "sample" : null,
            editedFields: [],
          });
          applyLogToLead(lead, outcome, insight, at);

          const misses = outcome === "no_answer" || outcome === "gatekeeper" ? (unreached.get(lead.id) ?? 0) + 1 : -Infinity;
          unreached.set(lead.id, misses);
          if (misses >= MAX_UNREACHED_ATTEMPTS && lead.status === "calling") {
            lead.status = "lost";
            lead.nextCallAt = null;
          }
          if (lead.nextCallAt !== null && rand() < prof.forgetRate) forgotten.add(lead.id);
        }
      }
    }
    day = addDays(day, 1);
  }

  return { members: MEMBERS, leads, logs };
}

/**
 * 架電結果から案件の状態と次回予定を更新する（デモデータ作成・保存時の両方で同じルールを使う）。
 * - AIの整理を確認して保存した場合：「次に電話する日」が空欄なら、もう電話しない＝「見送り」にする。
 * - AIを使わずに保存した場合：結果に応じた標準の間隔（不在なら翌営業日など）で次回を入れる。
 */
export function applyLogToLead(lead: Lead, outcome: CallOutcome, insight: CallInsight | null, at: Date): void {
  if (outcome === "appointment") {
    lead.status = "appointment";
    lead.nextCallAt = null;
    return;
  }
  let nextDate: string | null;
  if (insight) {
    nextDate = insight.nextAction.date;
  } else {
    const d = defaultNextDate(outcome, "other", at);
    nextDate = d ? toDateKey(d) : null;
  }
  if (!nextDate) {
    lead.status = "lost";
    lead.nextCallAt = null;
    return;
  }
  lead.status = outcome === "no_answer" || outcome === "gatekeeper" ? "calling" : "followup";
  lead.nextCallAt = new Date(`${nextDate}T10:00:00`).toISOString();
}

function weighted<T extends string>(weights: Record<T, number>, rand: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}
