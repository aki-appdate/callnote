"use client";

import { useApp } from "../AppProvider";
import { AiSourceBadge, Badge } from "../ui";
import { OBJECTION_LABEL, OUTCOME_LABEL, TEMPERATURE_LABEL } from "@/lib/labels";
import { formatDateJa, formatDateTimeJa } from "@/lib/dates";
import type { CallLog } from "@/lib/types";

export function CallHistory({ logs }: { logs: CallLog[] }) {
  const { members } = useApp();
  if (logs.length === 0) return <p className="px-5 py-6 text-sm text-ink-muted">まだ架電の記録はありません。</p>;

  return (
    <ol className="divide-y divide-line">
      {[...logs].reverse().map((l) => (
        <li key={l.id} id={l.id} className="px-5 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span className="tabular-nums">{formatDateTimeJa(l.at)}</span>
            <span>{members.find((m) => m.id === l.memberId)?.name}</span>
            <Badge tone={l.outcome === "appointment" ? "good" : l.outcome === "rejected" ? "bad" : "neutral"}>{OUTCOME_LABEL[l.outcome]}</Badge>
            {l.aiSource && <AiSourceBadge source={l.aiSource} />}
            {l.editedFields.length > 0 && <Badge tone="warn">人が修正：{l.editedFields.length}項目</Badge>}
          </div>
          <p className="mt-1.5 text-sm text-ink">{l.insight?.summary ?? l.memo}</p>
          {l.insight && (
            <p className="mt-1 text-xs text-ink-soft">
              温度感：{TEMPERATURE_LABEL[l.insight.temperature]}
              {l.insight.objection !== "none" && ` ／ 断り：${OBJECTION_LABEL[l.insight.objection]}`}
              {l.insight.nextAction.date && ` ／ 次回：${formatDateJa(l.insight.nextAction.date)}`}
            </p>
          )}
          {l.insight && l.memo !== l.insight.summary && (
            <details className="mt-1 text-xs text-ink-muted">
              <summary className="cursor-pointer">元のメモ</summary>
              <p className="mt-1 whitespace-pre-wrap">{l.memo}</p>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
