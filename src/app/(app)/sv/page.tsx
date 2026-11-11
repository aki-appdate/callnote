"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BarList, DailyColumns } from "@/components/sv/Charts";
import { TeamInsightPanel } from "@/components/sv/TeamInsightPanel";
import { Badge, Card, CardTitle, cx, pct, Stat } from "@/components/ui";
import { addDays, formatDateJa, startOfDay, startOfWeek, toDateKey } from "@/lib/dates";
import { computeTeamStats, filterLogsByRange } from "@/lib/kpi";
import { OBJECTION_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { Objection } from "@/lib/types";

type Range = "today" | "week" | "2weeks";
const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "week", label: "今週" },
  { id: "2weeks", label: "直近2週間" },
];

export default function SvPage() {
  const { logs, members, leads } = useApp();
  const [range, setRange] = useState<Range>("week");

  const { from, to, now } = useMemo(() => {
    const now = new Date();
    const end = addDays(startOfDay(now), 1);
    const start = range === "today" ? startOfDay(now) : range === "week" ? startOfWeek(now) : addDays(startOfDay(now), -13);
    return { from: start, to: end, now };
  }, [range]);

  const stats = useMemo(() => computeTeamStats({ logs, members, leads, from, to, now }), [logs, members, leads, from, to, now]);
  const rangeLogs = useMemo(() => filterLogsByRange(logs, from, to), [logs, from, to]);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;

  const objectionRows = useMemo(
    () =>
      (Object.keys(OBJECTION_LABEL) as Objection[])
        .filter((k) => k !== "none")
        .map((k) => ({ label: OBJECTION_LABEL[k], value: stats.objections[k] }))
        .sort((a, b) => b.value - a.value),
    [stats],
  );

  const overdue = useMemo(() => {
    const today = toDateKey(now);
    return leads
      .filter((l) => l.nextCallAt && (l.status === "followup" || l.status === "calling") && toDateKey(new Date(l.nextCallAt)) < today)
      .sort((a, b) => a.nextCallAt!.localeCompare(b.nextCallAt!))
      .slice(0, 8);
  }, [leads, now]);

  const teamGate = stats.team.gatekeeperRate;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">SVダッシュボード</h1>
          <p className="mt-1 text-sm text-ink-soft">チームの数字と、つまずいているポイントを確認できます。</p>
        </div>
        <div className="flex rounded-lg border border-line bg-surface p-0.5" role="tablist" aria-label="集計期間">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={cx("rounded-md px-3 py-1.5 text-sm", range === r.id ? "bg-brand text-white" : "text-ink-soft hover:bg-canvas")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="架電数" value={stats.team.calls.toLocaleString()} sub="件" />
        <Stat label="担当者接続率" value={pct(stats.team.connectRate)} sub={`${stats.team.connects}件と会話`} />
        <Stat label="アポ数" value={stats.team.appointments} sub={`アポ率 ${pct(stats.team.appointmentRate)}`} />
        <Stat
          label="予定日を過ぎたフォロー"
          value={<span className={stats.overdueFollowups ? "text-bad" : undefined}>{stats.overdueFollowups}</span>}
          sub="件（全期間）"
        />
      </div>

      <TeamInsightPanel key={range} stats={stats} logs={rangeLogs} />

      <Card>
        <CardTitle>メンバー別</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-4 py-2 font-medium">メンバー</th>
                <th className="px-4 py-2 text-right font-medium">架電</th>
                <th className="px-4 py-2 text-right font-medium">担当者接続率</th>
                <th className="px-4 py-2 text-right font-medium">受付止まり</th>
                <th className="px-4 py-2 text-right font-medium">アポ</th>
                <th className="px-4 py-2 text-right font-medium">アポ率</th>
              </tr>
            </thead>
            <tbody>
              {stats.members.map((m) => (
                <tr key={m.memberId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium">{name(m.memberId)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.calls}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(m.connectRate)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {m.calls >= 5 && m.gatekeeperRate > teamGate + 0.05 && <Badge tone="warn">平均より高い</Badge>} {pct(m.gatekeeperRate)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.appointments}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(m.appointmentRate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-canvas text-ink-soft">
                <td className="px-4 py-2 text-xs">チーム合計</td>
                <td className="px-4 py-2 text-right tabular-nums">{stats.team.calls}</td>
                <td className="px-4 py-2 text-right tabular-nums">{pct(stats.team.connectRate)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{pct(teamGate)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{stats.team.appointments}</td>
                <td className="px-4 py-2 text-right tabular-nums">{pct(stats.team.appointmentRate)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle aside={<span className="text-xs text-ink-muted">担当者と話せた電話のみ</span>}>断りの理由</CardTitle>
          <div className="px-5 py-4">
            {objectionRows.some((r) => r.value > 0) ? (
              <BarList rows={objectionRows} />
            ) : (
              <p className="text-sm text-ink-muted">この期間に担当者から断られた記録はまだありません。</p>
            )}
          </div>
        </Card>
        <Card>
          <CardTitle>日ごとの架電数</CardTitle>
          <div className="px-5 py-4">
            {stats.daily.length > 1 ? (
              <DailyColumns rows={stats.daily} />
            ) : (
              <p className="text-sm text-ink-muted">期間を「今週」以上にすると推移が見られます。今日は{stats.team.calls}件です。</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle aside={<span className="text-xs text-ink-muted">古い順に8件</span>}>予定日を過ぎたフォロー</CardTitle>
        {overdue.length ? (
          <ul className="divide-y divide-line">
            {overdue.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                <span className="font-medium">{l.company}</span>
                <Badge>{STATUS_LABEL[l.status]}</Badge>
                <span className="text-ink-soft">担当：{name(l.assigneeId)}</span>
                <span className="ml-auto tabular-nums text-bad">予定 {formatDateJa(toDateKey(new Date(l.nextCallAt!)))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-ink-muted">予定日を過ぎたフォローはありません。</p>
        )}
      </Card>
    </div>
  );
}
