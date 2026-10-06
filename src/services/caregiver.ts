import { doc, getDoc, setDoc } from "firebase/firestore";
import { sessionForDate, sessionLetter } from "../data/trainingPlan";
import { auth, db } from "./firebaseConfig";
import { UserProfile, getLocalISODate, safeCount, trackingDocId } from "./nutrition";
import { pingCare, ensureCareReminders } from "./reminders";

function shiftIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getLocalISODate(date);
}

function fromIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function hoursSince(iso: string | undefined): number {
  if (!iso) return 99;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 99;
  return (Date.now() - then) / 36e5;
}

export async function runCaregiver(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const profile = snap.data() as UserProfile;
  await ensureCareReminders();

  const todayIso = getLocalISODate();
  const yesterdayIso = shiftIso(-1);
  const todayDoc = await getDoc(doc(db, "daily_tracking", trackingDocId(uid, todayIso)));
  const yesterdayDoc = await getDoc(doc(db, "daily_tracking", trackingDocId(uid, yesterdayIso)));
  const today = todayDoc.data();
  const yesterday = yesterdayDoc.data();
  const notes = [...(profile.careMemory?.notes ?? [])];
  const alerts: string[] = [];
  const hour = new Date().getHours();

  const yesterdaySession = profile.trainingPlan ? sessionForDate(profile.trainingPlan, fromIso(yesterdayIso)) : null;
  if (yesterdaySession && !yesterdaySession.rest && !yesterday?.workout_done) {
    const letter = profile.trainingPlan ? sessionLetter(profile.trainingPlan, yesterdaySession.id) : "";
    alerts.push(
      `Ontem era o treino ${letter || yesterdaySession.title}. Faz ele hoje na aba Treino; o descanso da semana se encaixa depois.`,
    );
    notes.unshift(`Faltou treino em ${yesterdayIso} (${letter} ${yesterdaySession.title}).`);
  }

  const todaySession = profile.trainingPlan ? sessionForDate(profile.trainingPlan) : null;
  if (todaySession && !todaySession.rest && !today?.workout_done && hour >= 16) {
    const letter = profile.trainingPlan ? sessionLetter(profile.trainingPlan, todaySession.id) : "";
    alerts.push(`Hoje ainda tem o treino ${letter || todaySession.title} sem marcar.`);
  }

  const waterToday = safeCount(today?.water_ml);
  const waterYesterday = safeCount(yesterday?.water_ml);
  if (hour >= 12 && waterToday < 200) {
    alerts.push("Quase não tem água marcada hoje.");
    notes.unshift(`Água baixa em ${todayIso}: ${waterToday} ml.`);
  } else if (hour >= 16 && waterToday < 400) {
    alerts.push("A água do dia ainda está curta.");
    notes.unshift(`Água baixa em ${todayIso}: ${waterToday} ml.`);
  } else if (hour >= 19 && waterToday < 800) {
    alerts.push("Ainda falta água hoje. Marca o que já tomou.");
  }
  if (waterYesterday === 0) {
    notes.unshift(`Água zerada em ${yesterdayIso}.`);
    if (!alerts.some((item) => item.includes("água") || item.includes("Água"))) {
      alerts.push("Ontem a água não foi marcada.");
    }
  }

  const nextNotes = [...new Set(notes)].slice(0, 40);
  const alert = alerts[0] ?? "";
  const sameAlert = profile.careMemory?.lastAlert === alert;
  const recent = hoursSince(profile.careMemory?.lastPingAt) < 2.5;
  if (!alert) {
    if (profile.careMemory?.lastCareAt === todayIso && !profile.careMemory.lastAlert) return;
    await setDoc(
      userRef,
      { careMemory: { notes: nextNotes, lastCareAt: todayIso, lastAlert: "", lastPingAt: profile.careMemory?.lastPingAt ?? null } },
      { merge: true },
    );
    return;
  }
  if (sameAlert && recent) return;

  await setDoc(
    userRef,
    {
      careMemory: {
        notes: nextNotes,
        lastCareAt: todayIso,
        lastAlert: alert,
        lastPingAt: new Date().toISOString(),
      },
    },
    { merge: true },
  );

  await pingCare("Shape está de olho", alert);
}

export async function clearTodayTrainingAlert(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const memory = snap.data()?.careMemory as UserProfile["careMemory"] | undefined;
  if (!memory?.lastAlert?.includes("Hoje ainda tem o treino")) return;
  await setDoc(userRef, { careMemory: { ...memory, lastAlert: "" } }, { merge: true });
}
