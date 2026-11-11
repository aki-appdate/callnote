"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "./AppProvider";
import { AiSourceBadge, cx, Icon } from "./ui";

/** ロゴ：受話器を置いた後のメモ＝「C」と黄色のマーカー線 */
export function Logo({ onDark = true }: { onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cx("relative grid size-7 place-items-center rounded-[5px] font-mono text-sm font-bold", onDark ? "bg-marker text-ink" : "bg-ink text-marker")}
      >
        C
      </span>
      <span className={cx("text-[15px] font-bold tracking-tight", onDark ? "text-white" : "text-ink")}>CallNote</span>
    </span>
  );
}

export function Header() {
  const { members, me, setMe, aiSource, storeKind, resetDemo } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  const nav = [
    { href: "/calls", label: "架電", show: me?.role !== "sv" },
    { href: "/sv", label: "SVダッシュボード", show: true },
  ];

  return (
    <header className="on-console sticky top-0 z-20 bg-console text-console-text">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:py-0">
        <Link href="/" className="rounded-[5px] py-1 sm:py-3" aria-label="CallNote 紹介ページへ">
          <Logo />
        </Link>
        <nav className="flex self-stretch" aria-label="画面の切り替え">
          {nav
            .filter((n) => n.show)
            .map((n) => {
              const active = path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex items-center px-3 text-sm",
                    active ? "font-bold text-white" : "text-console-text hover:text-white",
                  )}
                >
                  {n.label}
                  {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[3px] bg-marker" />}
                </Link>
              );
            })}
        </nav>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <AiSourceBadge source={aiSource} onDark />
          <label className="flex items-center gap-1.5 text-[11px] text-console-text">
            <span className="sr-only sm:not-sr-only">利用者</span>
            <select
              className="h-8 rounded-[5px] border border-console-line bg-console-soft px-2 text-sm text-white"
              value={me?.id ?? ""}
              onChange={(e) => {
                const next = members.find((m) => m.id === e.target.value);
                setMe(e.target.value);
                router.push(next?.role === "sv" ? "/sv" : "/calls");
              }}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（{m.role === "sv" ? "SV" : "メンバー"}）
                </option>
              ))}
            </select>
          </label>
          <button
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-[5px] px-2 text-xs text-console-text hover:bg-console-soft hover:text-white disabled:opacity-60 sm:ml-0"
            disabled={resetting}
            title={storeKind === "firestore" ? "あなた専用のお試しデータを初期状態に戻します" : "このブラウザのお試しデータを初期状態に戻します"}
            onClick={async () => {
              if (!confirm("追加した記録を消して、お試しデータを最初の状態に戻しますか？")) return;
              setResetting(true);
              await resetDemo();
              setResetting(false);
            }}
          >
            <Icon name="reset" className="size-3.5" />
            {resetting ? "戻しています…" : "データを初期化"}
          </button>
        </div>
      </div>
      <p className="border-t border-console-line bg-console-soft px-4 py-1 text-center text-[11px] text-console-text">
        デモ版です。会社名・人名・電話番号などのデータはすべて架空のものです。
      </p>
    </header>
  );
}
