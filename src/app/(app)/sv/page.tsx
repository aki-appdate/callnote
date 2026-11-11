"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BarList, DailyColumns } from "@/components/sv/Charts";
import { TeamInsightPanel } from "@/components/sv/TeamInsightPanel";
import { Badge, Card, CardTitle, cx, Icon, Num, pct } from "@/components/ui";
import { addDays, formatDateJa, fromDateKey, startOfDay, startOfWeek, toDateKey } from "@/lib/dates";
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
  const gateMax = Math.max(0.01, ...stats.members.map((m) => m.gatekeeperRate), teamGate);
  const daysLate = (iso: string) => Math.round((fromDateKey(toDateKey(now)).getTime() - fromDateKey(toDateKey(new Date(iso))).getTime()) / 86400000);
  const rangeLabel = RANGES.find((r) => r.id === range)!.label;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">
            <Num>{formatDateJa(toDateKey(now))}</Num>・朝会用
          </p>
          <h1 className="mt-0.5 text-xl font-bold">SVダッシュボード</h1>
        </div>
        <div className="flex rounded-[6px] border border-line-strong bg-surface p-0.5" role="tablist" aria-label="集計期間">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={cx(
                "min-h-9 rounded-[4px] px-3.5 text-sm",
                range === r.id ? "bg-ink font-bold text-white" : "text-ink-soft hover:bg-brand-soft hover:text-ink",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 数字の帯：アポを主役に、あとは同じ段で読み比べる */}
      <dl className="grid overflow-hidden rounded-md border border-line bg-surface sm:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="border-b border-line px-5 py-4 sm:border-r sm:border-b-0">
          <dt className="text-xs font-medium text-ink-soft">アポ数（{rangeLabel}）</dt>
          <dd className="mt-1 flex items-baseline gap-3">
            <span className="text-5xl leading-none font-bold tracking-tight">{stats.team.appointments}</span>
            <span className="text-sm text-ink-soft">
              アポ率 <b className="text-ink">{pct(stats.team.appointmentRate)}</b>
            </span>
          </dd>
        </div>
        <Figure label="架電数" value={stats.team.calls.toLocaleString()} unit="件" />
        <Figure label="担当者接続率" value={pct(stats.team.connectRate)} sub={`${stats.team.connects.toLocaleString()}件と会話`} />
        <Figure
          label="予定日を過ぎたフォロー"
          value={stats.overdueFollowups}
          unit="件"
          sub={stats.overdueFollowups ? "全期間・要対応" : "全期間"}
          alert={stats.overdueFollowups > 0}
        />
      </dl>

      <TeamInsightPanel key={range} stats={stats} logs={rangeLogs} />

      <Card>
        <CardTitle
          aside={
            <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <span aria-hidden="true" className="inline-block h-3 w-px bg-ink" />
              受付止まりの縦線＝チーム平均
            </span>
          }
        >
          メンバー別
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-wider text-ink-muted">
                <th className="px-5 py-2 font-medium">メンバー</th>
                <th className="px-4 py-2 text-right font-medium">架電</th>
                <th className="px-4 py-2 text-right font-medium">担当者接続率</th>
                <th className="w-[15rem] px-4 py-2 font-medium">受付止まり</th>
                <th className="px-4 py-2 text-right font-medium">アポ</th>
                <th className="px-5 py-2 text-right font-medium">アポ率</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {stats.members.map((m) => {
                const high = m.calls >= 5 && m.gatekeeperRate > teamGate + 0.05;
                return (
                  <tr key={m.memberId} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="px-5 py-2.5 font-sans font-bold">{name(m.memberId)}</td>
                    <td className="px-4 py-2.5 text-right">{m.calls}</td>
                    <td className="px-4 py-2.5 text-right">{pct(m.connectRate)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="relative h-2 flex-1 rounded-full bg-brand-soft" aria-hidden="true">
                          <span
                            className={cx("absolute inset-y-0 left-0 rounded-full", high ? "bg-warn" : "bg-chart-muted")}
                            style={{ width: `${(m.gatekeeperRate / gateMax) * 100}%` }}
                          />
                          <span className="absolute -inset-y-1 w-px bg-ink" style={{ left: `${(teamGate / gateMax) * 100}%` }} />
                        </span>
                        <span className={cx("w-12 text-right", high && "font-bold text-warn")}>{pct(m.gatekeeperRate)}</span>
                      </div>
                      {high && (
                        <span className="mt-0.5 flex items-center gap-1 font-sans text-[11px] font-bold text-warn">
                          <Icon name="alert" className="size-3" />
                          平均より高い
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">{m.appointments}</td>
                    <td className="px-5 py-2.5 text-right">{pct(m.appointmentRate)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="font-mono tabular-nums">
              <tr className="border-t border-line-strong bg-canvas text-ink-soft">
                <td className="px-5 py-2 font-sans text-xs font-medium">チーム合計</td>
                <td className="px-4 py-2 text-right">{stats.team.calls}</td>
                <td className="px-4 py-2 text-right">{pct(stats.team.connectRate)}</td>
                <td className="px-4 py-2 text-right">平均 {pct(teamGate)}</td>
                <td className="px-4 py-2 text-right">{stats.team.appointments}</td>
                <td className="px-5 py-2 text-right">{pct(stats.team.appointmentRate)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle aside={<span className="text-[11px] text-ink-muted">担当者と話せた電話のみ</span>}>断りの理由</CardTitle>
          <div className="px-5 py-4">
            {objectionRows.some((r) => r.value > 0) ? (
              <BarList rows={objectionRows} />
            ) : (
              <p className="py-6 text-center text-sm text-ink-muted">この期間に担当者から断られた記録はまだありません。</p>
            )}
          </div>
        </Card>
        <Card>
          <CardTitle>日ごとの架電数</CardTitle>
          <div className="px-5 py-4">
            {stats.daily.length > 1 ? (
              <DailyColumns rows={stats.daily} />
            ) : (
              <p className="py-6 text-center text-sm text-ink-muted">
                期間を「今週」以上にすると推移が見られます。今日はここまで<Num className="font-bold text-ink">{stats.team.calls}</Num>件です。
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle aside={<span className="text-[11px] text-ink-muted">古い順に8件</span>}>予定日を過ぎたフォロー</CardTitle>
        {overdue.length ? (
          <ul>
            {overdue.map((l) => (
              <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b border-line px-5 py-2.5 text-sm last:border-0 sm:grid-cols-[1fr_8rem_6rem_7rem]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-bold">{l.company}</span>
                  <Badge>{STATUS_LABEL[l.status]}</Badge>
                </span>
                <span className="text-ink-soft max-sm:order-3 max-sm:text-xs">担当 {name(l.assigneeId)}</span>
                <Num className="text-right text-ink-soft max-sm:hidden">{formatDateJa(toDateKey(new Date(l.nextCallAt!)))}</Num>
                <span className="flex items-center justify-end gap-1 text-right font-bold text-bad">
                  <Icon name="clock" className="size-3.5" />
                  <Num>{daysLate(l.nextCallAt!)}</Num>日超過
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 px-5 py-4 text-sm text-good">
            <Icon name="check" />
            予定日を過ぎたフォローはありません。
          </p>
        )}
      </Card>
    </div>
  );
}

function Figure({ label, value, unit, sub, alert }: { label: string; value: React.ReactNode; unit?: string; sub?: string; alert?: boolean }) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0 sm:border-b-0 sm:[&+&]:border-l">
      <dt className={cx("flex items-center gap-1 text-xs font-medium", alert ? "text-bad" : "text-ink-soft")}>
        {alert && <Icon name="clock" className="size-3.5" />}
        {label}
      </dt>
      <dd className={cx("mt-1.5 text-3xl leading-none font-bold tracking-tight", alert && "text-bad")}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium">{unit}</span>}
      </dd>
      {sub && <dd className="mt-1.5 text-xs text-ink-muted">{sub}</dd>}
    </div>
  );
}
