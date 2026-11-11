"use client";

import { useState } from "react";
import { useApp } from "../AppProvider";
import { AiSourceBadge, btn, Card, CardTitle, cx } from "../ui";
import { analyzeCall } from "@/lib/ai";
import { OBJECTION_LABEL, OUTCOME_LABEL, OUTCOME_ORDER, TEMPERATURE_LABEL } from "@/lib/labels";
import { toDateKey } from "@/lib/dates";
import type { AiSource, CallInsight, CallLog, CallOutcome, Lead, Objection, Temperature } from "@/lib/types";

/** 試す人がすぐ動きを見られるよう、結果ごとにメモの例を用意 */
const EXAMPLES: Partial<Record<CallOutcome, string>> = {
  decision_maker: "総務の山本さんと話せた。複合機は他社でリース中で、満了は来年の3月。費用は高いと感じているので、比較の見積があれば見たいとのこと",
  callback: "担当者が会議中。来週火曜の午後なら時間が取れるので、もう一度かけてほしいと受付から伝言",
  gatekeeper: "受付で用件を聞かれて止められた。決裁は社長で、夕方なら在席していることが多いらしい",
  appointment: "社用携帯の台数が増えて管理が大変とのこと。来週木曜の14時にオンライン面談のアポ",
  rejected: "今の機械で間に合っているので必要ない、とはっきり言われた",
};

type Phase = "input" | "analyzing" | "review" | "saving";

export function CallRecorder({ lead, history, onSaving, onNext }: { lead: Lead; history: CallLog[]; onSaving: () => void; onNext: () => void }) {
  const { me, saveCall } = useApp();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [memo, setMemo] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [original, setOriginal] = useState<CallInsight | null>(null);
  const [draft, setDraft] = useState<CallInsight | null>(null);
  const [source, setSource] = useState<AiSource>("sample");
  const [note, setNote] = useState<string | undefined>();
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canAnalyze = outcome !== null && memo.trim().length > 0 && phase === "input";

  async function runAi() {
    if (!outcome) return;
    setPhase("analyzing");
    const r = await analyzeCall({ lead, outcome, memo, history });
    setOriginal(r.value);
    setDraft(structuredClone(r.value));
    setSource(r.source);
    setNote(r.note);
    setPhase("review");
  }

  async function save(raw: CallInsight | null) {
    if (!outcome || !me) return;
    // 保存するとこの案件が「今日かける」一覧から外れるので、先に選択を固定して画面が切り替わらないようにする
    onSaving();
    const insight = raw && {
      ...raw,
      summary: raw.summary.trim(),
      nextAction: { ...raw.nextAction, talkPoints: raw.nextAction.talkPoints.map((s) => s.trim()).filter(Boolean) },
    };
    setPhase("saving");
    setSaveError(null);
    const log: CallLog = {
      id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      leadId: lead.id,
      memberId: me.id,
      at: new Date().toISOString(),
      outcome,
      memo: memo.trim(),
      insight,
      aiSource: insight ? source : null,
      editedFields: insight && original ? diffFields(original, insight) : [],
    };
    try {
      await saveCall(log);
      setSaved(OUTCOME_LABEL[outcome]);
      setOutcome(null);
      setMemo("");
      setOriginal(null);
      setDraft(null);
      setPhase("input");
    } catch {
      setSaveError("保存できませんでした。通信状況を確認して、もう一度お試しください。");
      setPhase(insight ? "review" : "input");
    }
  }

  return (
    <Card>
      <CardTitle aside={
          saved && phase === "input" ? (
            <span className="flex items-center gap-3 text-xs">
              <span className="text-good">✓「{saved}」を保存しました</span>
              <button className="font-medium text-brand underline" onClick={onNext}>
                次の案件へ →
              </button>
            </span>
          ) : null
        }>
        電話の結果を記録
      </CardTitle>

      <div className="space-y-4 px-5 py-4">
        <fieldset disabled={phase !== "input"}>
          <legend className="text-xs font-medium text-ink-soft">1. 結果を選ぶ</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OUTCOME_ORDER.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={outcome === o}
                onClick={() => {
                  setOutcome(o);
                  setSaved(null);
                }}
                className={cx(
                  "rounded-lg border px-3 py-2 text-sm disabled:opacity-60",
                  outcome === o ? "border-brand bg-brand-soft font-medium text-brand-strong" : "border-line hover:bg-canvas",
                )}
              >
                {OUTCOME_LABEL[o]}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="flex items-end justify-between">
            <label htmlFor="memo" className="text-xs font-medium text-ink-soft">
              2. メモを書く（走り書きでOK）
            </label>
            {outcome && EXAMPLES[outcome] && phase === "input" && (
              <button type="button" className="text-xs text-brand underline" onClick={() => setMemo(EXAMPLES[outcome]!)}>
                例を入れてみる
              </button>
            )}
          </div>
          <textarea
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={phase !== "input"}
            rows={3}
            maxLength={400}
            placeholder="例）担当者と話せた。他社でリース中、満了は来年春。見積があれば比較したい"
            className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm placeholder:text-ink-muted disabled:bg-canvas"
          />
        </div>

        {phase === "input" || phase === "analyzing" ? (
          <div className="flex flex-wrap gap-2">
            <button className={btn.primary} disabled={!canAnalyze} onClick={runAi}>
              {phase === "analyzing" ? "AIが整理しています…" : "✦ AIで整理する"}
            </button>
            <button className={btn.secondary} disabled={outcome === null || phase !== "input"} onClick={() => save(null)}>
              AIを使わずに保存
            </button>
          </div>
        ) : null}

        {draft && (phase === "review" || phase === "saving") && (
          <InsightReview
            draft={draft}
            original={original!}
            source={source}
            note={note}
            onChange={setDraft}
            saving={phase === "saving"}
            onSave={() => save(draft)}
            onBack={() => {
              setPhase("input");
              setDraft(null);
            }}
          />
        )}
        {saveError && <p className="text-sm text-bad">{saveError}</p>}
      </div>
    </Card>
  );
}

function InsightReview(props: {
  draft: CallInsight;
  original: CallInsight;
  source: AiSource;
  note?: string;
  saving: boolean;
  onChange: (i: CallInsight) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const { draft, onChange } = props;
  const edited = new Set(diffFields(props.original, draft));
  const set = <K extends keyof CallInsight>(k: K, v: CallInsight[K]) => onChange({ ...draft, [k]: v });
  const field = (name: string) => cx("mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm", edited.has(name) ? "border-warn bg-warn-soft/40" : "border-line");

  return (
    <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold">3. AIの提案を確認する</h3>
        <AiSourceBadge source={props.source} />
        <span className="text-xs text-ink-soft">内容は自由に直せます。直した項目は記録に残ります。</span>
      </div>
      {props.note && <p className="mt-2 text-xs text-ink-soft">{props.note}</p>}

      {draft.uncertainties.length > 0 && (
        <div className="mt-3 rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
          <p className="font-medium">⚠ 人が確認してほしいこと</p>
          <ul className="mt-1 list-inside list-disc">
            {draft.uncertainties.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 text-xs text-ink-soft">
          要約
          <textarea className={field("summary")} rows={2} value={draft.summary} onChange={(e) => set("summary", e.target.value)} />
        </label>
        <label className="text-xs text-ink-soft">
          相手の温度感
          <select className={field("temperature")} value={draft.temperature} onChange={(e) => set("temperature", e.target.value as Temperature)}>
            {Object.entries(TEMPERATURE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-soft">
          断りの理由
          <select className={field("objection")} value={draft.objection} onChange={(e) => set("objection", e.target.value as Objection)}>
            {Object.entries(OBJECTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-soft">
          次に電話する日
          <input
            type="date"
            className={field("nextAction.date")}
            min={toDateKey(new Date())}
            value={draft.nextAction.date ?? ""}
            onChange={(e) => onChange({ ...draft, nextAction: { ...draft.nextAction, date: e.target.value || null } })}
          />
          <span className="mt-0.5 block text-[11px] text-ink-muted">空欄なら、この案件にはもう電話しません</span>
        </label>
        <label className="text-xs text-ink-soft">
          次に話すこと（1行に1つ）
          <textarea
            className={field("nextAction.talkPoints")}
            rows={3}
            value={draft.nextAction.talkPoints.join("\n")}
            onChange={(e) =>
              onChange({
                ...draft,
                nextAction: { ...draft.nextAction, talkPoints: e.target.value.split("\n").filter((s, i, a) => s.trim() || i === a.length - 1) },
              })
            }
          />
        </label>
      </div>

      <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">
        <span className="font-medium text-ink">トークのヒント：</span>
        {draft.coachingTip}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className={btn.primary} disabled={props.saving} onClick={props.onSave}>
          {props.saving ? "保存しています…" : "確認したので保存する"}
        </button>
        <button className={btn.secondary} disabled={props.saving} onClick={props.onBack}>
          メモを書き直す
        </button>
      </div>
    </div>
  );
}

/** AIの提案から人が書き換えた項目の名前を返す */
export function diffFields(a: CallInsight, b: CallInsight): string[] {
  const out: string[] = [];
  if (a.summary.trim() !== b.summary.trim()) out.push("summary");
  if (a.temperature !== b.temperature) out.push("temperature");
  if (a.objection !== b.objection) out.push("objection");
  if (a.nextAction.date !== b.nextAction.date) out.push("nextAction.date");
  const clean = (x: string[]) => x.map((s) => s.trim()).filter(Boolean).join("|");
  if (clean(a.nextAction.talkPoints) !== clean(b.nextAction.talkPoints)) out.push("nextAction.talkPoints");
  return out;
}
