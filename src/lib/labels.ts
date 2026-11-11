import type { CallOutcome, LeadStatus, Objection, Temperature } from "./types";

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  no_answer: "不在・つながらない",
  gatekeeper: "受付で止まった",
  decision_maker: "担当者と話せた",
  callback: "折り返し・再架電",
  appointment: "アポ獲得",
  rejected: "お断り",
};

export const OUTCOME_ORDER: CallOutcome[] = [
  "no_answer",
  "gatekeeper",
  "decision_maker",
  "callback",
  "appointment",
  "rejected",
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "未架電",
  calling: "架電中",
  followup: "フォロー中",
  appointment: "アポ済み",
  lost: "見送り",
};

export const OBJECTION_LABEL: Record<Objection, string> = {
  none: "断りなし",
  busy: "忙しい・時間がない",
  no_need: "必要ない",
  already_have: "他社で契約中",
  price: "費用が気になる",
  not_decision_maker: "決裁者ではない",
  other: "その他",
};

export const TEMPERATURE_LABEL: Record<Temperature, string> = {
  high: "前向き",
  mid: "様子見",
  low: "消極的",
};

/**
 * 断りの理由を数える結果。担当者本人と話せたときだけ。
 * 受付止まり・不在・折り返し待ちは担当者の反応ではないので、断りの集計にも判定にも入れない。
 */
export const OBJECTION_OUTCOMES: ReadonlySet<CallOutcome> = new Set<CallOutcome>(["decision_maker", "rejected"]);
