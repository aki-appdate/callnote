import { createSeedData } from "../seed";
import type { CallLog, Lead } from "../types";
import { mergeWorkspace, type DataStore, type LeadPatch } from "./types";

// Firebaseが未設定のときの保存先。このブラウザの中だけに保存する。

// v1 は「お試しを始めた日時」を基準にデモデータを作っていた。数日後に開くとデータが古びるため、
// v2 から毎回「今日」を基準に作り直し、利用者が追加した分だけを保存する。
const KEY = "callnote:workspace:v2";
const OLD_KEYS = ["callnote:workspace:v1"];

type Saved = { logs: CallLog[]; patches: LeadPatch[] };

function read(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 保存できない環境（プライベートモード等）でも、画面上の操作は続けられる
  }
}

export class LocalStore implements DataStore {
  readonly kind = "local" as const;
  private state: Saved | null = null;

  async load() {
    try {
      OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {}
    this.state = read() ?? { logs: [], patches: [] };
    return mergeWorkspace(createSeedData(new Date()), this.state.logs, this.state.patches);
  }

  async saveCall(log: CallLog, lead: Lead) {
    if (!this.state) await this.load();
    const s = this.state!;
    s.logs.push(log);
    s.patches = [...s.patches.filter((p) => p.id !== lead.id), { id: lead.id, status: lead.status, nextCallAt: lead.nextCallAt }];
    write(s);
  }

  async reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    this.state = null;
  }
}
