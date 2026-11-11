import { describe, expect, it } from "vitest";
import { addBusinessDays, isBusinessDay, isHoliday, nextBusinessDay, toDateKey } from "./dates";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("祝日・年末年始", () => {
  it.each([
    ["2026-11-03", "文化の日"],
    ["2026-11-23", "勤労感謝の日"],
    ["2026-05-06", "振替休日"],
    ["2026-09-22", "国民の休日"],
    ["2027-01-11", "成人の日"],
    ["2027-03-22", "春分の日の振替休日"],
  ])("%s（%s）は休み", (key) => {
    const [y, m, day] = key.split("-").map(Number);
    expect(isHoliday(d(y, m, day))).toBe(true);
    expect(isBusinessDay(d(y, m, day))).toBe(false);
  });

  it("12/29〜1/3 は年末年始の休み（表にない年も）", () => {
    for (const [y, m, day] of [[2026, 12, 29], [2026, 12, 31], [2027, 1, 2], [2027, 1, 3], [2028, 1, 3]]) {
      expect(isHoliday(d(y, m, day))).toBe(true);
    }
    expect(isHoliday(d(2026, 12, 28))).toBe(false);
    expect(isHoliday(d(2027, 1, 4))).toBe(false);
  });

  it("ふつうの平日は営業日", () => {
    expect(isBusinessDay(d(2026, 11, 11))).toBe(true);
  });
});

describe("営業日の計算", () => {
  it("祝日の前の日から1営業日後は、祝日を飛ばす", () => {
    // 2026-11-20（金）→ 11/23（月・祝）を飛ばして 11/24（火）
    expect(toDateKey(addBusinessDays(d(2026, 11, 20), 1))).toBe("2026-11-24");
  });
  it("年末から1営業日後は、年明けの最初の営業日", () => {
    // 2026-12-28（月）→ 12/29〜1/3 を飛ばして 2027-01-04（月）
    expect(toDateKey(addBusinessDays(d(2026, 12, 28), 1))).toBe("2027-01-04");
  });
  it("休みの日は次の営業日にずらし、営業日ならそのまま", () => {
    expect(toDateKey(nextBusinessDay(d(2027, 1, 1)))).toBe("2027-01-04");
    expect(toDateKey(nextBusinessDay(d(2026, 11, 11)))).toBe("2026-11-11");
  });
});
