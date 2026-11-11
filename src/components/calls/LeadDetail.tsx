"use client";

import { useMemo } from "react";
import { useApp } from "../AppProvider";
import { Badge, Card, CardTitle } from "../ui";
import { STATUS_LABEL } from "@/lib/labels";
import { formatDateTimeJa } from "@/lib/dates";
import type { Lead } from "@/lib/types";
import { CallRecorder } from "./CallRecorder";
import { CallHistory } from "./CallHistory";

export function LeadDetail({ lead, onSaving, onNext }: { lead: Lead; onSaving: () => void; onNext: () => void }) {
  const { logs } = useApp();
  const history = useMemo(() => logs.filter((l) => l.leadId === lead.id), [logs, lead.id]);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{lead.company}</h2>
              <Badge tone={lead.status === "appointment" ? "good" : "neutral"}>{STATUS_LABEL[lead.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {lead.industry}・{lead.prefecture}・従業員{lead.employees}名
            </p>
          </div>
          <div className="text-right">
            <a href={`tel:${lead.phone}`} className="text-lg font-bold tabular-nums text-brand" onClick={(e) => e.preventDefault()} title="デモのため発信はしません">
              {lead.phone}
            </a>
            <p className="text-xs text-ink-muted">デモ用の架空の番号です</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line px-5 py-3 text-sm sm:grid-cols-4">
          <Item label="提案商材" value={lead.product} />
          <Item label="担当者" value={lead.contactName ?? "未確認"} />
          <Item label="次の予定" value={lead.nextCallAt ? formatDateTimeJa(lead.nextCallAt) : "なし"} />
          <Item label="これまでの架電" value={`${history.length}回`} />
        </dl>
      </Card>

      {lead.status !== "appointment" && lead.status !== "lost" ? (
        <CallRecorder lead={lead} history={history} onSaving={onSaving} onNext={onNext} />
      ) : (
        <Card>
          <p className="px-5 py-4 text-sm text-ink-soft">
            この案件は「{STATUS_LABEL[lead.status]}」です。新しい架電の記録はできません。
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>架電の履歴</CardTitle>
        <CallHistory logs={history} />
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
