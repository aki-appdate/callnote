"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BarList, DailyColumns } from "@/components/sv/Charts";
import { TeamInsightPanel } from "@/components/sv/TeamInsightPanel";
import { Badge, Card, CardTitle, cx, Hl, Icon, Num, pct } from "@/components/ui";
import { MEMBER_MIN_CALLS, TEAM_MIN_CALLS } from "@/lib/ai/sample";
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

function rangeBounds(range: Range, now: Date): { from: Date; to: Date } {
  const to = addDays(startOfDay(now), 1);
  const from = range === "today" ? startOfDay(now) : range === "week" ? startOfWeek(now) : addDays(startOfDay(now), -13);
  return { from, to };
}

export default function SvPage() {
  const { logs, members, leads } = useApp();
  // 月曜の朝など「今週」の記録がまだ少ないときは、最初から直近2週間を見せる（空の画面で朝会を始めない）
  const [weekWasThin] = useState(() => {
    const { from, to } = rangeBounds("week", new Date());
    return filterLogsByRange(logs, from, to).length < TEAM_MIN_CALLS;
  });
  const [range, setRange] = useState<Range>(weekWasThin ? "2weeks" : "week");

  const { from, to, now } = useMemo(() => {
    const now = new Date();
    return { ...rangeBounds(range, now), now };
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
      .sort((a, b) => a.nextCallAt!.localeCompare(b.nextCallAt!));
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
      {weekWasThin && range === "2weeks" && (
        <p className="-mt-2 text-xs text-ink-soft">
          今週はまだ記録が少ない（{TEAM_MIN_CALLS}件未満）ため、直近2週間で表示しています。
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {/* 右の欄：紙の集計欄のように、数字を縦に読み下す。その下に、今日片づけるフォロー */}
        <aside className="max-lg:contents lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:space-y-5">
          <section aria-labelledby="tally" className="rounded-md border border-line bg-surface px-5 pt-4 pb-3 max-lg:order-1">
            <h2 id="tally" className="flex items-baseline justify-between border-b-2 border-ink pb-2 text-base font-bold">
              集計<span className="text-xs font-normal text-ink-muted">{rangeLabel}</span>
            </h2>
            <dl className="text-sm">
              <div className="flex items-end justify-between border-b border-line py-3">
                <dt className="font-medium">アポ数</dt>
                <dd className="text-right">
                  <Hl className="text-4xl leading-none font-bold tracking-tight">{stats.team.appointments}</Hl>
                  <span className="ml-1 text-sm">件</span>
                </dd>
              </div>
              <Tally label="アポ率" value={pct(stats.team.appointmentRate)} note="目安 2%" />
              <Tally label="架電数" value={`${stats.team.calls.toLocaleString()}件`} />
              <Tally label="担当者接続率" value={pct(stats.team.connectRate)} note={`${stats.team.connects.toLocaleString()}件と会話`} />
              <Tally
                label="予定日を過ぎたフォロー"
                value={`${stats.overdueFollowups}件`}
                note="期間に関係なく全件"
                alert={stats.overdueFollowups > 0}
              />
            </dl>
          </section>

          <Card className="max-lg:order-3">
            <CardTitle aside={<span className="text-[11px] text-ink-muted">{overdue.length ? `全${overdue.length}件・古い順` : ""}</span>}>
              予定日を過ぎたフォロー
            </CardTitle>
            {overdue.length ? (
              <ul className="max-h-[22rem] overflow-y-auto overscroll-contain">
                {overdue.map((l) => (
                  <li key={l.id} className="border-b border-line px-4 py-2 text-sm last:border-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate font-bold">{l.company}</span>
                      <span className="flex shrink-0 items-center gap-1 font-bold text-bad">
                        <Icon name="clock" className="size-3.5 self-center" />
                        <Num>{daysLate(l.nextCallAt!)}</Num>日超過
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                      <Badge>{STATUS_LABEL[l.status]}</Badge>
                      <span>担当 {name(l.assigneeId)}</span>
                      <Num className="ml-auto text-ink-muted">予定 {formatDateJa(toDateKey(new Date(l.nextCallAt!)))}</Num>
                    </div>
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
        </aside>

        <div className="min-w-0 max-lg:order-2 lg:col-start-1 lg:row-start-1">
          <TeamInsightPanel key={range} stats={stats} logs={rangeLogs} />
        </div>

        <div className="min-w-0 max-lg:order-4 lg:col-start-1">
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
                    const high = m.calls >= MEMBER_MIN_CALLS && m.gatekeeperRate > teamGate + 0.05;
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

        </div>

        <div className="min-w-0 max-lg:order-5 lg:col-start-1">
          <div className="grid gap-5 xl:grid-cols-2">
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
                    期間を「今週」か「直近2週間」にすると、日ごとの推移が見られます。今日はここまで<Num className="font-bold text-ink">{stats.team.calls}</Num>件です。
                  </p>
                )}
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}

function Tally({ label, value, note, alert }: { label: string; value: string; note?: string; alert?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className={cx(alert ? "font-bold text-bad" : "text-ink-soft")}>
        <span className="flex items-center gap-1">
          {alert && <Icon name="clock" className="size-3.5" />}
          {label}
        </span>
        {note && <span className="block text-[11px] font-normal text-ink-muted">{note}</span>}
      </dt>
      <dd className={cx("font-mono text-lg font-bold whitespace-nowrap tabular-nums", alert && "text-bad")}>{value}</dd>
    </div>
  );
}
