// 日付の小さな道具。タイムゾーンのずれを避けるため、日付はローカル時刻の YYYY-MM-DD で扱う。

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isWeekend(d: Date): boolean {
  const w = d.getDay();
  return w === 0 || w === 6;
}

/** 土日を飛ばして n 営業日後 */
export function addBusinessDays(d: Date, n: number): Date {
  let r = new Date(d);
  let left = n;
  while (left > 0) {
    r = addDays(r, 1);
    if (!isWeekend(r)) left--;
  }
  return r;
}

/** 土日なら次の月曜にずらす */
export function nextBusinessDayIfWeekend(d: Date): Date {
  let r = new Date(d);
  while (isWeekend(r)) r = addDays(r, 1);
  return r;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 今週の月曜日 */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const diff = (s.getDay() + 6) % 7;
  return addDays(s, -diff);
}

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

export function formatDateJa(key: string): string {
  const d = fromDateKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAY[d.getDay()]}）`;
}

export function formatDateTimeJa(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDateJa(toDateKey(d))} ${hh}:${mm}`;
}
