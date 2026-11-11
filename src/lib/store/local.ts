import { createSeedData } from "../seed";
import type { CallLog, Lead } from "../types";
import { mergeWorkspace, type DataStore, type LeadPatch } from "./types";

// Firebaseが未設定のときの保存先。このブラウザの中だけに保存する。

const KEY = "callnote:workspace:v1";

type Saved = { seedBase: string; logs: CallLog[]; patches: LeadPatch[] };

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
    this.state = read() ?? { seedBase: new Date().toISOString(), logs: [], patches: [] };
    write(this.state);
    return mergeWorkspace(createSeedData(new Date(this.state.seedBase)), this.state.logs, this.state.patches);
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
