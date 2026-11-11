"use client";

import { useState } from "react";
import { formatDateJa } from "@/lib/dates";

// 単一系列のグラフだけなので、色はブランド色1つ。値の文字は文字色で書く。

/** 横棒：断り理由の内訳など。値は棒の先に書く */
export function BarList({ rows, unit = "件" }: { rows: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8.5rem_1fr] items-center gap-3 text-sm" title={`${r.label}：${r.value}${unit}（${total ? Math.round((r.value / total) * 100) : 0}%）`}>
          <span className="truncate text-ink-soft">{r.label}</span>
          <div className="flex items-center gap-2">
            <div className="h-4 rounded-r bg-brand" style={{ width: `${(r.value / max) * 85}%`, minWidth: r.value ? 4 : 0 }} />
            <span className="tabular-nums text-xs text-ink">
              {r.value}
              {unit}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 縦棒：日ごとの架電数。カーソルを合わせると数字が出る */
export function DailyColumns({ rows }: { rows: { date: string; calls: number; appointments: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.calls));
  const nice = Math.ceil(max / 20) * 20;
  const h = 140;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex h-[140px] flex-col justify-between text-right text-[11px] tabular-nums text-ink-muted">
          <span>{nice}</span>
          <span>{nice / 2}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 border-t border-line" />
          <div className="absolute inset-x-0 top-1/2 border-t border-line" />
          <div className="absolute inset-x-0 bottom-0 border-t border-line" />
          <div className="relative flex h-[140px] items-end justify-around gap-[2px]">
            {rows.map((r, i) => (
              <div
                key={r.date}
                className="flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${formatDateJa(r.date)} 架電${r.calls}件 アポ${r.appointments}件`}
              >
                <div
                  className="w-full max-w-6 rounded-t bg-brand transition-opacity"
                  style={{ height: `${(r.calls / nice) * h}px`, opacity: hover === null || hover === i ? 1 : 0.45 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-around gap-[2px] text-[11px] text-ink-muted">
            {rows.map((r, i) => (
              <span key={r.date} className="flex-1 text-center">
                {i % Math.ceil(rows.length / 8) === 0 || i === rows.length - 1 ? formatDateJa(r.date).replace(/（.）/, "") : ""}
              </span>
            ))}
          </div>
          {hover !== null && rows[hover] && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm"
              style={{ left: `${((hover + 0.5) / rows.length) * 100}%` }}
            >
              <div className="font-medium text-ink">{formatDateJa(rows[hover].date)}</div>
              <div className="tabular-nums text-ink-soft">
                架電 {rows[hover].calls}件 ／ アポ {rows[hover].appointments}件
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
