import type { CallLog, Lead } from "../types";
import type { SeedData } from "../seed";

/**
 * 保存先の共通の窓口。
 * デモデータ（架空の案件・過去の架電記録）は毎回同じ規則で作り直せるので保存しない。
 * 保存するのは「お試しを始めた日」と「利用者が追加した記録・案件の変更」だけにして、書き込み回数を抑える。
 */
export interface DataStore {
  readonly kind: "local" | "firestore";
  load(): Promise<SeedData>;
  saveCall(log: CallLog, lead: Lead): Promise<void>;
  reset(): Promise<void>;
}

export type LeadPatch = Pick<Lead, "id" | "status" | "nextCallAt">;

export function mergeWorkspace(
  seed: SeedData,
  addedLogs: CallLog[],
  patches: LeadPatch[],
): SeedData {
  const leads = seed.leads.map((l) => {
    const p = patches.find((x) => x.id === l.id);
    return p ? { ...l, status: p.status, nextCallAt: p.nextCallAt } : l;
  });
  const logs = [...seed.logs, ...addedLogs].sort((a, b) => a.at.localeCompare(b.at));
  return { members: seed.members, leads, logs };
}
