"use client";

import { Header } from "@/components/Header";
import { useApp } from "@/components/AppProvider";
import { Icon } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, error } = useApp();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 pt-5 pb-16">
        {error ? (
          <div role="alert" className="flex items-start gap-3 rounded-md border border-bad/30 bg-bad-soft p-4 text-sm text-bad">
            <Icon name="alert" className="mt-0.5" />
            <div>
              <p className="font-bold">{error}</p>
              <button className="mt-2 underline underline-offset-4" onClick={() => location.reload()}>
                再読み込みする
              </button>
            </div>
          </div>
        ) : ready ? (
          children
        ) : (
          <div className="py-24 text-center" role="status" aria-live="polite">
            <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-24 overflow-hidden rounded-full bg-line">
              <span className="block h-full w-1/3 animate-pulse rounded-full bg-ink" />
            </span>
            <p className="text-sm text-ink-muted">架電リストを読み込んでいます…</p>
          </div>
        )}
      </main>
    </>
  );
}
