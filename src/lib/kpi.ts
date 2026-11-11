// SV画面の数字はすべてここで計算する。画面からは計算式を追い出し、テストで確かめられるようにする。

import { addDays, startOfDay, toDateKey } from "./dates";
import type { CallLog, Lead, Member, Objection } from "./types";

export type MemberStats = {
  memberId: string;
  calls: number;
  /** 担当者（決裁に関わる人）と話せた件数。担当者と話せた・折り返し・アポ・お断りを含む */
  connects: number;
  appointments: number;
  gatekeepers: number;
  connectRate: number;
  appointmentRate: number;
  gatekeeperRate: number;
};

export type TeamStats = {
  team: Omit<MemberStats, "memberId">;
  members: MemberStats[];
  objections: Record<Objection, number>;
  /** 日ごとの架電数とアポ数（古い順） */
  daily: { date: string; calls: number; appointments: number }[];
  overdueFollowups: number;
};

const CONNECTED = new Set(["decision_maker", "callback", "appointment", "rejected"]);

function rate(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function summarize(logs: CallLog[]): Omit<MemberStats, "memberId"> {
  const calls = logs.length;
  const connects = logs.filter((l) => CONNECTED.has(l.outcome)).length;
  const appointments = logs.filter((l) => l.outcome === "appointment").length;
  const gatekeepers = logs.filter((l) => l.outcome === "gatekeeper").length;
  return {
    calls,
    connects,
    appointments,
    gatekeepers,
    connectRate: rate(connects, calls),
    appointmentRate: rate(appointments, calls),
    gatekeeperRate: rate(gatekeepers, calls),
  };
}

export function filterLogsByRange(logs: CallLog[], from: Date, to: Date): CallLog[] {
  return logs.filter((l) => {
    const t = new Date(l.at);
    return t >= from && t < to;
  });
}

export function computeTeamStats(params: {
  logs: CallLog[];
  members: Member[];
  leads: Lead[];
  from: Date;
  to: Date;
  now: Date;
}): TeamStats {
  const { members, leads, from, to, now } = params;
  const logs = filterLogsByRange(params.logs, from, to);
  const callers = members.filter((m) => m.role === "member");

  const objections: Record<Objection, number> = {
    none: 0,
    busy: 0,
    no_need: 0,
    already_have: 0,
    price: 0,
    not_decision_maker: 0,
    other: 0,
  };
  for (const l of logs) {
    if (l.insight) objections[l.insight.objection]++;
  }

  const daily: TeamStats["daily"] = [];
  for (let d = startOfDay(from); d < to; d = addDays(d, 1)) {
    const key = toDateKey(d);
    const dayLogs = logs.filter((l) => toDateKey(new Date(l.at)) === key);
    if (d.getDay() === 0 || d.getDay() === 6) {
      if (dayLogs.length === 0) continue;
    }
    daily.push({
      date: key,
      calls: dayLogs.length,
      appointments: dayLogs.filter((l) => l.outcome === "appointment").length,
    });
  }

  const today = toDateKey(now);
  const overdueFollowups = leads.filter(
    (l) =>
      l.nextCallAt !== null &&
      (l.status === "followup" || l.status === "calling") &&
      toDateKey(new Date(l.nextCallAt)) < today,
  ).length;

  return {
    team: summarize(logs),
    members: callers.map((m) => ({
      memberId: m.id,
      ...summarize(logs.filter((l) => l.memberId === m.id)),
    })),
    objections,
    daily,
    overdueFollowups,
  };
}
