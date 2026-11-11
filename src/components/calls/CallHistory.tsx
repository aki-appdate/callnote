"use client";

import { useApp } from "../AppProvider";
import { AiSourceBadge, Badge, Num } from "../ui";
import { OBJECTION_LABEL, OUTCOME_LABEL, TEMPERATURE_LABEL } from "@/lib/labels";
import { formatDateJa, formatDateTimeJa } from "@/lib/dates";
import type { CallLog } from "@/lib/types";

export function CallHistory({ logs }: { logs: CallLog[] }) {
  const { members } = useApp();
  if (logs.length === 0)
    return <p className="px-5 py-6 text-sm text-ink-muted">まだ架電の記録はありません。最初の電話の結果を、上の欄から記録できます。</p>;

  return (
    <ol>
      {[...logs].reverse().map((l) => (
        <li key={l.id} id={l.id} className="grid gap-x-4 gap-y-1 border-b border-line px-5 py-3 last:border-b-0 sm:grid-cols-[8.5rem_1fr]">
          <div className="text-xs text-ink-muted">
            <Num className="block text-ink-soft">{formatDateTimeJa(l.at)}</Num>
            <span>{members.find((m) => m.id === l.memberId)?.name}</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={l.outcome === "appointment" ? "good" : l.outcome === "rejected" ? "bad" : "neutral"}>{OUTCOME_LABEL[l.outcome]}</Badge>
              {l.aiSource && <AiSourceBadge source={l.aiSource} />}
              {l.editedFields.length > 0 && <Badge tone="warn">人が修正 {l.editedFields.length}項目</Badge>}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{l.insight?.summary ?? l.memo}</p>
            {l.insight && (
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-soft">
                <span>温度感：{TEMPERATURE_LABEL[l.insight.temperature]}</span>
                {l.insight.objection !== "none" && <span>断り：{OBJECTION_LABEL[l.insight.objection]}</span>}
                {l.insight.nextAction.date && (
                  <span>
                    次回：<Num>{formatDateJa(l.insight.nextAction.date)}</Num>
                  </span>
                )}
              </p>
            )}
            {l.insight && l.memo !== l.insight.summary && (
              <details className="mt-1 text-xs text-ink-muted">
                <summary className="cursor-pointer select-none hover:text-ink">元のメモ</summary>
                <p className="mt-1 border-l-2 border-line pl-3 whitespace-pre-wrap">{l.memo}</p>
              </details>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
