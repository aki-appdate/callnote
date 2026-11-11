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

/**
 * 日本の祝日（振替休日・国民の休日を含む）。ライブラリを足さず、デモで使う2026〜2027年だけを固定の表で持つ。
 * 年をまたいで使い続けるなら、この表に翌年分を足す。
 */
const HOLIDAYS = new Set([
  // 2026年
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20", "2026-04-29",
  "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06", "2026-07-20", "2026-08-11",
  "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23",
  // 2027年
  "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21", "2027-03-22",
  "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05", "2027-07-19", "2027-08-11",
  "2027-09-20", "2027-09-23", "2027-10-11", "2027-11-03", "2027-11-23",
]);

/** 祝日か、年末年始の休み（12/29〜1/3）か */
export function isHoliday(d: Date): boolean {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if ((m === 12 && day >= 29) || (m === 1 && day <= 3)) return true;
  return HOLIDAYS.has(toDateKey(d));
}

/** 電話をかける日か（土日・祝日・年末年始以外） */
export function isBusinessDay(d: Date): boolean {
  return !isWeekend(d) && !isHoliday(d);
}

/** 土日・祝日・年末年始を飛ばして n 営業日後 */
export function addBusinessDays(d: Date, n: number): Date {
  let r = new Date(d);
  let left = n;
  while (left > 0) {
    r = addDays(r, 1);
    if (isBusinessDay(r)) left--;
  }
  return r;
}

/** 休みの日なら、次の営業日にずらす（営業日ならそのまま） */
export function nextBusinessDay(d: Date): Date {
  let r = new Date(d);
  while (!isBusinessDay(r)) r = addDays(r, 1);
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
