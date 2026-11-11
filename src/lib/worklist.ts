// メンバーの「今日かける」リストを作る。画面から計算を追い出して、テストで確かめられるようにする。

import { toDateKey } from "./dates";
import type { Lead } from "./types";

/** 1人1日の架電数の目安（デモデータの1人1日40〜60件に合わせる） */
export const DAILY_CALL_TARGET = 50;

export type TodayList = {
  /** 予定日が来たフォロー（予定日の古い順）＋今日の残り枠ぶんの新規 */
  leads: Lead[];
  /** 予定日が来た（過ぎた）フォローの件数。全部今日かける */
  followups: number;
  /** 今日の残り枠で並べる新規の件数 */
  fresh: number;
  /** 今日の残り枠（目安 − 今日すでにかけた件数）。0未満にはしない */
  remaining: number;
};

/**
 * 予定日が来たフォローは件数に関係なく全部並べ、新規は「1日の目安 − 今日かけた件数 − フォロー件数」だけ足す。
 * 新規の在庫（数百件）をそのまま並べると「今日かける」が数百件になり、今日の仕事量が読めなくなるため。
 */
export function buildTodayList(myLeads: Lead[], now: Date, callsDoneToday: number, target = DAILY_CALL_TARGET): TodayList {
  const todayKey = toDateKey(now);
  const due = myLeads
    .filter(
      (l) =>
        (l.status === "calling" || l.status === "followup") &&
        l.nextCallAt !== null &&
        toDateKey(new Date(l.nextCallAt)) <= todayKey,
    )
    .sort((a, b) => a.nextCallAt!.localeCompare(b.nextCallAt!));
  const remaining = Math.max(0, target - callsDoneToday);
  const freshSlots = Math.max(0, remaining - due.length);
  const fresh = myLeads.filter((l) => l.status === "new").slice(0, freshSlots);
  return { leads: [...due, ...fresh], followups: due.length, fresh: fresh.length, remaining };
}
