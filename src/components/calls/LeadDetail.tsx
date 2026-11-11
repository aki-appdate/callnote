"use client";

import { useMemo } from "react";
import { useApp } from "../AppProvider";
import { Badge, Card, CardTitle, Icon, Num } from "../ui";
import { STATUS_LABEL } from "@/lib/labels";
import { formatDateTimeJa, toDateKey } from "@/lib/dates";
import type { Lead } from "@/lib/types";
import { CallRecorder } from "./CallRecorder";
import { CallHistory } from "./CallHistory";

export function LeadDetail({ lead, onSaving, onNext }: { lead: Lead; onSaving: () => void; onNext: () => void }) {
  const { logs } = useApp();
  const history = useMemo(() => logs.filter((l) => l.leadId === lead.id), [logs, lead.id]);
  const overdue = !!lead.nextCallAt && toDateKey(new Date(lead.nextCallAt)) < toDateKey(new Date());

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">{lead.company}</h2>
              <Badge tone={lead.status === "appointment" ? "good" : "neutral"}>{STATUS_LABEL[lead.status]}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">
              {lead.industry}・{lead.prefecture}・従業員<Num>{lead.employees}</Num>名
            </p>
          </div>
          <div className="sm:text-right">
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-2 rounded-[5px] font-mono text-xl font-bold tracking-tight text-ink tabular-nums"
              onClick={(e) => e.preventDefault()}
              title="デモのため発信はしません"
            >
              <Icon name="phone" className="size-5" />
              {lead.phone}
            </a>
            <p className="text-[11px] text-ink-muted">デモ用の架空の番号です（発信しません）</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-line text-sm sm:grid-cols-4">
          <Item label="提案商材" value={lead.product} />
          <Item label="担当者" value={lead.contactName ?? "未確認"} muted={!lead.contactName} />
          <Item
            label="次の予定"
            value={lead.nextCallAt ? <Num className={overdue ? "font-bold text-bad" : undefined}>{formatDateTimeJa(lead.nextCallAt)}</Num> : "なし"}
            note={overdue ? "予定日を過ぎています" : undefined}
          />
          <Item label="これまでの架電" value={<><Num>{history.length}</Num>回</>} />
        </dl>
      </Card>

      {lead.status !== "appointment" && lead.status !== "lost" ? (
        <CallRecorder lead={lead} history={history} onSaving={onSaving} onNext={onNext} />
      ) : (
        <Card>
          <p className="flex items-center gap-2 px-5 py-4 text-sm text-ink-soft">
            <Icon name="flag" />
            この案件は「{STATUS_LABEL[lead.status]}」です。新しい架電の記録はできません。
          </p>
        </Card>
      )}

      <Card>
        <CardTitle aside={<span className="text-[11px] text-ink-muted">新しい順</span>}>架電の履歴</CardTitle>
        <CallHistory logs={history} />
      </Card>
    </div>
  );
}

function Item({ label, value, muted, note }: { label: string; value: React.ReactNode; muted?: boolean; note?: string }) {
  return (
    <div className="border-line px-5 py-2.5 max-sm:[&:nth-child(-n+2)]:border-b sm:[&+&]:border-l max-sm:[&:nth-child(even)]:border-l">
      <dt className="text-[11px] font-medium tracking-wider text-ink-muted">{label}</dt>
      <dd className={muted ? "mt-0.5 text-ink-muted" : "mt-0.5 text-ink"}>{value}</dd>
      {note && <dd className="text-[11px] font-medium text-bad">{note}</dd>}
    </div>
  );
}
