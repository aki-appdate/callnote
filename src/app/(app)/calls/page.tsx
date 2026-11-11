"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { LeadList, type ListTab } from "@/components/calls/LeadList";
import { LeadDetail } from "@/components/calls/LeadDetail";
import { Num } from "@/components/ui";
import { addDays, formatDateJa, startOfDay, toDateKey } from "@/lib/dates";
import { computeTeamStats } from "@/lib/kpi";

export default function CallsPage() {
  const { me, leads, logs, members } = useApp();
  const [tab, setTab] = useState<ListTab>("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const myLeads = useMemo(() => leads.filter((l) => l.assigneeId === me?.id), [leads, me]);
  const todayKey = toDateKey(new Date());

  const lists = useMemo(() => {
    const due = myLeads
      .filter(
        (l) =>
          (l.status === "new" || l.status === "calling" || l.status === "followup") &&
          (l.nextCallAt === null || toDateKey(new Date(l.nextCallAt)) <= todayKey),
      )
      .sort((a, b) => (a.nextCallAt ?? "9").localeCompare(b.nextCallAt ?? "9"));
    return {
      today: due,
      dueFollowups: due.filter((l) => l.status !== "new").length,
      open: myLeads.filter((l) => l.status !== "appointment" && l.status !== "lost"),
      won: myLeads.filter((l) => l.status === "appointment"),
    };
  }, [myLeads, todayKey]);

  const myToday = useMemo(() => {
    if (!me) return null;
    const now = new Date();
    return computeTeamStats({ logs, members, leads, from: startOfDay(now), to: addDays(startOfDay(now), 1), now }).members.find(
      (m) => m.memberId === me.id,
    );
  }, [logs, members, leads, me]);

  if (!me) return null;
  if (me.role === "sv") {
    return (
      <p className="rounded-md border border-line bg-surface p-6 text-sm text-ink-soft">
        SVの方はSVダッシュボードをご利用ください。架電画面は、右上の「利用者」でメンバーに切り替えると使えます。
      </p>
    );
  }

  const current = lists[tab];
  const selected = leads.find((l) => l.id === selectedId) ?? current[0] ?? null;
  const newCount = lists.today.length - lists.dueFollowups;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-xs text-ink-muted">
            <Num>{formatDateJa(todayKey)}</Num>
          </p>
          <h1 className="mt-0.5 text-xl font-bold">{me.name}さんの架電</h1>
        </div>

        {/* 今日の数字：これからやること（左）と、ここまでの実績（右） */}
        <dl className="flex w-full flex-wrap items-stretch rounded-md border border-line bg-surface sm:w-auto">
          <div className="flex items-baseline gap-2 border-b border-line bg-marker-soft px-4 py-2.5 max-sm:w-full sm:border-r sm:border-b-0">
            <dt className="text-xs font-medium text-ink">残りのフォロー</dt>
            <dd className="text-2xl leading-none font-bold">{lists.dueFollowups}</dd>
            <dd className="text-xs text-ink-soft">件・ほかに新規 {newCount.toLocaleString()}件</dd>
          </div>
          <Tally label="今日の架電" value={myToday?.calls ?? 0} />
          <Tally label="話せた" value={myToday?.connects ?? 0} />
          <Tally label="アポ" value={myToday?.appointments ?? 0} />
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <LeadList
          tab={tab}
          onTab={setTab}
          counts={{ today: lists.today.length, open: lists.open.length, won: lists.won.length }}
          leads={current}
          selectedId={selected?.id ?? null}
          onSelect={(id) => {
            setSelectedId(id);
            // スマホでは一覧の下に詳細が出るので、選んだら詳細までスクロールする
            if (window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById("lead-detail")?.scrollIntoView({ behavior: "smooth" }));
          }}
        />
        <div id="lead-detail" className="min-w-0 scroll-mt-28">
          {selected ? (
            <LeadDetail key={selected.id} lead={selected} onSaving={() => setSelectedId(selected.id)} onNext={() => { setTab("today"); setSelectedId(null); }} />
          ) : (
            <div className="rounded-md border border-dashed border-line-strong p-10 text-center">
              <p className="font-bold">この一覧に案件はありません</p>
              <p className="mt-1 text-sm text-ink-muted">ほかのタブ（担当中・アポ済み）を見てみてください。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 items-baseline justify-center gap-1.5 px-3 py-2.5 whitespace-nowrap sm:px-4 sm:flex-none [&+&]:border-l [&+&]:border-line">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-lg leading-none font-bold">{value}</dd>
    </div>
  );
}
