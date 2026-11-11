"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import { AiSourceBadge, Badge, btn, Card, cx, Icon, Num } from "../ui";
import { analyzeTeam } from "@/lib/ai";
import { formatDateTimeJa } from "@/lib/dates";
import { OUTCOME_LABEL } from "@/lib/labels";
import type { TeamStats } from "@/lib/kpi";
import type { AiSource, CallLog, TeamInsight } from "@/lib/types";

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
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;

  // 根拠のダイアログは Esc でも閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Card className="overflow-hidden border-ink">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-ink px-5 py-2.5 text-white">
        <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-wide">
          <Icon name="spark" className="size-3.5 text-marker" />
          AIによるチームの傾向
        </h2>
        {state && <AiSourceBadge source={state.source} onDark />}
      </div>
      <div className={cx("px-5 py-5 transition-opacity", loading && state && "opacity-50")} aria-busy={loading}>
        {!state ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <button className={btn.primary} onClick={run} disabled={loading || logs.length === 0}>
              <Icon name="spark" className={loading ? "animate-spin" : undefined} />
              {loading ? "分析しています…" : "この期間の傾向を分析する"}
            </button>
            <p className="max-w-xl text-sm leading-relaxed text-ink-soft">
              {logs.length === 0
                ? "この期間の架電記録がまだないため、分析できません。期間を広げてください。"
                : "数字と架電メモから、明日の朝会で使える気づきを最大3つ出します。気づきごとに根拠の記録を開いて確かめられます。"}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {state.note && <p className="text-xs text-ink-soft">{state.note}</p>}
            <p className="text-lg leading-snug font-bold">
              <span className="bg-[linear-gradient(transparent_62%,var(--color-marker)_62%)]">{state.value.headline}</span>
            </p>
            <ol className="grid gap-x-6 gap-y-4 md:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
              {state.value.findings.map((f, i) => (
                <li key={f.title} className="border-t-2 border-ink pt-3">
                  <p className="flex gap-2 font-bold">
                    <Num className="text-ink-muted">{String(i + 1).padStart(2, "0")}</Num>
                    {f.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.detail}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-ink-muted">根拠の記録</span>
                    {f.evidenceLogIds.map((id, j) => (
                      <button
                        key={id}
                        className="inline-flex h-6 items-center gap-1 rounded-[3px] border border-line-strong px-1.5 text-[11px] font-medium text-ink hover:border-ink hover:bg-marker-soft"
                        onClick={() => setOpen(byId.get(id) ?? null)}
                      >
                        <Icon name="doc" className="size-3" />
                        {j + 1}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <div className="rounded-[5px] bg-canvas px-4 py-3">
              <p className="text-xs font-bold tracking-wide">明日からの打ち手</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {state.value.actions.map((a) => (
                  <li key={a} className="flex gap-2">
                    <Icon name="arrow-right" className="mt-0.5 text-ink-muted" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-muted">AIの分析は参考情報です。最終的な判断は、記録と現場の様子をあわせてSVが行ってください。</p>
              <button className={btn.ghost} onClick={run} disabled={loading}>
                <Icon name="reset" className="size-3.5" />
                {loading ? "分析しています…" : "もう一度分析する"}
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
                  {leads.find((l) => l.id === open.leadId)?.company}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  <Num>{formatDateTimeJa(open.at)}</Num>・{name(open.memberId)}
                </p>
              </div>
              <Badge tone={open.outcome === "appointment" ? "good" : open.outcome === "rejected" ? "bad" : "neutral"}>{OUTCOME_LABEL[open.outcome]}</Badge>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-medium tracking-wider text-ink-muted">メモ</p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{open.memo}</p>
              {open.insight && (
                <>
                  <p className="mt-3 text-[11px] font-medium tracking-wider text-ink-muted">AIの要約（人が確認済み）</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{open.insight.summary}</p>
                </>
              )}
              <button autoFocus className={`${btn.secondary} mt-5 w-full`} onClick={() => setOpen(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
