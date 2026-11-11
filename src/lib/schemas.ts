import { z } from "zod";

// AIの返答は必ずこの形で受け取り、形が合わなければ使わない（見本の返答に切り替える）。
// 同じ定義から「AIに渡す返答形式（JSON Schema）」も作るので、ずれが起きない。

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD形式");

export const callInsightSchema = z.object({
  summary: z.string().min(1).max(200).describe("電話の内容を2文以内で要約"),
  temperature: z
    .enum(["high", "mid", "low"])
    .describe("相手の温度感。high=前向き, mid=様子見, low=消極的"),
  objection: z
    .enum(["none", "busy", "no_need", "already_have", "price", "not_decision_maker", "other"])
    .describe("断られた理由の分類。断られていなければnone"),
  nextAction: z.object({
    date: isoDate
      .nullable()
      .describe("次に電話する日。今日より後の日付。電話しない方がよければnull"),
    talkPoints: z.array(z.string().max(80)).max(3).describe("次の電話で話すこと（最大3つ）"),
  }),
  coachingTip: z.string().max(120).describe("この電話から学べる、トークの改善点を1つ"),
  uncertainties: z
    .array(z.string().max(80))
    .max(3)
    .describe("メモから判断しきれなかった点。人に確認してほしいこと"),
});

export const teamInsightSchema = z.object({
  headline: z.string().max(80).describe("今のチームの状態を一言で"),
  findings: z
    .array(
      z.object({
        title: z.string().max(40),
        detail: z.string().max(200),
        evidenceLogIds: z
          .array(z.string())
          .min(1)
          .max(5)
          .describe("根拠にした架電記録のid。渡されたidだけを使う"),
      }),
    )
    .min(1)
    .max(3),
  actions: z.array(z.string().max(100)).min(1).max(3).describe("SVが明日からできる具体的な打ち手"),
});

export const callInsightJsonSchema = z.toJSONSchema(callInsightSchema);
export const teamInsightJsonSchema = z.toJSONSchema(teamInsightSchema);
