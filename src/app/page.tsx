"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Logo } from "@/components/Header";
import { cx, Icon, Num } from "@/components/ui";
import { sampleCallInsight } from "@/lib/ai/sample";
import { formatDateJa } from "@/lib/dates";
import { OBJECTION_LABEL, OUTCOME_LABEL, TEMPERATURE_LABEL } from "@/lib/labels";

/** 紹介ページの見本に使うメモ。架電画面の「例を入れてみる」と同じ文 */
const DEMO_MEMO =
  "総務の山本さんと話せた。複合機は他社でリース中で、満了は来年の3月。費用は高いと感じているので、比較の見積があれば見たいとのこと";

const PROBLEMS = [
  {
    pain: "電話の直後にCRMへ細かく入力するのが重く、架電の手が止まる",
    answer: "結果をボタンで選び、メモは走り書きでOK。要約・温度感・断りの理由・次回日はAIが整理します。",
  },
  {
    pain: "次にいつ・何を話すかが、担当者の頭の中にしかない",
    answer: "「次に電話する日」と「次に話すこと」を残し、その日の架電リストに自動で並べます。",
  },
  {
    pain: "誰がどこでつまずいているか、SVが把握しにくい",
    answer: "メンバー別の接続率・受付止まり・アポ率と断り理由を集計。AIの気づきには根拠の記録が付きます。",
  },
];

const PRINCIPLES = [
  { title: "人が最後に決める", body: "AIの出力は「提案」。確認ボタンを押すまで保存しません。直した項目は記録に残ります。" },
  { title: "形を固定して検証する", body: "返答の形を zod で決め、受け取った値も同じ型で確かめます。形が違えば使いません。" },
  { title: "作り話を捨てる", body: "AIが挙げた根拠の記録が実在するかを確かめ、根拠のない気づきは表示しません。" },
  { title: "止まらない", body: "AIが使えないときは、ルールベースの「見本の返答」に自動で切り替わります。" },
];

const noop = () => () => {};

export default function Home() {
  const { members, setMe } = useApp();
  const router = useRouter();
  const start = (id: string, to: string) => {
    setMe(id);
    router.push(to);
  };
  const sv = members.find((m) => m.role === "sv");
  const member = members.find((m) => m.role === "member");

  // 次回日は「今日」で変わるので、ブラウザで表示してから計算する（サーバーとの食い違いを防ぐ）
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const demo = useMemo(
    () => (mounted ? sampleCallInsight({ memo: DEMO_MEMO, outcome: "decision_maker", now: new Date() }) : null),
    [mounted],
  );

  return (
    <>
      {/* ── 冒頭：墨の面 ── */}
      <div className="on-console bg-console text-console-text">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo />
          <Link
            href="https://github.com/aki-appdate/callnote"
            className="text-xs text-console-text underline decoration-console-line underline-offset-4 hover:text-white"
          >
            ソースコード（GitHub）
          </Link>
        </div>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 pt-8 pb-16 lg:grid-cols-[1fr_29rem] lg:gap-14 lg:pt-14 lg:pb-24">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium tracking-wider text-console-text">
              <span aria-hidden="true" className="inline-block h-2.5 w-6 bg-marker" />
              テレアポチームのAI営業アシスタント
            </p>
            <h1 className="mt-5 text-[2rem] leading-[1.25] font-black tracking-tight text-white sm:text-5xl sm:leading-[1.2]">
              <span className="inline-block">架電メモを、</span>
              <span className="inline-block">次の一手と</span>
              <br />
              <span className="inline-block">チームの改善に。</span>
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed">
              電話を切ったら、結果を選んでメモを走り書きするだけ。AIが整理し、人が確かめて保存します。
              法人向けテレアポのオペレーターとSVを経験した筆者が、現場の「入力が重くて手が止まる」「つまずきが見えない」を解くために作りました。
            </p>

            <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-2">
              <button
                className="group flex flex-col items-start gap-1 rounded-md bg-marker px-5 py-4 text-left text-ink transition-colors hover:bg-white disabled:opacity-50"
                disabled={!member}
                onClick={() => member && start(member.id, "/calls")}
              >
                <span className="flex w-full items-center justify-between text-base font-bold">
                  メンバーとして試す
                  <Icon name="arrow-right" className="transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="text-xs text-ink-soft">今日かけるリストと、電話の結果の記録</span>
              </button>
              <button
                className="group flex flex-col items-start gap-1 rounded-md border border-console-line px-5 py-4 text-left text-white transition-colors hover:border-white disabled:opacity-50"
                disabled={!sv}
                onClick={() => sv && start(sv.id, "/sv")}
              >
                <span className="flex w-full items-center justify-between text-base font-bold">
                  SVとして試す
                  <Icon name="arrow-right" className="transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="text-xs text-console-text">チームの数字と、AIによる朝会の気づき</span>
              </button>
            </div>
            <p className="mt-4 text-xs text-console-text">ログイン不要。データはすべて架空で、いつでも初期化できます。</p>
          </div>

          {/* 見本：走り書き → AIの整理（見本の返答が実際に出した結果） */}
          <figure className="self-start rounded-md bg-surface text-ink" aria-label="メモをAIが整理する例">
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium tracking-wider text-ink-muted">電話の直後のメモ</span>
                <span className="rounded-[3px] bg-ink px-1.5 py-px text-[11px] leading-5 font-medium text-white">
                  {OUTCOME_LABEL.decision_maker}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{DEMO_MEMO}</p>
            </div>
            <div className="flex items-center gap-2 bg-marker-soft px-5 py-2 text-xs font-medium text-ink">
              <Icon name="spark" className="size-3.5" />
              AIが整理（人が確認してから保存）
            </div>
            <dl className="divide-y divide-line px-5 text-sm">
              <div className="grid grid-cols-3 gap-3 py-3">
                <Mini label="温度感">{demo ? TEMPERATURE_LABEL[demo.temperature] : "…"}</Mini>
                <Mini label="断りの理由">{demo ? OBJECTION_LABEL[demo.objection] : "…"}</Mini>
                <Mini label="次に電話する日">
                  {demo?.nextAction.date ? <Num>{formatDateJa(demo.nextAction.date)}</Num> : "…"}
                </Mini>
              </div>
              <Row label="次に話すこと">
                {demo ? (
                  <ul className="space-y-1">
                    {demo.nextAction.talkPoints.map((t) => (
                      <li key={t} className="flex gap-2">
                        <span aria-hidden="true" className="mt-2 h-px w-2 shrink-0 bg-ink" />
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "…"
                )}
              </Row>
              <Row label="トークのヒント">
                <span className="text-ink-soft">{demo ? demo.coachingTip : "…"}</span>
              </Row>
            </dl>
            <figcaption className="border-t border-line px-5 py-3 text-[11px] leading-relaxed text-ink-muted">
              AIが使えないときの「見本の返答」（ルールベース）が、このメモから実際に出した結果です。
            </figcaption>
          </figure>
        </section>
      </div>

      {/* ── 課題と解き方 ── */}
      <main className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <section aria-labelledby="problems">
          <h2 id="problems" className="text-xl font-bold sm:text-2xl">
            現場の困りごとから、作りました。
          </h2>
          <ol className="mt-8 border-t border-ink">
            {PROBLEMS.map((p, i) => (
              <li key={p.pain} className="grid gap-x-8 gap-y-2 border-b border-line py-6 sm:grid-cols-[3rem_1fr_1.2fr]">
                <Num className="text-sm font-bold text-ink-muted">{String(i + 1).padStart(2, "0")}</Num>
                <p className="text-[15px] leading-relaxed text-ink-soft">{p.pain}</p>
                <p className="flex gap-3 text-[15px] leading-relaxed font-medium text-ink">
                  <Icon name="arrow-right" className="mt-1 hidden text-ink-muted sm:block" />
                  {p.answer}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="principles" className="mt-20">
          <h2 id="principles" className="text-xl font-bold sm:text-2xl">
            AIを、現場で使える形にするために。
          </h2>
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="border-t-2 border-ink pt-4">
                <h3 className="font-bold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="about" className="mt-20 rounded-md border border-line bg-surface">
          <h2 id="about" className="border-b border-line px-6 py-4 text-[13px] font-bold tracking-wide">
            このアプリについて
          </h2>
          <dl className="grid text-sm sm:grid-cols-2">
            <About label="作った人">
              テレアポのオペレーターとSVを経験した開発者が、Claude Code（AIコーディングツール）で設計・実装しました。
            </About>
            <About label="使っている技術">
              Next.js / React / TypeScript / Tailwind CSS / Firebase（Firestore・匿名認証・AI Logic）/ Gemini / Vercel
            </About>
            <About label="AIが使えないとき">
              無料枠の上限や通信エラーのときは、ルールベースの「見本の返答」に自動で切り替わり、画面は止まりません。
            </About>
            <About label="ソースコード">
              <Link className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink" href="https://github.com/aki-appdate/callnote">
                GitHubで公開しています
              </Link>
            </About>
          </dl>
        </section>

        <p className="mt-10 text-xs text-ink-muted">デモ版です。会社名・人名・電話番号などのデータはすべて架空のものです。</p>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3">
      <dt className="text-[11px] font-medium tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1 leading-relaxed">{children}</dd>
    </div>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}

function About({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cx("border-line px-6 py-4 sm:[&:nth-child(odd)]:border-r", "border-b sm:[&:nth-last-child(-n+2)]:border-b-0 last:border-b-0")}>
      <dt className="text-[11px] font-medium tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1.5 leading-relaxed text-ink-soft">{children}</dd>
    </div>
  );
}
