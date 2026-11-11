// アプリ全体で使うデータの形。画面・保存・AIのすべてがこの型を共有する。

export type Role = "member" | "sv";

export type Member = {
  id: string;
  name: string;
  role: Role;
};

/** 架電先の状態 */
export type LeadStatus = "new" | "calling" | "followup" | "appointment" | "lost";

export type Lead = {
  id: string;
  company: string;
  industry: string;
  prefecture: string;
  employees: number;
  contactName: string | null;
  phone: string;
  /** 提案している商材（複合機・法人携帯など） */
  product: string;
  status: LeadStatus;
  assigneeId: string;
  /** 次に電話する予定日時（ISO文字列）。未定ならnull */
  nextCallAt: string | null;
};

/** 1回の電話の結果（ボタンで選ぶ） */
export type CallOutcome =
  | "no_answer" // 不在・つながらない
  | "gatekeeper" // 受付で止まった
  | "decision_maker" // 担当者と話せた
  | "callback" // 折り返し・再架電の約束
  | "appointment" // アポ獲得
  | "rejected"; // はっきり断られた

/** 断られた理由の分類 */
export type Objection =
  | "none"
  | "busy"
  | "no_need"
  | "already_have"
  | "price"
  | "not_decision_maker"
  | "other";

export type Temperature = "high" | "mid" | "low";

/** AIが架電メモから作る整理結果。人が確認・修正してから保存する。 */
export type CallInsight = {
  summary: string;
  temperature: Temperature;
  objection: Objection;
  nextAction: {
    /** 次に電話する日（YYYY-MM-DD）。電話しない方がよい場合はnull */
    date: string | null;
    talkPoints: string[];
  };
  coachingTip: string;
  /** AIが自信を持てない理由。空なら特になし */
  uncertainties: string[];
};

export type AiSource = "gemini" | "sample";

export type CallLog = {
  id: string;
  leadId: string;
  memberId: string;
  /** 電話した日時（ISO文字列） */
  at: string;
  outcome: CallOutcome;
  memo: string;
  /** 人が確認したあとのAI整理結果。AIを使わずに保存した場合はnull */
  insight: CallInsight | null;
  aiSource: AiSource | null;
  /** AIの提案から人が書き換えた項目 */
  editedFields: string[];
};

/** SV向け：チーム全体の傾向をAIがまとめたもの */
export type TeamInsight = {
  headline: string;
  findings: {
    title: string;
    detail: string;
    /** 根拠にした架電記録のID */
    evidenceLogIds: string[];
  }[];
  actions: string[];
};
