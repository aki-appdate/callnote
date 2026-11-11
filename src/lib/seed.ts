// デモ用のデータ。会社名・人名・電話番号はすべて架空。
// 乱数の種を固定しているので、誰が開いても同じ傾向のデータになる（日付だけは「今日」基準でずらす）。

import { sampleCallInsight } from "./ai/sample";
import { addDays, isWeekend, startOfDay } from "./dates";
import type { CallLog, CallOutcome, Lead, Member } from "./types";

export const MEMBERS: Member[] = [
  { id: "sv-1", name: "佐藤 美咲", role: "sv" },
  { id: "m-1", name: "田中 健太", role: "member" },
  { id: "m-2", name: "鈴木 翔", role: "member" },
  { id: "m-3", name: "高橋 彩", role: "member" },
  { id: "m-4", name: "伊藤 大輝", role: "member" },
];

/** メンバーごとのクセ。SV画面で「誰が・どこでつまずいているか」が見えるようにしてある */
const PROFILES: Record<string, { callsPerDay: number; weights: Record<CallOutcome, number>; dmObjection: string[] }> = {
  "m-1": {
    callsPerDay: 14,
    weights: { no_answer: 30, gatekeeper: 18, decision_maker: 22, callback: 12, appointment: 7, rejected: 11 },
    dmObjection: ["none", "none", "price", "busy", "already_have"],
  },
  "m-2": {
    callsPerDay: 15,
    weights: { no_answer: 28, gatekeeper: 38, decision_maker: 14, callback: 8, appointment: 3, rejected: 9 },
    dmObjection: ["none", "busy", "not_decision_maker", "price"],
  },
  "m-3": {
    callsPerDay: 13,
    weights: { no_answer: 30, gatekeeper: 17, decision_maker: 24, callback: 10, appointment: 4, rejected: 15 },
    dmObjection: ["already_have", "already_have", "already_have", "none", "price"],
  },
  "m-4": {
    callsPerDay: 10,
    weights: { no_answer: 34, gatekeeper: 24, decision_maker: 18, callback: 8, appointment: 2, rejected: 14 },
    dmObjection: ["no_need", "busy", "none", "not_decision_maker"],
  },
};

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

  const leads: Lead[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 320; i++) {
    const ind = INDUSTRIES[i % INDUSTRIES.length];
    let base = "";
    for (let k = 0; !base || used.has(base); k++) {
      base = `${PREFIXES[(Math.floor(i / INDUSTRIES.length) + k) % PREFIXES.length]}${ind.suffixes[(i + k) % ind.suffixes.length]}`;
    }
    used.add(base);
    leads.push({
      id: `lead-${String(i + 1).padStart(3, "0")}`,
      company: i % 3 === 0 ? `${base}株式会社` : `株式会社${base}`,
      industry: ind.name,
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

  while (day <= today) {
    if (!isWeekend(day)) {
      for (const m of callers) {
        const prof = PROFILES[m.id];
        const myLeads = leads.filter((l) => l.assigneeId === m.id);
        const n = prof.callsPerDay + Math.floor(rand() * 5) - 2;
        for (let k = 0; k < n; k++) {
          const minutes = 9 * 60 + 30 + Math.floor((k / n) * 8 * 60) + Math.floor(rand() * 20);
          const at = new Date(day);
          at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
          if (at > now) break;

          // 現場と同じく、予定日が来たフォローを先にかけ、空いた時間で新規にかける
          const atIso = at.toISOString();
          const due = myLeads
            .filter((l) => l.nextCallAt !== null && l.nextCallAt <= atIso && l.status !== "appointment" && l.status !== "lost")
            .sort((a, b) => a.nextCallAt!.localeCompare(b.nextCallAt!));
          const lead: Lead | undefined =
            (rand() < 0.75 ? due[0] : undefined) ?? myLeads.find((l) => l.status === "new") ?? due[0];
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
            id: `log-${String(seq).padStart(4, "0")}`,
            leadId: lead.id,
            memberId: m.id,
            at: at.toISOString(),
            outcome,
            memo,
            insight,
            aiSource: insight ? "sample" : null,
            editedFields: [],
          });
          applyLogToLead(lead, outcome, insight?.nextAction.date ?? null, at);
        }
      }
    }
    day = addDays(day, 1);
  }

  return { members: MEMBERS, leads, logs };
}

/** 架電結果から案件の状態と次回予定を更新する（保存時にも同じルールを使う） */
export function applyLogToLead(lead: Lead, outcome: CallOutcome, nextDate: string | null, at: Date): void {
  if (outcome === "appointment") {
    lead.status = "appointment";
    lead.nextCallAt = null;
    return;
  }
  if (outcome === "rejected" && !nextDate) {
    lead.status = "lost";
    lead.nextCallAt = null;
    return;
  }
  lead.status = outcome === "no_answer" || outcome === "gatekeeper" ? "calling" : "followup";
  if (nextDate) {
    lead.nextCallAt = new Date(`${nextDate}T10:00:00`).toISOString();
  } else {
    const next = addDays(at, 1);
    next.setHours(10, 0, 0, 0);
    lead.nextCallAt = next.toISOString();
  }
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
