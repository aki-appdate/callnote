"use client";

import { useState } from "react";
import { formatDateJa } from "@/lib/dates";
import { cx } from "../ui";

// グラフの決まり（docs/design.md）：1系列は1色。棒は24px以下で先端だけ4px丸め。
// 目盛り線は1pxの実線。値の文字は文字色で書く。どのグラフにも「表で見る」を付ける。

/** 横棒：断り理由の内訳など。一番大きい棒だけ濃く（強調）、残りは薄いグレー。値は棒の先に書く */
export function BarList({ rows, unit = "件", emphasizeTop = true }: { rows: { label: string; value: number }[]; unit?: string; emphasizeTop?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <figure>
      <ul className="space-y-2">
        {rows.map((r, i) => {
          const top = emphasizeTop && i === 0 && r.value > 0;
          return (
            <li
              key={r.label}
              className="grid grid-cols-[minmax(0,8.5rem)_1fr] items-center gap-3 text-sm"
              title={`${r.label}：${r.value}${unit}（${share(r.value)}%）`}
            >
              <span className={cx("truncate", top ? "font-bold text-ink" : "text-ink-soft")}>{r.label}</span>
              <div className="flex items-center gap-2">
                <div
                  className={cx("h-3.5 rounded-r-[4px]", top ? "bg-chart" : "bg-chart-muted")}
                  style={{ width: `${(r.value / max) * 82}%`, minWidth: r.value ? 3 : 0 }}
                />
                <span className="font-mono text-xs whitespace-nowrap text-ink tabular-nums">
                  {r.value}
                  {unit}
                  <span className="ml-1 text-ink-muted">{share(r.value)}%</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <TableView
        head={["項目", "件数", "割合"]}
        rows={rows.map((r) => [r.label, `${r.value}${unit}`, `${share(r.value)}%`])}
      />
    </figure>
  );
}

/** 縦棒：日ごとの架電数。カーソルやキーボードで合わせると、その日の数字が出る */
export function DailyColumns({ rows }: { rows: { date: string; calls: number; appointments: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.calls));
  const step = max > 100 ? 50 : max > 40 ? 20 : 10;
  const nice = Math.ceil(max / step) * step;
  const h = 150;
  const ticks = [nice, nice / 2, 0];
  const total = rows.reduce((s, r) => s + r.calls, 0);
  const peak = rows.reduce((a, r) => (r.calls > a.calls ? r : a), rows[0]);

  return (
    <figure>
      <p className="mb-3 flex flex-wrap gap-x-4 text-xs text-ink-soft">
        <span>
          合計 <b className="font-mono text-ink tabular-nums">{total.toLocaleString()}</b>件
        </span>
        <span>
          最多 <b className="font-mono text-ink tabular-nums">{formatDateJa(peak.date).replace(/（.）/, "")}</b>の
          <b className="font-mono text-ink tabular-nums">{peak.calls}</b>件
        </span>
      </p>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right font-mono text-[11px] leading-none text-ink-muted tabular-nums" style={{ height: h }}>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height: h }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - t / nice) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {rows.map((r, i) => (
                <div
                  key={r.date}
                  className="flex h-full flex-1 cursor-default items-end justify-center rounded-sm outline-offset-0"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${formatDateJa(r.date)} 架電${r.calls}件 アポ${r.appointments}件`}
                >
                  <div
                    className={cx("w-full max-w-6 rounded-t-[4px] transition-colors", hover === i ? "bg-ink" : "bg-chart")}
                    style={{ height: `${(r.calls / nice) * 100}%`, minHeight: r.calls ? 2 : 0 }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex gap-[2px] font-mono text-[11px] text-ink-muted tabular-nums">
            {rows.map((r, i) => (
              <span key={r.date} className="flex-1 text-center whitespace-nowrap">
                {i % Math.ceil(rows.length / 7) === 0 || i === rows.length - 1 ? formatDateJa(r.date).replace(/（.）/, "") : ""}
              </span>
            ))}
          </div>
          {hover !== null && rows[hover] && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-[5px] bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-md"
              style={{ left: `${((hover + 0.5) / rows.length) * 100}%` }}
            >
              <div className="font-mono text-sm font-bold tabular-nums">
                {rows[hover].calls}件 <span className="text-xs font-normal text-console-text">アポ {rows[hover].appointments}件</span>
              </div>
              <div className="text-console-text">{formatDateJa(rows[hover].date)}</div>
            </div>
          )}
        </div>
      </div>
      <TableView
        head={["日付", "架電", "アポ"]}
        rows={rows.map((r) => [formatDateJa(r.date), `${r.calls}件`, `${r.appointments}件`])}
      />
    </figure>
  );
}

/** グラフと同じ数字を表で読む（色や形に頼らずに読めるように） */
function TableView({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <details className="group mt-4 text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-ink-muted select-none hover:text-ink">
        表で見る
      </summary>
      <table className="mt-2 w-full">
        <thead>
          <tr className="border-b border-line text-left text-ink-muted">
            {head.map((h, i) => (
              <th key={h} className={cx("py-1 font-medium", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-line last:border-0">
              {r.map((c, i) => (
                <td key={i} className={cx("py-1", i > 0 && "text-right font-mono tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
