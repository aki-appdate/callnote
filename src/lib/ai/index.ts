import { getFirebaseApp } from "../firebase";
import { toDateKey } from "../dates";
import type { TeamStats } from "../kpi";
import { callInsightJsonSchema, callInsightSchema, teamInsightJsonSchema, teamInsightSchema } from "../schemas";
import type { AiSource, CallInsight, CallLog, CallOutcome, Lead, Member, TeamInsight } from "../types";
import { generateStructured } from "./gemini";
import { buildCallPrompt, buildTeamPrompt, CALL_SYSTEM, TEAM_SYSTEM } from "./prompts";
import { sampleCallInsight, sampleTeamInsight } from "./sample";

// 画面から呼ぶのはこのファイルだけ。
// Geminiが使えれば使い、使えなければ（未設定・回数の上限・エラー・返答の形が不正）見本の返答に切り替える。

export type AiResult<T> = { value: T; source: AiSource; note?: string };

/** 無料枠を一人で使い切らないよう、ブラウザごとに1日の回数を区切る */
const DAILY_LIMIT = 30;
const USAGE_KEY = "callnote:ai-usage";

function takeQuota(): boolean {
  try {
    const today = toDateKey(new Date());
    const raw = localStorage.getItem(USAGE_KEY);
    const u = raw ? (JSON.parse(raw) as { date: string; count: number }) : { date: today, count: 0 };
    const cur = u.date === today ? u : { date: today, count: 0 };
    if (cur.count >= DAILY_LIMIT) return false;
    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: cur.count + 1 }));
    return true;
  } catch {
    return true;
  }
}

export function aiMode(): AiSource {
  return getFirebaseApp() ? "gemini" : "sample";
}

export async function analyzeCall(input: {
  lead: Lead;
  outcome: CallOutcome;
  memo: string;
  history: CallLog[];
  now?: Date;
}): Promise<AiResult<CallInsight>> {
  const now = input.now ?? new Date();
  const fallback = (note?: string): AiResult<CallInsight> => ({
    value: sampleCallInsight({ memo: input.memo, outcome: input.outcome, now }),
    source: "sample",
    note,
  });

  const app = getFirebaseApp();
  if (!app) return fallback();
  if (!takeQuota()) return fallback("今日のAI利用回数の上限に達したため、見本の返答を表示しています");

  try {
    const value = await generateStructured({
      app,
      system: CALL_SYSTEM,
      prompt: buildCallPrompt({ ...input, now }),
      schema: callInsightSchema,
      jsonSchema: callInsightJsonSchema,
    });
    // 過去の日付が返ってきたら使わない（人が決め直す）
    if (value.nextAction.date && value.nextAction.date <= toDateKey(now)) {
      value.nextAction.date = null;
      value.uncertainties = [...value.uncertainties, "AIの提案した日付が過去だったため、日付は空にしています"].slice(0, 3);
    }
    return { value, source: "gemini" };
  } catch (e) {
    console.warn("[ai] analyzeCall fallback", e);
    return fallback("AIに接続できなかったため、見本の返答を表示しています");
  }
}

export async function analyzeTeam(stats: TeamStats, logs: CallLog[], members: Member[]): Promise<AiResult<TeamInsight>> {
  const fallback = (note?: string): AiResult<TeamInsight> => ({
    value: sampleTeamInsight(stats, logs, members),
    source: "sample",
    note,
  });
  const app = getFirebaseApp();
  if (!app || logs.length === 0) return fallback();
  if (!takeQuota()) return fallback("今日のAI利用回数の上限に達したため、見本の返答を表示しています");

  try {
    const value = await generateStructured({
      app,
      system: TEAM_SYSTEM,
      prompt: buildTeamPrompt(stats, logs, members),
      schema: teamInsightSchema,
      jsonSchema: teamInsightJsonSchema,
    });
    // 根拠のidは実在するものだけ残す。根拠が1つも残らない気づきは捨てる
    const ids = new Set(logs.map((l) => l.id));
    value.findings = value.findings
      .map((f) => ({ ...f, evidenceLogIds: f.evidenceLogIds.filter((id) => ids.has(id)) }))
      .filter((f) => f.evidenceLogIds.length > 0);
    if (value.findings.length === 0) return fallback("AIの返答に根拠が確認できなかったため、見本の返答を表示しています");
    return { value, source: "gemini" };
  } catch (e) {
    console.warn("[ai] analyzeTeam fallback", e);
    return fallback("AIに接続できなかったため、見本の返答を表示しています");
  }
}
