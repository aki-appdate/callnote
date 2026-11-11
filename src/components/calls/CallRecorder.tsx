"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "../AppProvider";
import { AiSourceBadge, btn, Card, cx, Icon, MarkerMark } from "../ui";
import { analyzeCall } from "@/lib/ai";
import { OBJECTION_LABEL, OUTCOME_LABEL, OUTCOME_ORDER, TEMPERATURE_LABEL } from "@/lib/labels";
import { toDateKey } from "@/lib/dates";
import { clampTalkPoints, TALK_POINT_MAX_CHARS, TALK_POINT_MAX_LINES } from "@/lib/ai/sample";
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
      nextAction: { ...raw.nextAction, talkPoints: clampTalkPoints(raw.nextAction.talkPoints.map((s) => s.trim()).filter(Boolean)) },
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

  // 結果は数字キー 1〜6 でも選べる（メモ欄などに入力中は反応しない）
  const memoRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (phase !== "input") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < OUTCOME_ORDER.length) {
        e.preventDefault();
        setOutcome(OUTCOME_ORDER[i]);
        setSaved(null);
        memoRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  return (
    <Card className="overflow-hidden">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-2.5">
        <h2 className="text-[13px] font-bold tracking-wide">電話の結果を記録</h2>
        <span className="hidden text-[11px] text-ink-muted sm:inline">数字キー 1〜6 で結果を選べます</span>
      </div>

      {saved && phase === "input" && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-good/20 bg-good-soft px-5 py-2.5 text-sm">
          <span className="flex items-center gap-2 font-medium text-good">
            <Icon name="check" />「{saved}」を保存しました
          </span>
          <button className={btn.link} onClick={onNext}>
            次の案件へ
            <Icon name="arrow-right" className="size-3.5" />
          </button>
        </div>
      )}

      <div className="space-y-5 px-5 py-5">
        <fieldset disabled={phase !== "input"} className="disabled:opacity-60">
          <legend className="flex items-center gap-2 text-xs font-bold">
            <Step n={1} />
            結果を選ぶ
          </legend>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OUTCOME_ORDER.map((o, i) => {
              const on = outcome === o;
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setOutcome(o);
                    setSaved(null);
                  }}
                  className={cx(
                    "flex min-h-11 items-center gap-2.5 rounded-[5px] border px-3 py-2 text-left text-sm transition-colors max-sm:justify-center max-sm:text-center",
                    on ? "border-ink bg-ink font-bold text-white" : "border-line-strong bg-surface text-ink hover:border-ink",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "grid size-5 shrink-0 place-items-center rounded-[3px] font-mono text-[11px] font-bold max-sm:hidden",
                      on ? "bg-marker text-ink" : "bg-brand-soft text-ink-soft",
                    )}
                  >
                    {i + 1}
                  </span>
                  {OUTCOME_LABEL[o]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label htmlFor="memo" className="flex items-center gap-2 text-xs font-bold">
              <Step n={2} />
              メモを書く<span className="font-normal text-ink-muted">走り書きでOK</span>
            </label>
            {outcome && EXAMPLES[outcome] && phase === "input" && (
              <button type="button" className="text-xs font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink" onClick={() => setMemo(EXAMPLES[outcome]!)}>
                例を入れてみる
              </button>
            )}
          </div>
          <textarea
            id="memo"
            ref={memoRef}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={phase !== "input"}
            rows={3}
            maxLength={400}
            placeholder="例）担当者と話せた。他社でリース中、満了は来年3月。見積があれば比較したい"
            className="mt-2.5 w-full rounded-[5px] border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed placeholder:text-ink-muted focus:border-ink disabled:bg-canvas disabled:text-ink-soft"
          />
          <p className="mt-1 text-right font-mono text-[11px] text-ink-muted tabular-nums">{memo.length}/400</p>
        </div>

        {phase === "input" || phase === "analyzing" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button className={btn.primary} disabled={!canAnalyze} onClick={runAi} aria-busy={phase === "analyzing"}>
              <MarkerMark busy={phase === "analyzing"} />
              {phase === "analyzing" ? "AIが整理しています…" : "AIで整理する"}
            </button>
            <button className={btn.secondary} disabled={outcome === null || phase !== "input"} onClick={() => save(null)}>
              AIを使わずに保存
            </button>
            {phase === "input" && !canAnalyze && (
              <span className="text-xs text-ink-muted">{outcome === null ? "まず結果を選んでください" : "メモを書くとAIで整理できます"}</span>
            )}
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
        {saveError && (
          <p role="alert" className="flex items-center gap-2 text-sm text-bad">
            <Icon name="alert" />
            {saveError}
          </p>
        )}
      </div>
    </Card>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-ink font-mono text-[11px] font-bold text-white">
      {n}
    </span>
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
  const field = (name: string) =>
    cx(
      "mt-1 w-full rounded-[5px] border bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-ink",
      edited.has(name) ? "border-warn bg-warn-soft/50" : "border-line-strong",
    );
  const label = (text: string, name: string) => (
    <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-ink-muted">
      {text}
      {edited.has(name) && <span className="rounded-[3px] bg-warn-soft px-1 text-[10px] tracking-normal text-warn">人が修正</span>}
    </span>
  );

  return (
    <section aria-labelledby="review-title" className="overflow-hidden rounded-md border border-ink">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-marker-soft px-4 py-2.5">
        <h3 id="review-title" className="flex items-center gap-2 text-xs font-bold">
          <Step n={3} />
          AIの提案を確認する
        </h3>
        <AiSourceBadge source={props.source} />
        <span className="text-[11px] text-ink-soft">自由に直せます。直した項目は記録に残ります。</span>
      </div>

      <div className="space-y-4 p-4">
        {props.note && <p className="text-xs text-ink-soft">{props.note}</p>}

        {draft.uncertainties.length > 0 && (
          <div role="note" className="flex gap-2.5 rounded-[5px] border border-warn/30 bg-warn-soft px-3 py-2.5 text-sm text-warn">
            <Icon name="alert" className="mt-0.5" />
            <div>
              <p className="font-bold">人が確認してほしいこと</p>
              <ul className="mt-1 space-y-0.5">
                {draft.uncertainties.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            {label("要約", "summary")}
            <textarea className={field("summary")} rows={2} maxLength={200} value={draft.summary} onChange={(e) => set("summary", e.target.value)} />
          </label>
          <label className="block">
            {label("相手の温度感", "temperature")}
            <select className={field("temperature")} value={draft.temperature} onChange={(e) => set("temperature", e.target.value as Temperature)}>
              {Object.entries(TEMPERATURE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {label("断りの理由", "objection")}
            <select className={field("objection")} value={draft.objection} onChange={(e) => set("objection", e.target.value as Objection)}>
              {Object.entries(OBJECTION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {label("次に電話する日", "nextAction.date")}
            <input
              type="date"
              className={cx(field("nextAction.date"), "font-mono tabular-nums")}
              min={toDateKey(new Date())}
              value={draft.nextAction.date ?? ""}
              onChange={(e) => onChange({ ...draft, nextAction: { ...draft.nextAction, date: e.target.value || null } })}
            />
            <span className={cx("mt-1 flex gap-1 text-[11px] leading-snug", draft.nextAction.date ? "text-ink-muted" : "font-bold text-warn")}>
              {!draft.nextAction.date && <Icon name="alert" className="size-3.5" />}
              {draft.nextAction.date
                ? "空欄にすると、この案件は「見送り」になり、もう電話しません"
                : "空欄のまま保存すると「見送り」になり、今日かける一覧から外れます"}
            </span>
          </label>
          <label className="block">
            {label(`次に話すこと（1行に1つ・${TALK_POINT_MAX_LINES}行まで）`, "nextAction.talkPoints")}
            <textarea
              className={field("nextAction.talkPoints")}
              rows={3}
              value={draft.nextAction.talkPoints.join("\n")}
              onChange={(e) =>
                onChange({
                  ...draft,
                  nextAction: {
                    ...draft.nextAction,
                    talkPoints: clampTalkPoints(e.target.value.split("\n").filter((s, i, a) => s.trim() || i === a.length - 1)),
                  },
                })
              }
            />
            <span className="mt-1 block text-[11px] text-ink-muted">1行{TALK_POINT_MAX_CHARS}文字まで</span>
          </label>
        </div>

        <p className="border-l-2 border-marker pl-3 text-sm leading-relaxed text-ink-soft">
          <span className="font-bold text-ink">トークのヒント　</span>
          {draft.coachingTip}
        </p>

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button className={btn.primary} disabled={props.saving} onClick={props.onSave}>
            <Icon name="check" />
            {props.saving ? "保存しています…" : "確認したので保存する"}
          </button>
          <button className={btn.secondary} disabled={props.saving} onClick={props.onBack}>
            メモを書き直す
          </button>
        </div>
      </div>
    </section>
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
