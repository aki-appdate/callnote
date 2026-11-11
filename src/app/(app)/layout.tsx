"use client";

import { Header } from "@/components/Header";
import { useApp } from "@/components/AppProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, error } = useApp();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {error ? (
          <p className="rounded-lg bg-bad-soft p-4 text-sm text-bad">{error}</p>
        ) : ready ? (
          children
        ) : (
          <p className="py-20 text-center text-sm text-ink-muted">読み込んでいます…</p>
        )}
      </main>
    </>
  );
}
