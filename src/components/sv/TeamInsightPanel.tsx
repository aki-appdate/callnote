"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import { AiSourceBadge, Badge, btn, Card, CardTitle } from "../ui";
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

  return (
    <Card>
      <CardTitle aside={state && <AiSourceBadge source={state.source} />}>✦ AIによるチームの傾向</CardTitle>
      <div className="px-5 py-4">
        {!state ? (
          <div className="flex flex-wrap items-center gap-3">
            <button className={btn.primary} onClick={run} disabled={loading || logs.length === 0}>
              {loading ? "分析しています…" : "この期間の傾向を分析する"}
            </button>
            <p className="text-sm text-ink-soft">数字と架電メモから、明日の朝会で使える気づきを出します。根拠の記録もあわせて表示します。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {state.note && <p className="text-xs text-ink-soft">{state.note}</p>}
            <p className="text-base font-bold">{state.value.headline}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {state.value.findings.map((f) => (
                <div key={f.title} className="rounded-lg border border-line p-3">
                  <p className="font-medium">{f.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.detail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-ink-muted">根拠：</span>
                    {f.evidenceLogIds.map((id, i) => (
                      <button key={id} className="rounded border border-line px-1.5 text-xs text-brand hover:bg-brand-soft" onClick={() => setOpen(byId.get(id) ?? null)}>
                        記録{i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-sm font-medium">明日からの打ち手</p>
              <ul className="mt-1.5 space-y-1 text-sm text-ink-soft">
                {state.value.actions.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span className="text-brand">→</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-ink-muted">AIの分析は参考情報です。最終的な判断は、記録と現場の様子をあわせてSVが行ってください。</p>
            <button className={btn.ghost} onClick={run} disabled={loading}>
              {loading ? "分析しています…" : "もう一度分析する"}
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{leads.find((l) => l.id === open.leadId)?.company}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {formatDateTimeJa(open.at)}・{name(open.memberId)}
                </p>
              </div>
              <Badge>{OUTCOME_LABEL[open.outcome]}</Badge>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm">{open.memo}</p>
            {open.insight && <p className="mt-2 text-sm text-ink-soft">AI要約：{open.insight.summary}</p>}
            <button className={`${btn.secondary} mt-4 w-full`} onClick={() => setOpen(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
