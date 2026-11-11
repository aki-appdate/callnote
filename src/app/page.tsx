"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Logo } from "@/components/Header";
import { Hl, Icon, MarkerMark, Num } from "@/components/ui";
import { memoHighlights, sampleCallInsight } from "@/lib/ai/sample";
import { formatDateJa } from "@/lib/dates";
import { OBJECTION_LABEL, OUTCOME_LABEL, TEMPERATURE_LABEL } from "@/lib/labels";

/** 紹介ページの見本に使うメモ。架電画面の「例を入れてみる」と同じ文 */
const DEMO_MEMO =
  "総務の山本さんと話せた。複合機は他社でリース中で、満了は来年の3月。費用は高いと感じているので、比較の見積があれば見たいとのこと";

/** 「これまでの記録」の走り書き。入力が追いつかず、単語だけが残ったメモ */
const BEFORE_MEMO = "山本さん　他社リース　3月？　高い";

const RULES = [
  { title: "保存ボタンは人が押す", body: "AIの整理は「提案」。確認して保存するまで記録に入りません。人が直した項目は、直したと分かる形で残ります。" },
  { title: "返答の形を先に決める", body: "返答の形を zod で決めてAIに渡し、受け取った値も同じ形で確かめます。形が違えば使いません。" },
  { title: "根拠のない気づきは捨てる", body: "朝会メモの気づきは、AIが挙げた架電ログが本当にあるかを確かめ、なければ表示しません。" },
  { title: "AIが止まっても電話は止めない", body: "無料枠の上限や通信エラーのときは、ルールベースの「見本の返答」に切り替わります。" },
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
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                <HighlightedMemo />
              </p>
            </div>
            <div className="flex items-center gap-2 border-y border-dashed border-line-strong px-5 py-2 text-xs font-medium text-ink">
              <MarkerMark />
              線を引いたところから、AIが整理（人が確認してから保存）
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
              AIが使えないときの「見本の返答」（ルールベース）が、このメモから実際に出した結果です。満了日そのものではなく、満了の2〜3か月前を次の電話の日にしています。
            </figcaption>
          </figure>
        </section>
      </div>

      {/* ── 記録の比べ方：同じ1本の電話を、これまでの記録と CallNote の記録で並べる ── */}
      <main className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <section aria-labelledby="compare">
          <h2 id="compare" className="text-xl font-bold sm:text-2xl">
            同じ1本の電話を、記録で比べると。
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            上の電話を、これまでの手入力のやり方で残した記録と、CallNoteの記録で比べます。番号は、現場で毎日起きていたつまずきです。
          </p>

          <div className="mt-8 overflow-hidden rounded-md border border-ink bg-surface text-sm">
            <div className="hidden grid-cols-[9.5rem_1fr_1fr] border-b border-ink text-[11px] font-medium tracking-wider sm:grid">
              <span className="px-4 py-2 text-ink-muted">項目</span>
              <span className="border-l border-line bg-canvas px-4 py-2 text-ink-muted">これまで（電話のあとにCRMへ手入力）</span>
              <span className="flex items-center gap-2 border-l border-line px-4 py-2 text-ink">
                <MarkerMark />
                CallNote
              </span>
            </div>
            <CompareRow
              label="メモ"
              n={1}
              before={<span className="font-mono">{BEFORE_MEMO}</span>}
              beforeNote="次の番号を急ぐので、単語だけ。あとで読み返しても分からない"
              after={<HighlightedMemo />}
              afterNote="結果はボタン（数字キー）で選び、メモは走り書きのまま。決め手の言葉にAIが線を引く"
            />
            <CompareRow
              label="次に電話する日"
              n={2}
              before={<Blank />}
              beforeNote="次にいつ・何を話すかは、担当者の頭の中だけ"
              after={
                demo?.nextAction.date ? (
                  <span>
                    <Num className="font-bold">{formatDateJa(demo.nextAction.date)}</Num>
                    <span className="ml-2 text-ink-soft">{demo.nextAction.talkPoints[0]}</span>
                  </span>
                ) : (
                  "…"
                )
              }
              afterNote="その日になると、担当者の「今日かける」一覧に自動で並ぶ"
            />
            <CompareRow
              label="断りの理由"
              n={3}
              before={<Blank />}
              beforeNote="SVは、誰がどこでつまずいたかを数えられない"
              after={demo ? <span className="font-bold">{OBJECTION_LABEL[demo.objection]}</span> : "…"}
              afterNote="SVの集計と、朝会メモ（根拠の架電ログつき）に入る"
            />
          </div>
        </section>

        <section aria-labelledby="rules" className="mt-20 grid gap-x-12 gap-y-6 lg:grid-cols-[18rem_1fr]">
          <div>
            <h2 id="rules" className="text-xl font-bold sm:text-2xl">
              AIに任せきりにしない、4つの決まり
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">架電リストの確認欄のように、どの記録もこの4つを通ってから残ります。</p>
          </div>
          <ul className="grid border-t border-ink sm:grid-cols-2">
            {RULES.map((r) => (
              <li key={r.title} className="flex gap-3 border-b border-line py-4 sm:odd:pr-6 sm:even:border-l sm:even:pl-6">
                <span aria-hidden="true" className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[2px] border-[1.5px] border-ink">
                  <Icon name="check" className="size-3" />
                </span>
                <div>
                  <h3 className="font-bold">{r.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{r.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="colophon" className="mt-20 max-w-3xl">
          <h2 id="colophon" className="text-[13px] font-bold tracking-wide">
            作り手と中身
          </h2>
          <dl className="mt-3 border-t border-ink text-sm">
            <Colophon label="作った人">
              テレアポのオペレーターとSVを経験した筆者が作りました。設計・仕様決め・動作確認は筆者、実装は Claude Code（AIコーディングツール）です。
            </Colophon>
            <Colophon label="技術">
              Next.js / React / TypeScript / Tailwind CSS / Firebase（Firestore・匿名認証・AI Logic）/ Gemini / Vercel
            </Colophon>
            <Colophon label="ソースコード">
              <Link className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink" href="https://github.com/aki-appdate/callnote">
                GitHubで公開しています
              </Link>
            </Colophon>
          </dl>
        </section>
      </main>
    </>
  );
}

function HighlightedMemo() {
  return (
    <>
      {memoHighlights(DEMO_MEMO, "decision_maker").map((p, i) => (p.mark ? <Hl key={i} className="text-ink">{p.text}</Hl> : <span key={i}>{p.text}</span>))}
    </>
  );
}

function Blank() {
  return <span className="text-ink-muted">（空欄）</span>;
}

function CompareRow(props: {
  label: string;
  n: number;
  before: React.ReactNode;
  beforeNote: string;
  after: React.ReactNode;
  afterNote: string;
}) {
  return (
    <div className="grid border-b border-line last:border-b-0 sm:grid-cols-[9.5rem_1fr_1fr]">
      <div className="flex items-center gap-2 px-4 pt-3 text-xs font-bold sm:items-start sm:py-4">
        <span aria-label={`つまずき${props.n}`} className="grid size-5 place-items-center rounded-full border border-ink font-mono text-[11px]">
          {props.n}
        </span>
        {props.label}
      </div>
      <div className="bg-canvas px-4 py-3 sm:border-l sm:border-line sm:py-4">
        <p className="text-[11px] text-ink-muted sm:hidden">これまで</p>
        <p className="text-ink-soft">{props.before}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-warn">{props.beforeNote}</p>
      </div>
      <div className="px-4 py-3 sm:border-l sm:border-line sm:py-4">
        <p className="text-[11px] text-ink-muted sm:hidden">CallNote</p>
        <p className="leading-relaxed">{props.after}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{props.afterNote}</p>
      </div>
    </div>
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

function Colophon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-0.5 border-b border-dotted border-line-strong py-2.5 sm:grid-cols-[7rem_1fr]">
      <dt className="text-[11px] font-medium tracking-wider text-ink-muted sm:pt-0.5">{label}</dt>
      <dd className="leading-relaxed text-ink-soft">{children}</dd>
    </div>
  );
}
