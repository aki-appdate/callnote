import { OBJECTION_LABEL, OUTCOME_LABEL } from "../labels";
import { toDateKey } from "../dates";
import type { CallLog, CallOutcome, Lead, Member } from "../types";
import type { TeamStats } from "../kpi";

// AIへの指示文。何を渡し、何を返してほしいかをここに集める。

export const CALL_SYSTEM = `あなたは法人向けテレアポチームの営業アシスタントです。
オペレーターが電話の直後に書いた短いメモを、次の行動につながる形に整理します。

守ること:
- メモに書かれていないことを事実として書かない。推測が必要な点は uncertainties に入れる。
- 次回の日付は、メモに日時の言及があればそれに従う。なければ結果に応じて1〜3営業日後。土日は避ける。
- アポ獲得・はっきりしたお断りで、もう電話しない方がよい場合は date を null にする。ただし「他社で契約中」は契約の見直し時期に向けて約3か月後を提案する。
- 文章は日本語で、短く、現場の人がすぐ読める言葉にする。`;

export function buildCallPrompt(input: {
  lead: Lead;
  outcome: CallOutcome;
  memo: string;
  history: CallLog[];
  now: Date;
}): string {
  const past = input.history
    .slice(-3)
    .map((h) => `- ${toDateKey(new Date(h.at))} ${OUTCOME_LABEL[h.outcome]}：${h.memo}`)
    .join("\n");
  return `今日の日付: ${toDateKey(input.now)}（${"日月火水木金土"[input.now.getDay()]}曜日）

架電先: ${input.lead.company}（${input.lead.industry}・${input.lead.prefecture}・従業員${input.lead.employees}名）
提案している商材: ${input.lead.product}
これまでの架電:
${past || "- なし（初回）"}

今回の結果: ${OUTCOME_LABEL[input.outcome]}
今回のメモ:
${input.memo}`;
}

export const TEAM_SYSTEM = `あなたはテレアポチームのSV（現場リーダー）を補佐するアナリストです。
数字と架電記録から、SVが明日の朝会で使える気づきを最大3つ出します。

守ること:
- 根拠にした架電記録の id を evidenceLogIds に必ず入れる。渡された id 以外は使わない。
- 数字は渡された集計値だけを使い、計算し直したり作ったりしない。
- 個人を責める書き方ではなく、改善につながる書き方にする。`;

export function buildTeamPrompt(stats: TeamStats, logs: CallLog[], members: Member[]): string {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  const memberLines = stats.members
    .map(
      (m) =>
        `- ${name(m.memberId)}: 架電${m.calls}件 / 担当者接続率${pct(m.connectRate)} / 受付止まり${pct(m.gatekeeperRate)} / アポ${m.appointments}件（${pct(m.appointmentRate)}）`,
    )
    .join("\n");
  const objectionLines = Object.entries(stats.objections)
    .filter(([k, v]) => k !== "none" && v > 0)
    .map(([k, v]) => `- ${OBJECTION_LABEL[k as keyof typeof OBJECTION_LABEL]}: ${v}件`)
    .join("\n");
  const sample = logs
    .filter((l) => l.outcome !== "no_answer")
    .slice(-60)
    .map((l) => `[${l.id}] ${name(l.memberId)} / ${OUTCOME_LABEL[l.outcome]} / ${l.memo}`)
    .join("\n");

  return `チーム全体: 架電${stats.team.calls}件 / 担当者接続率${pct(stats.team.connectRate)} / 受付止まり${pct(stats.team.gatekeeperRate)} / アポ${stats.team.appointments}件（${pct(stats.team.appointmentRate)}）
予定日を過ぎたフォロー: ${stats.overdueFollowups}件

メンバー別:
${memberLines}

断りの理由:
${objectionLines || "- なし"}

最近の架電記録（[id] 担当 / 結果 / メモ）:
${sample}`;
}
