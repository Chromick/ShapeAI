import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, Vibration, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckPop, Reveal, SoftTouch, easeLayout } from "../components/motion";
import { Exercise, LoadMemory, StoredPlan, loadKey, loadSlots, rulesFor, sessionForDate, volumeOf } from "../data/trainingPlan";
import { MainTabParamList } from "../navigation/types";
import { auth, db } from "../services/firebaseConfig";
import { UserProfile, getLocalISODate, trackingDocId } from "../services/nutrition";
import { formatRest, restIsRunning, restSecondsLeft, startRest, stopRest, finishRestIfDone } from "../services/restTimer";
import { openHealthConnectDownload, readWatchNight } from "../services/watchSleep";
import { colors } from "../theme/colors";

type Props = BottomTabScreenProps<MainTabParamList, "Treino">;

type WorkoutLog = {
  done: string[];
  loads: Record<string, string[] | string>;
};

function filled(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeLoads(raw: string[] | string | undefined, count: number): string[] {
  if (Array.isArray(raw)) return Array.from({ length: count }, (_, index) => String(raw[index] ?? ""));
  if (typeof raw === "string" && raw.trim()) {
    return Array.from({ length: count }, (_, index) => (index === count - 1 ? raw : ""));
  }
  return Array.from({ length: count }, () => "");
}

export function WorkoutScreen({ navigation }: Props) {
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [ready, setReady] = useState(false);
  const [log, setLog] = useState<WorkoutLog>({ done: [], loads: {} });
  const [memory, setMemory] = useState<Record<string, LoadMemory>>({});
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [sleep, setSleep] = useState<"good" | "poor" | null>(null);
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [restingHeartRate, setRestingHeartRate] = useState<number | null>(null);
  const [watchNote, setWatchNote] = useState("");
  const [watchBusy, setWatchBusy] = useState(false);
  const [offerDownload, setOfferDownload] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [restChoice, setRestChoice] = useState(90);
  const [restTick, setRestTick] = useState(0);
  const logRef = useRef(log);
  logRef.current = log;
  const memoryRef = useRef(memory);
  memoryRef.current = memory;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const today = plan ? sessionForDate(plan) : null;
  const restLeft = restIsRunning() ? restSecondsLeft() : 0;
  void restTick;

  useEffect(() => {
    const id = setInterval(() => {
      if (finishRestIfDone()) Vibration.vibrate(400);
      setRestTick((tick) => tick + 1);
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (snapshot) => {
      const data = snapshot.data() as UserProfile | undefined;
      setPlan(data?.trainingPlan ?? null);
      setMemory(data?.lastLoads ?? {});
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return onSnapshot(doc(db, "workout_logs", trackingDocId(uid)), (snapshot) => {
      if (!snapshot.exists()) {
        setLog({ done: [], loads: {} });
        return;
      }
      const data = snapshot.data() as Partial<WorkoutLog>;
      setLog({ done: data.done ?? [], loads: data.loads ?? {} });
    });
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return onSnapshot(doc(db, "daily_tracking", trackingDocId(uid)), (snapshot) => {
      const data = snapshot.data();
      const value = data?.sleep;
      setSleep(value === "good" || value === "poor" ? value : null);
      setSleepHours(typeof data?.sleepHours === "number" ? data.sleepHours : null);
      setRestingHeartRate(typeof data?.restingHeartRate === "number" ? data.restingHeartRate : null);
    });
  }, []);

  async function chooseSleep(
    value: "good" | "poor",
    extra?: { hours?: number; restingHeartRate?: number; source?: string },
  ) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSleep(value);
    const payload: { sleep: "good" | "poor"; sleepHours?: number; restingHeartRate?: number; sleepSource?: string } = {
      sleep: value,
    };
    if (extra?.hours != null) {
      payload.sleepHours = extra.hours;
      setSleepHours(extra.hours);
    }
    if (extra?.restingHeartRate != null) {
      payload.restingHeartRate = extra.restingHeartRate;
      setRestingHeartRate(extra.restingHeartRate);
    }
    if (extra?.source) payload.sleepSource = extra.source;
    await setDoc(doc(db, "daily_tracking", trackingDocId(uid)), payload, { merge: true });
  }

  async function pullWatch() {
    if (watchBusy) return;
    setWatchBusy(true);
    setWatchNote("");
    setOfferDownload(false);
    const result = await readWatchNight();
    setWatchBusy(false);
    if (!result.ok) {
      setWatchNote(result.message);
      setOfferDownload(Boolean(result.download));
      return;
    }
    const heart = result.night.restingHeartRate ? ` Frequência em repouso: ${result.night.restingHeartRate} bpm.` : "";
    setWatchNote(`${result.night.hours.toString().replace(".", ",")} h de sono, pela ${result.night.source}.${heart}`);
    await chooseSleep(result.night.quality, {
      hours: result.night.hours,
      restingHeartRate: result.night.restingHeartRate,
      source: result.night.source,
    });
  }

  async function persist(next: WorkoutLog) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLog(next);
    await setDoc(doc(db, "workout_logs", trackingDocId(uid)), {
      ...next,
      sessionId: today?.id,
      date: getLocalISODate(),
    });
    const finished = today && !today.rest && today.exercises.every((exercise) => next.done.includes(exercise.id));
    if (finished) {
      await setDoc(doc(db, "daily_tracking", trackingDocId(uid)), { workout_done: true }, { merge: true });
    }
  }

  function shownLoads(exercise: Exercise): string[] {
    const count = loadSlots(exercise).length;
    if (drafts[exercise.id]) return normalizeLoads(drafts[exercise.id], count);
    const fromToday = normalizeLoads(log.loads[exercise.id], count);
    if (filled(fromToday).length) return fromToday;
    return normalizeLoads(memory[loadKey(exercise.name)]?.values, count);
  }

  function showingLast(exercise: Exercise): boolean {
    if (drafts[exercise.id] && filled(drafts[exercise.id]).length) return false;
    if (filled(normalizeLoads(log.loads[exercise.id], loadSlots(exercise).length)).length) return false;
    return filled(memory[loadKey(exercise.name)]?.values ?? []).length > 0;
  }

  function editLoad(exercise: Exercise, index: number, value: string) {
    const base = draftsRef.current[exercise.id] ?? shownLoads(exercise);
    const next = base.slice();
    next[index] = value;
    const all = { ...draftsRef.current, [exercise.id]: next };
    draftsRef.current = all;
    setDrafts(all);
  }

  async function saveLoads(exercise: Exercise) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const values = draftsRef.current[exercise.id] ?? shownLoads(exercise);
    const next = {
      ...logRef.current,
      loads: { ...logRef.current.loads, [exercise.id]: values },
    };
    await persist(next);
    if (!filled(values).length) return;
    const remembered = {
      ...memoryRef.current,
      [loadKey(exercise.name)]: { values, date: getLocalISODate() },
    };
    memoryRef.current = remembered;
    setMemory(remembered);
    await setDoc(doc(db, "users", uid), { lastLoads: remembered }, { merge: true });
  }

  function toggle(exercise: Exercise) {
    easeLayout();
    const marking = !log.done.includes(exercise.id);
    const done = marking ? [...log.done, exercise.id] : log.done.filter((id) => id !== exercise.id);
    persist({ ...log, done });
    if (marking) void startRest(restChoice);
  }

  if (!ready || !plan || !today) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Reveal style={styles.empty}>
          <Text style={styles.title}>Treino</Text>
          <Text style={styles.summary}>
            Escolhe até duas prioridades e quantos dias você treina. A ficha sai disso.
          </Text>
          <SoftTouch style={styles.button} onPress={() => navigation.getParent()?.navigate("TrainingSetup")}>
            <Text style={styles.buttonText}>Definir prioridades</Text>
          </SoftTouch>
        </Reveal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Reveal>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{today.dayLabel}</Text>
        <Text style={styles.title}>{today.title}</Text>
        <Text style={styles.summary}>{today.summary}</Text>
        {plan.progressionReason ? <Text style={styles.summary}>{plan.progressionReason}</Text> : null}

        {today.rest ? null : (
          <View style={styles.sleepBox}>
            <Text style={styles.sleepTitle}>Como foi o sono?</Text>
            <View style={styles.sleepRow}>
              <SoftTouch
                style={[styles.sleepButton, sleep === "good" && styles.sleepOn]}
                onPress={() => chooseSleep("good")}
              >
                <Text style={[styles.sleepButtonText, sleep === "good" && styles.sleepTextOn]}>Dormiu bem</Text>
              </SoftTouch>
              <SoftTouch
                style={[styles.sleepButton, sleep === "poor" && styles.sleepOn]}
                onPress={() => chooseSleep("poor")}
              >
                <Text style={[styles.sleepButtonText, sleep === "poor" && styles.sleepTextOn]}>Dormiu mal</Text>
              </SoftTouch>
            </View>
            {sleep ? (
              <Text style={styles.sleepNote}>
                {sleep === "poor"
                  ? "Sono ruim. Mantém a carga da última vez, sem subir."
                  : "Sono ok. Se as repetições fecharam, pode subir a carga."}
                {sleepHours != null ? ` Relógio: ${String(sleepHours).replace(".", ",")} h.` : ""}
                {restingHeartRate != null ? ` Repouso: ${restingHeartRate} bpm.` : ""}
              </Text>
            ) : null}
            <SoftTouch style={styles.watchButton} onPress={pullWatch} disabled={watchBusy}>
              <Text style={styles.watchButtonText}>
                {watchBusy ? "Procurando a Conexão Saúde..." : "Buscar conexão com aparelhos"}
              </Text>
            </SoftTouch>
            <Text style={styles.watchHelp}>
              Ao abrir o app, o sono desta noite entra sozinho se a Conexão Saúde já tiver o dado. O botão abaixo procura de novo.
            </Text>
            {watchNote ? <Text style={styles.watchNote}>{watchNote}</Text> : null}
            {offerDownload ? (
              <SoftTouch style={styles.watchButton} onPress={() => openHealthConnectDownload()}>
                <Text style={styles.watchButtonText}>Baixar Conexão Saúde</Text>
              </SoftTouch>
            ) : null}
          </View>
        )}

        {today.rest ? null : (
          <View style={styles.sleepBox}>
            <Text style={styles.sleepTitle}>Descanso entre as séries</Text>
            <Text style={styles.restClock}>{formatRest(restIsRunning() ? restLeft : restChoice)}</Text>
            <View style={styles.sleepRow}>
              {[60, 90, 120, 180].map((seconds) => (
                <SoftTouch
                  key={seconds}
                  style={[styles.restChip, restChoice === seconds && styles.sleepOn]}
                  onPress={() => setRestChoice(seconds)}
                >
                  <Text style={[styles.restChipText, restChoice === seconds && styles.sleepTextOn]}>
                    {formatRest(seconds)}
                  </Text>
                </SoftTouch>
              ))}
            </View>
            <SoftTouch
              style={styles.watchButton}
              onPress={() => (restIsRunning() ? stopRest() : startRest(restChoice))}
            >
              <Text style={styles.watchButtonText}>{restIsRunning() ? "Parar descanso" : "Iniciar descanso"}</Text>
            </SoftTouch>
          </View>
        )}

        {today.rest ? null : (
          <View style={styles.card}>
            {today.exercises.map((exercise, index) => {
              const checked = log.done.includes(exercise.id);
              const slots = loadSlots(exercise);
              const values = shownLoads(exercise);
              return (
                <View key={exercise.id} style={styles.exercise}>
                  <SoftTouch style={styles.exerciseHead} onPress={() => toggle(exercise)}>
                    <CheckPop on={checked}>
                      <View style={[styles.check, checked && styles.checkOn]}>
                        <Text style={styles.checkMark}>{checked ? "✓" : String(index + 1)}</Text>
                      </View>
                    </CheckPop>
                    <View style={styles.exerciseText}>
                      <Text style={styles.exerciseName}>
                        {exercise.priority ? "Prioridade · " : ""}
                        {exercise.name}
                      </Text>
                      <Text style={styles.meta}>
                        {exercise.muscle} · {exercise.sets} séries · {exercise.scheme}
                      </Text>
                      <Text style={styles.why}>
                        {exercise.swappedFrom ? `No lugar de ${exercise.swappedFrom}. ` : ""}
                        {exercise.why}
                      </Text>
                    </View>
                  </SoftTouch>
                  {slots.map((label, slotIndex) => (
                    <View key={`${exercise.id}-${label}`} style={styles.loadRow}>
                      <Text style={styles.loadLabel}>{label}</Text>
                      <TextInput
                        style={styles.load}
                        placeholder="kg"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="decimal-pad"
                        value={values[slotIndex] ?? ""}
                        onChangeText={(value) => editLoad(exercise, slotIndex, value)}
                        onEndEditing={() => saveLoads(exercise)}
                      />
                    </View>
                  ))}
                  <SoftTouch style={styles.restLink} onPress={() => startRest(restChoice)}>
                    <Text style={styles.restLinkText}>Descanso {formatRest(restChoice)}</Text>
                  </SoftTouch>
                  {showingLast(exercise) ? (
                    <Text style={styles.lastHint}>
                      Última vez
                      {memory[loadKey(exercise.name)]?.date ? ` · ${memory[loadKey(exercise.name)].date}` : ""}
                      {sleep === "poor" ? " · não sobe hoje" : ""}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.section}>Semana</Text>
        {plan.sessions.map((session) => (
          <View key={session.id} style={[styles.weekRow, session.id === today.id && styles.weekToday]}>
            <Text style={styles.weekDay}>{session.dayLabel}</Text>
            <Text style={styles.weekTitle}>{session.rest ? "Descanso" : session.title}</Text>
          </View>
        ))}

        <Text style={styles.section}>Volume da semana</Text>
        {volumeOf(plan).map((item) => (
          <View key={item.muscle} style={styles.weekRow}>
            <Text style={styles.weekTitle}>{item.muscle}</Text>
            <Text style={styles.sets}>
              {item.sets} séries{item.priority ? " · prioridade" : ""}
            </Text>
          </View>
        ))}

        <SoftTouch onPress={() => navigation.getParent()?.navigate("TrainingSetup")}>
          <Text style={styles.rulesToggle}>Mudar prioridades e gerar de novo</Text>
        </SoftTouch>
        <SoftTouch
          onPress={() => {
            easeLayout();
            setShowRules((open) => !open);
          }}
        >
          <Text style={styles.rulesToggle}>{showRules ? "Ocultar regras" : "Ver regras do treino"}</Text>
        </SoftTouch>
        {showRules ? <Text style={styles.rules}>{rulesFor(plan)}</Text> : null}
      </ScrollView>
      </Reveal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  kicker: { color: colors.primary, fontWeight: "700" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800", marginTop: 4 },
  summary: { color: colors.textSecondary, marginTop: 8, marginBottom: 16, lineHeight: 20 },
  sleepBox: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sleepTitle: { color: colors.text, fontWeight: "800" },
  sleepNote: { color: colors.textSecondary, marginTop: 8, lineHeight: 20 },
  sleepRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  sleepButton: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  sleepButtonText: { color: colors.text, fontWeight: "700" },
  sleepOn: { backgroundColor: colors.primary },
  sleepTextOn: { color: colors.background },
  watchButton: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    alignItems: "center",
  },
  watchButtonText: { color: colors.primary, fontWeight: "800" },
  watchHelp: { color: colors.textSecondary, marginTop: 8, lineHeight: 18, fontSize: 13 },
  watchNote: { color: colors.text, marginTop: 8, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exercise: { marginBottom: 14 },
  exerciseHead: { flexDirection: "row", gap: 12 },
  check: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.primary },
  checkMark: { color: colors.background, fontWeight: "800" },
  exerciseText: { flex: 1 },
  exerciseName: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.primary, marginTop: 2, fontSize: 12 },
  why: { color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  loadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginLeft: 44 },
  loadLabel: { color: colors.primary, width: 42, fontWeight: "800", fontSize: 12 },
  load: {
    flex: 1,
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lastHint: { color: colors.textSecondary, marginLeft: 44, marginTop: 4, fontSize: 12 },
  restClock: { color: colors.text, fontSize: 40, fontWeight: "800", marginTop: 6 },
  restChip: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  restChipText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  restLink: { marginLeft: 44, marginTop: 8 },
  restLinkText: { color: colors.primary, fontWeight: "700" },
  section: { color: colors.text, fontWeight: "800", marginTop: 22, marginBottom: 8 },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekToday: { backgroundColor: colors.wash, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 10 },
  weekDay: { color: colors.textSecondary, width: 80 },
  weekTitle: { color: colors.text, flex: 1 },
  sets: { color: colors.primary, fontSize: 12 },
  rulesToggle: { color: colors.primary, marginTop: 18, fontWeight: "700" },
  rules: { color: colors.textSecondary, marginTop: 8, lineHeight: 20 },
  empty: { flex: 1, padding: 24, justifyContent: "center" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: colors.background, fontWeight: "800" },
});
