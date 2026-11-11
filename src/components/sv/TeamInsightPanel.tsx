"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import { AiSourceBadge, Badge, btn, cx, Hl, Icon, MarkerMark, Num } from "../ui";
import { analyzeTeam } from "@/lib/ai";
import { memoHighlights, TEAM_MIN_CALLS } from "@/lib/ai/sample";
import { formatDateTimeJa, toDateKey } from "@/lib/dates";
import { OUTCOME_LABEL } from "@/lib/labels";
import { isDemoLog } from "@/lib/seed";
import type { TeamStats } from "@/lib/kpi";
import type { AiSource, CallLog, TeamInsight } from "@/lib/types";

/**
 * 朝会メモ（AIによるチームの傾向）。
 * 気づきは横に並べず、紙の朝会メモのように上から1件ずつ。根拠は「架電ログの該当行」をそのまま抜き出し、
 * 決め手になった言葉に蛍光ペンを引いて見せる（行を押すと記録の全文）。
 */
export function TeamInsightPanel({ stats, logs }: { stats: TeamStats; logs: CallLog[] }) {
  const { members, leads } = useApp();
  const [state, setState] = useState<{ value: TeamInsight; source: AiSource; note?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<CallLog | null>(null);

  async function run() {
    setLoading(true);
    setState(await analyzeTeam(stats, logs, members));
    setLoading(false);
  }

  const byId = useMemo(() => new Map(logs.map((l) => [l.id, l])), [logs]);
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  const thin = stats.team.calls < TEAM_MIN_CALLS;

  // 根拠のダイアログは Esc でも閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <section aria-labelledby="morning-memo" className="rounded-md border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b-2 border-ink px-5 pt-4 pb-2.5">
        <h2 id="morning-memo" className="flex items-center gap-2 text-base font-bold">
          <MarkerMark />
          朝会メモ
          <span className="text-xs font-normal text-ink-muted">架電ログからAIが下書き</span>
        </h2>
        {state && <AiSourceBadge source={state.source} />}
      </div>

      <div className={cx("px-5 py-4 transition-opacity", loading && state && "opacity-50")} aria-busy={loading}>
        {!state ? (
          <div className="space-y-3">
            <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
              {logs.length === 0
                ? "この期間の架電記録がまだないため、下書きできません。期間を広げてください。"
                : thin
                  ? `この期間の架電は${stats.team.calls}件で、傾向を見る目安（${TEAM_MIN_CALLS}件）より少なめです。下書きはできますが、結論は出しません。`
                  : "数字と架電メモを読んで、朝会で話すことを最大3つ書き出します。どれも、もとになった架電ログの行を開いて確かめられます。"}
            </p>
            <button className={btn.primary} onClick={run} disabled={loading || logs.length === 0}>
              <MarkerMark busy={loading} />
              {loading ? "架電ログを読んでいます…" : "朝会メモを下書きする"}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {state.note && <p className="text-xs text-ink-soft">{state.note}</p>}
            <p className="text-lg leading-snug font-bold">
              <Hl>{state.value.headline}</Hl>
            </p>

            <ol className="border-t border-line">
              {state.value.findings.map((f, i) => (
                <li key={f.title} className="grid gap-x-5 gap-y-2 border-b border-line py-4 md:grid-cols-[minmax(0,17rem)_1fr]">
                  <div>
                    <p className="flex gap-2 font-bold">
                      <Num className="text-ink-muted">{i + 1}.</Num>
                      {f.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.detail}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium tracking-wider text-ink-muted">もとにした架電ログ（押すと全文）</p>
                    <ul className="mt-1 divide-y divide-dashed divide-line-strong border-y border-dashed border-line-strong">
                      {f.evidenceLogIds.map((id) => {
                        const log = byId.get(id);
                        if (!log) return null;
                        return (
                          <li key={id}>
                            <button
                              className="grid w-full grid-cols-[auto_1fr] items-baseline gap-x-3 px-1 py-1.5 text-left text-[13px] hover:bg-canvas"
                              onClick={() => setOpen(log)}
                              title={`${leadById.get(log.leadId)?.company ?? ""}の記録を開く`}
                            >
                              <Num className="text-[11px] text-ink-muted">{formatDateTimeJa(log.at).replace(/（.）/, "")}</Num>
                              <span className="min-w-0">
                                <span className="sr-only">{leadById.get(log.leadId)?.company}の記録：</span>
                                <span className="mr-2 text-[11px] font-medium text-ink-soft">
                                  {name(log.memberId)}・{OUTCOME_LABEL[log.outcome]}
                                </span>
                                <Memo log={log} />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>

            <div>
              <p className="text-xs font-bold tracking-wide">今日から試すこと</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {state.value.actions.map((a) => (
                  <li key={a} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-[3px] size-3.5 shrink-0 rounded-[2px] border border-ink" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <p className="text-xs text-ink-muted">下書きは参考情報です。朝会で話すかどうかは、記録と現場の様子をあわせてSVが決めてください。</p>
              <button className={btn.ghost} onClick={run} disabled={loading}>
                <Icon name="reset" className="size-3.5" />
                {loading ? "読んでいます…" : "下書きし直す"}
              </button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-labelledby="evidence-title">
          <div className="w-full max-w-md rounded-md bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="text-[11px] font-medium tracking-wider text-ink-muted">根拠の架電記録</p>
                <p id="evidence-title" className="mt-0.5 font-bold">
                  {leadById.get(open.leadId)?.company}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  <Num>{formatDateTimeJa(open.at)}</Num>・{name(open.memberId)}
                </p>
              </div>
              <Badge tone={open.outcome === "appointment" ? "good" : open.outcome === "rejected" ? "bad" : "neutral"}>{OUTCOME_LABEL[open.outcome]}</Badge>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-medium tracking-wider text-ink-muted">メモ（線は、判断の決め手になった言葉）</p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                <Memo log={open} />
              </p>
              {open.insight && (
                <>
                  <p className="mt-3 text-[11px] font-medium tracking-wider text-ink-muted">{summaryLabel(open)}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{open.insight.summary}</p>
                  {open.insight.nextAction.date && (
                    <p className="mt-1 text-xs text-ink-muted">
                      次に電話する日：<Num>{open.insight.nextAction.date.replaceAll("-", "/")}</Num>
                      {open.insight.nextAction.date < toDateKey(new Date()) && "（過ぎています）"}
                    </p>
                  )}
                </>
              )}
              <button autoFocus className={`${btn.secondary} mt-5 w-full`} onClick={() => setOpen(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** デモデータの記録は人が確認していない。利用者が保存した記録だけ「人が確認」と書く */
function summaryLabel(log: CallLog): string {
  if (isDemoLog(log)) return "要約（デモ用に見本の返答で自動作成・人の確認なし）";
  if (log.editedFields.length) return "要約（AIの提案を人が直して保存）";
  return "要約（AIの提案を人が確認して保存）";
}

function Memo({ log }: { log: CallLog }) {
  return (
    <>
      {memoHighlights(log.memo, log.outcome).map((p, i) => (p.mark ? <Hl key={i}>{p.text}</Hl> : <span key={i}>{p.text}</span>))}
    </>
  );
}
