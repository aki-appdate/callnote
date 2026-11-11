"use client";

import { useMemo, useState } from "react";
import { STATUS_LABEL } from "@/lib/labels";
import { formatDateJa, toDateKey } from "@/lib/dates";
import type { Lead } from "@/lib/types";
import { Badge, Card, cx } from "../ui";

export type ListTab = "today" | "open" | "won";

const TABS: { id: ListTab; label: string }[] = [
  { id: "today", label: "今日かける" },
  { id: "open", label: "担当中" },
  { id: "won", label: "アポ済み" },
];

export function LeadList(props: {
  tab: ListTab;
  onTab: (t: ListTab) => void;
  counts: Record<ListTab, number>;
  leads: Lead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => (q ? props.leads.filter((l) => `${l.company}${l.industry}${l.prefecture}`.includes(q)) : props.leads),
    [props.leads, q],
  );
  const today = toDateKey(new Date());

  return (
    <Card className="flex max-h-[calc(100vh-14rem)] min-h-80 flex-col overflow-hidden">
      <div className="flex border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={props.tab === t.id}
            onClick={() => props.onTab(t.id)}
            className={cx(
              "flex-1 border-b-2 px-2 py-2.5 text-sm",
              props.tab === t.id ? "border-brand font-medium text-brand-strong" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
            <span className="ml-1 text-xs tabular-nums text-ink-muted">{props.counts[t.id]}</span>
          </button>
        ))}
      </div>
      <div className="border-b border-line p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="会社名・業種・地域で絞り込み"
          className="w-full rounded-md border border-line px-3 py-1.5 text-sm placeholder:text-ink-muted"
        />
      </div>
      <ul className="flex-1 overflow-y-auto">
        {filtered.map((l) => {
          const overdue = l.nextCallAt && toDateKey(new Date(l.nextCallAt)) < today;
          return (
            <li key={l.id}>
              <button
                onClick={() => props.onSelect(l.id)}
                className={cx(
                  "w-full border-b border-line px-4 py-3 text-left hover:bg-canvas",
                  props.selectedId === l.id && "bg-brand-soft hover:bg-brand-soft",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-ink">{l.company}</span>
                  <Badge tone={l.status === "appointment" ? "good" : l.status === "new" ? "brand" : "neutral"}>{STATUS_LABEL[l.status]}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                  <span>{l.industry}</span>
                  <span>・{l.prefecture}</span>
                  <span>・{l.product}</span>
                  {l.nextCallAt && (
                    <span className={cx("ml-auto", overdue && "font-medium text-bad")}>
                      {overdue ? "予定超過 " : ""}
                      {formatDateJa(toDateKey(new Date(l.nextCallAt)))}
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="p-6 text-center text-sm text-ink-muted">該当する案件はありません</li>}
      </ul>
    </Card>
  );
}
