import type { CallLog, Lead } from "../types";
import type { SeedData } from "../seed";

/**
 * 保存先の共通の窓口。
 * デモデータ（架空の案件・過去の架電記録）は、開くたびに「今日」を基準に同じ規則で作り直すので保存しない。
 * 保存するのは「利用者が追加した記録・案件の変更」だけにして、書き込み回数を抑える。
 * 利用者の記録は保存した日時のまま重ねる（何日後に開いても、デモデータ側は古びない）。
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
  const byId = new Map(patches.map((p) => [p.id, p]));
  const leads = seed.leads.map((l) => {
    const p = byId.get(l.id);
    return p ? { ...l, status: p.status, nextCallAt: p.nextCallAt } : l;
  });
  const logs = [...seed.logs, ...addedLogs].sort((a, b) => a.at.localeCompare(b.at));
  return { members: seed.members, leads, logs };
}
