// 小さな見た目の部品。ボタン・バッジ・面・アイコンの見た目をここで統一する。
// 方針は docs/design.md（墨が主役・黄色のマーカーは要所だけ・罫線で区切る）。

import type { AiSource } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-[5px] text-sm font-medium transition-colors disabled:cursor-not-allowed";

export const btn = {
  /** 主な操作。墨のボタン */
  primary: `${base} min-h-10 bg-brand px-4 py-2 text-white hover:bg-brand-strong disabled:bg-line-strong disabled:text-surface`,
  /** 次の操作。白地に墨の枠 */
  secondary: `${base} min-h-10 border border-line-strong bg-surface px-4 py-2 text-ink hover:border-ink disabled:border-line disabled:text-ink-muted`,
  /** 補助の操作。文字だけ */
  ghost: `${base} px-2 py-1 text-ink-soft hover:bg-brand-soft hover:text-ink disabled:text-ink-muted`,
  /** 文中のリンク風 */
  link: "inline-flex items-center gap-1 text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink",
};

/** 白い面。角丸は小さく、影は付けない */
export function Card({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("rounded-md border border-line bg-surface", className)}>
      {children}
    </section>
  );
}

/** 面の見出し。小さく・字間を広げて、中身より目立たせない */
export function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
      <h2 className="text-[13px] font-bold tracking-wide text-ink">{children}</h2>
      {aside}
    </div>
  );
}

/** 小さなラベル（項目名） */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx("text-[11px] font-medium tracking-wider text-ink-muted", className)}>{children}</span>;
}

type Tone = "neutral" | "brand" | "good" | "warn" | "bad" | "marker" | "outline";
const TONE: Record<Tone, string> = {
  neutral: "bg-brand-soft text-ink-soft",
  brand: "bg-ink text-white",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  marker: "bg-marker text-ink",
  outline: "border border-line-strong text-ink-soft",
};

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] px-1.5 py-px text-[11px] font-medium leading-5",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AiSourceBadge({ source, onDark = false }: { source: AiSource; onDark?: boolean }) {
  const label = source === "gemini" ? "AI：Gemini" : "AI：見本の返答";
  return (
    <span
      title={source === "gemini" ? "Gemini が返答しています" : "AIが使えないため、ルールベースの見本の返答で動いています"}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 py-px text-[11px] font-medium leading-5",
        onDark ? "border-console-line text-console-text" : "border-line-strong text-ink-soft",
      )}
    >
      <Icon name="spark" className={cx("size-3", source === "gemini" && (onDark ? "text-marker" : "text-ink"))} />
      {label}
    </span>
  );
}

/** 数字は等幅（桁をそろえる）。時刻・電話番号・表の数字に使う */
export function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx("font-mono tabular-nums tracking-tight", className)}>{children}</span>;
}

export function pct(n: number): string {
  return `${(Math.round(n * 1000) / 10).toFixed(1)}%`;
}

// ---- アイコン（インラインSVG・線の太さ 1.75 で統一） ----

type IconName =
  | "spark"
  | "phone"
  | "check"
  | "alert"
  | "arrow-right"
  | "clock"
  | "search"
  | "reset"
  | "flag"
  | "close"
  | "doc"
  | "chevron-down";

const PATHS: Record<IconName, React.ReactNode> = {
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />,
  phone: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  reset: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  doc: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M10 12h5M10 16h5" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx("size-4 shrink-0", className)}
    >
      {PATHS[name]}
    </svg>
  );
}
