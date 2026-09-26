import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { trackingDocId } from "./nutrition";
import { readWatchNight } from "./watchSleep";

export async function syncWatchSleepOnce(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const ref = doc(db, "daily_tracking", trackingDocId(uid));
  const snapshot = await getDoc(ref);
  const data = snapshot.data();
  if (data?.sleepSource || typeof data?.sleepHours === "number") return;

  const result = await readWatchNight();
  if (!result.ok) return;

  const payload: {
    sleep: "good" | "poor";
    sleepHours: number;
    sleepSource: string;
    restingHeartRate?: number;
  } = {
    sleep: result.night.quality,
    sleepHours: result.night.hours,
    sleepSource: result.night.source,
  };
  if (result.night.restingHeartRate != null) payload.restingHeartRate = result.night.restingHeartRate;
  await setDoc(ref, payload, { merge: true });
}
