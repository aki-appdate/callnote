"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { btn } from "@/components/ui";

const FEATURES = [
  {
    title: "電話の直後に、メモを書くだけ",
    body: "「担当者と話せた。他社でリース中、満了は来年春」のような走り書きを、AIが要約・温度感・断りの理由・次に電話する日に整理します。",
  },
  {
    title: "AIの提案は、人が確認してから保存",
    body: "AIが自信を持てない点は「確認してほしいこと」として目立たせます。書き換えた項目は記録に残り、AIの精度を振り返れます。",
  },
  {
    title: "SVは、チームのつまずきが一目で分かる",
    body: "メンバーごとの接続率・受付止まり・アポ率と、断り理由の内訳を集計。AIが根拠の記録つきで、明日の朝会で使える気づきを出します。",
  },
];

export default function Home() {
  const { members, setMe } = useApp();
  const router = useRouter();
  const start = (id: string, to: string) => {
    setMe(id);
    router.push(to);
  };
  const sv = members.find((m) => m.role === "sv");
  const member = members.find((m) => m.role === "member");

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      <p className="text-sm font-medium text-brand">テレアポチームのAI営業アシスタント</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight text-ink sm:text-4xl">
        架電メモを、次の一手と
        <br className="hidden sm:block" />
        チームの改善に変える。
      </h1>
      <p className="mt-4 max-w-2xl text-ink-soft">
        CallNoteは、法人向けテレアポの現場で「CRMへの入力が重くて架電の手が止まる」「誰がどこでつまずいているか分からない」という課題から作ったデモアプリです。
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button className={btn.primary} disabled={!member} onClick={() => member && start(member.id, "/calls")}>
          メンバーとして試す
        </button>
        <button className={btn.secondary} disabled={!sv} onClick={() => sv && start(sv.id, "/sv")}>
          SV（現場リーダー）として試す
        </button>
      </div>
      <p className="mt-3 text-xs text-ink-muted">ログインは不要です。データはすべて架空で、いつでも初期化できます。</p>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-bold text-ink">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-xl border border-line bg-surface p-6">
        <h2 className="font-bold text-ink">このアプリについて</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-ink">作った人</dt>
            <dd className="mt-1 text-ink-soft">
              テレアポのオペレーターとSVを経験した開発者が、Claude Code（AIコーディングツール）で設計・実装しました。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">使っている技術</dt>
            <dd className="mt-1 text-ink-soft">Next.js / React / TypeScript / Tailwind CSS / Firebase（Firestore・匿名認証・AI Logic）/ Gemini / Vercel</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">AIが使えないとき</dt>
            <dd className="mt-1 text-ink-soft">
              無料枠の上限や通信エラーのときは、ルールベースの「見本の返答」に自動で切り替わり、画面は止まりません。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">ソースコード</dt>
            <dd className="mt-1 text-ink-soft">
              <Link className="text-brand underline" href="https://github.com/aki-appdate/callnote">
                GitHubで公開しています
              </Link>
            </dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
