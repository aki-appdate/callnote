import { getAuth, signInAnonymously } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { FirebaseApp } from "firebase/app";
import { createSeedData } from "../seed";
import type { CallLog, Lead } from "../types";
import { mergeWorkspace, type DataStore, type LeadPatch } from "./types";

// Firebaseが設定されているときの保存先。
// お試しの人ごとに匿名ログインし、workspaces/{uid} の下にだけ書き込む（他人のデータは読めない。firestore.rules参照）。

export class FirestoreStore implements DataStore {
  readonly kind = "firestore" as const;
  private db: Firestore;
  private uid: string | null = null;

  constructor(private app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  private async userId(): Promise<string> {
    if (this.uid) return this.uid;
    const auth = getAuth(this.app);
    const cred = auth.currentUser ?? (await signInAnonymously(auth)).user;
    this.uid = cred.uid;
    return cred.uid;
  }

  async load() {
    const uid = await this.userId();
    const wsRef = doc(this.db, "workspaces", uid);
    const ws = await getDoc(wsRef);
    let seedBase: string;
    if (ws.exists()) {
      seedBase = ws.data().seedBase as string;
    } else {
      seedBase = new Date().toISOString();
      await setDoc(wsRef, { seedBase });
    }
    const [logsSnap, patchSnap] = await Promise.all([
      getDocs(collection(wsRef, "logs")),
      getDocs(collection(wsRef, "leadPatches")),
    ]);
    const logs = logsSnap.docs.map((d) => d.data() as CallLog);
    const patches = patchSnap.docs.map((d) => d.data() as LeadPatch);
    return mergeWorkspace(createSeedData(new Date(seedBase)), logs, patches);
  }

  async saveCall(log: CallLog, lead: Lead) {
    const uid = await this.userId();
    const wsRef = doc(this.db, "workspaces", uid);
    const batch = writeBatch(this.db);
    batch.set(doc(wsRef, "logs", log.id), log);
    batch.set(doc(wsRef, "leadPatches", lead.id), {
      id: lead.id,
      status: lead.status,
      nextCallAt: lead.nextCallAt,
    } satisfies LeadPatch);
    await batch.commit();
  }

  async reset() {
    const uid = await this.userId();
    const wsRef = doc(this.db, "workspaces", uid);
    const [logsSnap, patchSnap] = await Promise.all([
      getDocs(collection(wsRef, "logs")),
      getDocs(collection(wsRef, "leadPatches")),
    ]);
    const batch = writeBatch(this.db);
    logsSnap.docs.forEach((d) => batch.delete(d.ref));
    patchSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    await deleteDoc(wsRef);
  }
}
