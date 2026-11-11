"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { LeadList, type ListTab } from "@/components/calls/LeadList";
import { LeadDetail } from "@/components/calls/LeadDetail";
import { Stat } from "@/components/ui";
import { addDays, startOfDay, toDateKey } from "@/lib/dates";
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
    return <p className="text-sm text-ink-soft">SVの方はSVダッシュボードをご利用ください。架電画面はメンバーに切り替えると使えます。</p>;
  }

  const current = lists[tab];
  const selected = leads.find((l) => l.id === selectedId) ?? current[0] ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{me.name}さんの架電</h1>
        <p className="mt-1 text-sm text-ink-soft">電話が終わったら、結果を選んでメモを書くだけ。整理はAIが手伝います。</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="今日の架電" value={myToday?.calls ?? 0} sub="件" />
        <Stat label="担当者と話せた" value={myToday?.connects ?? 0} sub="件" />
        <Stat label="今日のアポ" value={myToday?.appointments ?? 0} sub="件" />
        <Stat label="今日かけるフォロー" value={lists.dueFollowups} sub={`件 残り（ほかに新規 ${lists.today.length - lists.dueFollowups}件）`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
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
        <div id="lead-detail" className="scroll-mt-28">
        {selected ? (
          <LeadDetail key={selected.id} lead={selected} onSaving={() => setSelectedId(selected.id)} onNext={() => { setTab("today"); setSelectedId(null); }} />
        ) : (
          <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">この一覧に案件はありません。</p>
        )}
        </div>
      </div>
    </div>
  );
}
