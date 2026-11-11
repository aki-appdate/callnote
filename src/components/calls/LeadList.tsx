"use client";

import { useMemo, useState } from "react";
import { STATUS_LABEL } from "@/lib/labels";
import { formatDateJa, toDateKey } from "@/lib/dates";
import type { Lead } from "@/lib/types";
import { Badge, Card, cx, Icon, Num } from "../ui";

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
    <Card className="flex max-h-[calc(100vh-12rem)] min-h-80 flex-col overflow-hidden max-lg:max-h-[28rem]">
      <div className="grid grid-cols-3 border-b border-line" role="tablist" aria-label="案件の一覧">
        {TABS.map((t) => {
          const on = props.tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => props.onTab(t.id)}
              className={cx(
                "relative flex flex-col items-center gap-0.5 px-2 py-2 text-xs",
                on ? "font-bold text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
              <Num className={cx("text-base leading-none", on ? "text-ink" : "text-ink-soft")}>{props.counts[t.id].toLocaleString()}</Num>
              {on && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-ink" />}
            </button>
          );
        })}
      </div>
      <div className="relative border-b border-line px-3 py-2">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-ink-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="会社名・業種・地域で絞り込み"
          aria-label="会社名・業種・地域で絞り込み"
          className="h-9 w-full rounded-[5px] border border-line bg-canvas pr-3 pl-8 text-sm placeholder:text-ink-muted focus:bg-surface"
        />
      </div>
      {q && (
        <p className="border-b border-line px-4 py-1.5 text-[11px] text-ink-muted" aria-live="polite">
          「{q}」で絞り込み：<Num>{filtered.length}</Num>件
        </p>
      )}
      <ul className="flex-1 overflow-y-auto overscroll-contain">
        {filtered.map((l) => {
          const overdue = !!l.nextCallAt && toDateKey(new Date(l.nextCallAt)) < today;
          const selected = props.selectedId === l.id;
          return (
            <li key={l.id} className="border-b border-line last:border-b-0">
              <button
                onClick={() => props.onSelect(l.id)}
                aria-current={selected ? "true" : undefined}
                className={cx(
                  "relative block w-full py-2.5 pr-4 pl-5 text-left",
                  selected ? "bg-marker-soft" : "hover:bg-canvas",
                )}
              >
                {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-marker" />}
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-ink">{l.company}</span>
                  <Badge tone={l.status === "appointment" ? "good" : l.status === "new" ? "outline" : "neutral"}>{STATUS_LABEL[l.status]}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-ink-muted">
                  <span className="min-w-0 truncate">
                    {l.industry}・{l.prefecture}・{l.product}
                  </span>
                  {l.nextCallAt && (
                    <span className={cx("ml-auto flex shrink-0 items-center gap-1", overdue && "font-bold text-bad")}>
                      {overdue && <Icon name="clock" className="size-3.5" />}
                      {overdue && <span>超過</span>}
                      <Num>{formatDateJa(toDateKey(new Date(l.nextCallAt)))}</Num>
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-6 py-10 text-center text-sm text-ink-muted">
            {q ? "条件に合う案件はありません。言葉を変えてみてください。" : "この一覧に案件はありません。"}
          </li>
        )}
      </ul>
    </Card>
  );
}
