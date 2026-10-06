import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { scheduleFor } from "../data/dietSchedule";
import { mealReminderSlots, suggestedSchedule } from "../data/suggestedDiet";
import { coverageLine, prepLine } from "../data/pantry";
import { WeekClose } from "../data/weekClose";
import { weekBounds } from "../data/weekClose";
import { sessionForDate, sessionLetter } from "../data/trainingPlan";
import { loadWeekClose } from "../services/weekClose";
import { syncMealReminders, ensureWaterReminders } from "../services/reminders";
import { clearTodayTrainingAlert } from "../services/caregiver";
import { MainTabParamList } from "../navigation/types";
import { auth, db } from "../services/firebaseConfig";
import {
  DailyTracking,
  UserProfile,
  calculateTargets,
  emptyDay,
  getLocalISODate,
  needsWeighIn,
  safeCount,
  trackingDocId,
} from "../services/nutrition";
import { BrandLockup } from "../components/Mark";
import { GrowBar, Reveal, SoftTouch } from "../components/motion";
import { Edge } from "../components/Edge";
import { colors } from "../theme/colors";

type Props = BottomTabScreenProps<MainTabParamList, "Home">;
type HistoryItem = { date: string; data: DailyTracking | null };

const weekDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const waterAmounts = [200, 300, 500];

function liters(ml: number): string {
  return (safeCount(ml) / 1000).toFixed(1).replace(".", ",");
}

export function DashboardScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [today, setToday] = useState<DailyTracking>(emptyDay());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [weighOpen, setWeighOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [waterDraft, setWaterDraft] = useState("");
  const [reminders, setReminders] = useState<"on" | "denied" | "unavailable" | "pending">("pending");
  const [weekClose, setWeekClose] = useState<WeekClose | null>(null);
  const [routineDraft, setRoutineDraft] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    let unsubscribe = () => {};

    getDoc(doc(db, "users", uid)).then(async (snapshot) => {
      if (!snapshot.exists()) {
        navigation.getParent()?.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "Onboarding" }] }),
        );
        return;
      }
      const data = snapshot.data() as UserProfile;
      setProfile(data);
      setRoutineDraft(data.routineNote ?? "");
      setWeighOpen(needsWeighIn(data));

      const dates = Array.from({ length: 21 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (20 - index));
        return getLocalISODate(date);
      });
      const rows = await Promise.all(
        dates.map(async (date) => {
          const day = await getDoc(doc(db, "daily_tracking", trackingDocId(uid, date)));
          return { date, data: day.exists() ? (day.data() as DailyTracking) : null };
        }),
      );
      setHistory(rows);

      const unsubUser = onSnapshot(doc(db, "users", uid), (userSnap) => {
        if (!userSnap.exists()) return;
        setProfile(userSnap.data() as UserProfile);
      });
      const unsubDay = onSnapshot(doc(db, "daily_tracking", trackingDocId(uid)), (day) => {
        setToday(day.exists() ? (day.data() as DailyTracking) : emptyDay());
        setLoading(false);
      });
      unsubscribe = () => {
        unsubUser();
        unsubDay();
      };
    });

    return () => unsubscribe();
  }, [navigation]);

  useEffect(() => {
    ensureWaterReminders().then(setReminders);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const board = scheduleFor(profile.nutritionistPlan, profile.nutritionistPlanSource);
    void syncMealReminders(mealReminderSlots(board, profile.mealsPerDay), today.meals_done ?? {});
  }, [profile, today.meals_done]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !profile) return;
    const mealsPerDay = scheduleFor(profile.nutritionistPlan, profile.nutritionistPlanSource).length;
    const waterGoalMl = Math.max(2000, safeCount(profile.targets?.water_ml));
    loadWeekClose({ uid, plan: profile.trainingPlan, mealsPerDay, waterGoalMl }).then(setWeekClose);
  }, [profile, today]);

  async function handleWeighIn() {
    const weight = parseFloat(newWeight);
    const uid = auth.currentUser?.uid;
    if (!weight || !profile || !uid) {
      Alert.alert("Erro", "Digite um peso válido para recalcularmos sua dieta.");
      return;
    }
    const metrics = { ...profile.metrics, weight };
    const targets = calculateTargets(metrics);
    const lastWeighInDate = getLocalISODate();
    await setDoc(
      doc(db, "users", uid),
      { metrics, targets, lastWeighInDate },
      { merge: true },
    );
    await setDoc(doc(db, "daily_tracking", trackingDocId(uid)), { weight }, { merge: true });
    setProfile({ ...profile, metrics, targets, lastWeighInDate });
    setWeighOpen(false);
    setNewWeight("");
    if (weighOpen) {
      Alert.alert(
        "Evolução registrada",
        "As calorias e a proteína foram recalculadas com o peso de hoje.",
      );
    }
  }

  async function addWater(ml: number) {
    const uid = auth.currentUser?.uid;
    const amount = Math.round(ml);
    if (!uid || !Number.isFinite(amount) || amount <= 0) return;
    const entries = [...(today.water_entries ?? []), amount];
    const water_ml = entries.reduce((sum, item) => sum + safeCount(item), 0);
    const goal = Math.max(2000, safeCount(profile?.targets?.water_ml));
    await setDoc(
      doc(db, "daily_tracking", trackingDocId(uid)),
      { water_ml, water_entries: entries, water_done: water_ml >= goal },
      { merge: true },
    );
    setWaterDraft("");
  }

  async function undoWater() {
    const uid = auth.currentUser?.uid;
    if (!uid || !(today.water_entries ?? []).length) return;
    const entries = (today.water_entries ?? []).slice(0, -1);
    const water_ml = entries.reduce((sum, item) => sum + safeCount(item), 0);
    const goal = Math.max(2000, safeCount(profile?.targets?.water_ml));
    await setDoc(
      doc(db, "daily_tracking", trackingDocId(uid)),
      { water_ml, water_entries: entries, water_done: water_ml >= goal },
      { merge: true },
    );
  }

  async function saveRoutine() {
    const uid = auth.currentUser?.uid;
    const text = routineDraft.trim();
    if (!uid || !text) return;
    await setDoc(doc(db, "users", uid), { routineNote: text }, { merge: true });
    setProfile((current) => (current ? { ...current, routineNote: text } : current));
  }

  async function toggleHabit(field: "workout_done") {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(
      doc(db, "daily_tracking", trackingDocId(uid)),
      { [field]: !today[field] },
      { merge: true },
    );
    if (!today.workout_done) await clearTodayTrainingAlert();
  }

  if (loading || !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const targets = {
    calories: safeCount(profile.targets?.calories),
    protein: safeCount(profile.targets?.protein),
    carb: safeCount(profile.targets?.carb),
    fat: safeCount(profile.targets?.fat),
  };
  const waterGoal = Math.max(2000, safeCount(profile.targets?.water_ml) || Math.round(safeCount(profile.metrics?.weight) * 35));
  const waterMl = safeCount(today.water_ml);
  const meals = profile.nutritionistPlan?.trim()
    ? scheduleFor(profile.nutritionistPlan, profile.nutritionistPlanSource)
    : profile.mealsPerDay
      ? suggestedSchedule(profile.mealsPerDay, profile.foodAnswers)
      : [];
  const mealsDone = today.meals_done ?? {};
  const eaten = meals.filter((meal) => mealsDone[meal.id]).length;
  const workoutToday = profile.trainingPlan ? sessionForDate(profile.trainingPlan) : null;
  const workoutLetter = workoutToday && !workoutToday.rest && profile.trainingPlan
    ? sessionLetter(profile.trainingPlan, workoutToday.id)
    : "";
  const nextMeal = meals.find((meal) => !mealsDone[meal.id]);
  const cover = coverageLine(meals, mealsDone, profile.pantry);
  const leftover = prepLine(profile.pantry);
  const weekDots = history.slice(-7);
  const weightPoints = history
    .map((item) => (item.date === getLocalISODate() ? today.weight ?? item.data?.weight : item.data?.weight))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Reveal>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BrandLockup size={24} />
          <SoftTouch onPress={() => signOut(auth)} hitSlop={12}>
            <Text style={styles.leaveText}>Sair</Text>
          </SoftTouch>
        </View>
        <Text style={styles.greeting}>Olá, {profile.name || "Visitante"}</Text>
        <Text style={styles.dateLine}>{todayLabel}</Text>

        <View style={styles.card}>
          <Edge />
          <Text style={styles.section}>Rotina</Text>
          <Text style={styles.tileBody}>Horário de treino, fim de semana, o que o cuidador precisa lembrar.</Text>
          <TextInput
            style={styles.waterInput}
            placeholder="Treino depois do trabalho"
            placeholderTextColor={colors.textSecondary}
            value={routineDraft}
            onChangeText={setRoutineDraft}
          />
          <SoftTouch style={[styles.waterAddButton, { marginTop: 8, alignSelf: "flex-start", paddingVertical: 10 }]} onPress={saveRoutine}>
            <Text style={styles.waterAddText}>Guardar</Text>
          </SoftTouch>
        </View>

        {weekBounds().closing && weekClose ? (
          <SoftTouch
            style={[styles.chatButton, { marginBottom: 14 }]}
            onPress={() =>
              navigation.navigate("Chat", {
                seed: `Fecha a semana.\n${weekClose.script}\nDiz se a carga sobe e o que ajustar.`,
              })
            }
          >
            <Edge />
            <Text style={styles.chatButtonText}>Fechar a semana</Text>
          </SoftTouch>
        ) : null}

        {profile.careMemory?.lastAlert ? (
          <View style={styles.careCard}>
            <Edge />
            <Text style={styles.kicker}>Cuidador</Text>
            <Text style={styles.tileTitle}>{profile.careMemory.lastAlert}</Text>
          </View>
        ) : null}

        <View style={styles.todayRow}>
          <View style={styles.todayTile}>
            <Edge />
            <SoftTouch onPress={() => navigation.navigate("Treino")}>
              <Text style={styles.kicker}>Treino</Text>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {workoutToday
                  ? `${workoutLetter ? `${workoutLetter} · ` : ""}${workoutToday.title}`
                  : "Definir ficha"}
              </Text>
            </SoftTouch>
            <SoftTouch
              style={[styles.miniHabit, today.workout_done && styles.miniHabitOn]}
              onPress={() => toggleHabit("workout_done")}
            >
              <Text style={[styles.miniHabitText, today.workout_done && styles.miniHabitTextOn]}>
                {today.workout_done ? "Feito" : "Marcar"}
              </Text>
            </SoftTouch>
          </View>
          <SoftTouch style={styles.todayTile} onPress={() => navigation.navigate("Dieta")}>
            <Edge />
            <Text style={styles.kicker}>Dieta</Text>
            <Text style={styles.tileTitle}>
              {meals.length ? `${eaten} de ${meals.length}` : "Sem cardápio"}
            </Text>
            <Text style={styles.tileBody} numberOfLines={3}>
              {cover ||
                (nextMeal
                  ? `Próxima: ${nextMeal.title}`
                  : meals.length
                    ? "Refeições do dia marcadas."
                    : "Abre a aba Dieta.")}
            </Text>
          </SoftTouch>
        </View>

        {leftover ? (
          <View style={styles.card}>
            <Edge />
            <Text style={styles.kicker}>Preparo</Text>
            <Text style={styles.tileTitle}>{leftover}</Text>
          </View>
        ) : null}

        <View style={styles.statGrid}>
          <StatCell label="kcal" value={Math.round(today.total_calories)} max={targets.calories} color={colors.calories} />
          <StatCell label="prot" value={Math.round(today.total_protein)} max={targets.protein} color={colors.primary} />
          <StatCell label="carb" value={Math.round(today.total_carbs)} max={targets.carb} color={colors.carbs} />
          <StatCell label="água" value={liters(waterMl)} maxLabel={`${liters(waterGoal)} L`} color={colors.fat} />
        </View>

        <View style={styles.card}>
          <Edge />
          <Text style={styles.section}>Água agora</Text>
          <View style={styles.waterAmounts}>
            {waterAmounts.map((amount) => (
              <SoftTouch key={amount} style={styles.waterChip} onPress={() => addWater(amount)}>
                <Text style={styles.waterChipText}>{amount}</Text>
              </SoftTouch>
            ))}
          </View>
          <View style={styles.waterAdd}>
            <TextInput
              style={styles.waterInput}
              placeholder="ml"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={waterDraft}
              onChangeText={setWaterDraft}
            />
            <SoftTouch style={styles.waterAddButton} onPress={() => addWater(parseFloat(waterDraft.replace(",", ".")))}>
              <Text style={styles.waterAddText}>Somar</Text>
            </SoftTouch>
          </View>
          {(today.water_entries ?? []).length ? (
            <SoftTouch onPress={undoWater}>
              <Text style={styles.waterUndo}>Desfazer {(today.water_entries ?? []).at(-1)} ml</Text>
            </SoftTouch>
          ) : null}
          {reminders === "on" ? null : (
            <Text style={styles.tileBody}>
              {reminders === "denied"
                ? "Avisos de água desligados nas permissões."
                : "Avisos de água entram no app instalado."}
            </Text>
          )}
        </View>

        {weekClose ? (
          <View style={styles.card}>
            <Edge />
            <Text style={styles.kicker}>{weekClose.title}</Text>
            <Text style={styles.closeLoad}>{weekClose.load}</Text>
            <Text style={styles.tileBody}>{weekClose.training}</Text>
            <Text style={styles.tileBody}>{weekClose.water}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Edge />
          <Text style={styles.section}>Semana</Text>
          <View style={styles.weekStrip}>
            {weekDots.map((item) => {
              const day = item.date === getLocalISODate() ? today : item.data;
              const date = new Date(`${item.date}T12:00:00`);
              const session = profile.trainingPlan ? sessionForDate(profile.trainingPlan, date) : null;
              const isToday = item.date === getLocalISODate();
              const trained = Boolean(!session?.rest && day?.workout_done);
              const rest = Boolean(session?.rest);
              return (
                <View
                  key={item.date}
                  style={[
                    styles.weekDot,
                    isToday && styles.weekDotToday,
                    trained && styles.weekDotOn,
                    rest && styles.weekDotRest,
                  ]}
                >
                  <Text style={[styles.weekDotLabel, (trained || isToday) && styles.weekDotLabelOn]}>
                    {weekDays[date.getDay()]}
                  </Text>
                  <Text style={[styles.weekDotNum, trained && styles.weekDotLabelOn]}>{date.getDate()}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.waterAdd}>
            <TextInput
              style={styles.waterInput}
              placeholder="peso kg"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={newWeight}
              onChangeText={setNewWeight}
            />
            <SoftTouch style={styles.waterAddButton} onPress={handleWeighIn}>
              <Text style={styles.waterAddText}>Peso</Text>
            </SoftTouch>
          </View>
          <WeightSpark points={weightPoints} />
        </View>

        <SoftTouch style={styles.card} onPress={() => navigation.navigate("Dieta")}>
          <Edge />
          <Text style={styles.section}>Refeições</Text>
          {meals.length ? (
            meals.map((meal) => (
              <View key={meal.id} style={styles.dietRow}>
                <Text style={styles.dietCheck}>{mealsDone[meal.id] ? "✓" : "○"}</Text>
                <Text style={styles.dietTitle} numberOfLines={1}>
                  {meal.title}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.dietOption}>Diz quantas refeições faz, na aba Dieta.</Text>
          )}
        </SoftTouch>

        <View style={styles.card}>
          <Edge />
          <ProgressBar label="Calorias" current={today.total_calories} target={targets.calories} suffix=" kcal" color={colors.calories} />
          <ProgressBar label="Proteína" current={today.total_protein} target={targets.protein} suffix="g" color={colors.primary} />
          <ProgressBar label="Carboidratos" current={today.total_carbs} target={targets.carb} suffix="g" color={colors.carbs} />
          <ProgressBar label="Gorduras" current={today.total_fats} target={targets.fat} suffix="g" color={colors.fat} />
        </View>

        <SoftTouch style={[styles.chatButton, { marginTop: 8 }]} onPress={() => navigation.navigate("Chat")}>
          <Edge />
          <Text style={styles.chatButtonText}>Falar com o tutor</Text>
        </SoftTouch>
      </ScrollView>
      </Reveal>

      <Modal visible={weighOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hora da Evolução! ⚖️</Text>
            <Text style={styles.modalBody}>
              Faz mais de 7 dias desde o seu último registro. Coloque seu peso em jejum hoje para que eu ajuste suas calorias e proteínas e você continue quebrando platôs.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 82.5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={newWeight}
              onChangeText={setNewWeight}
            />
            <SoftTouch style={styles.chatButton} onPress={handleWeighIn}>
              <Edge />
              <Text style={styles.chatButtonText}>Recalcular Dieta!</Text>
            </SoftTouch>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function WeightSpark({ points }: { points: number[] }) {
  if (!points.length) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 36, gap: 3 }}>
        {points.map((weight, index) => (
          <View
            key={`${weight}-${index}`}
            style={{
              flex: 1,
              height: 8 + ((weight - min) / span) * 28,
              backgroundColor: colors.primary,
              borderRadius: 3,
              opacity: 0.35 + (0.65 * index) / Math.max(1, points.length - 1),
            }}
          />
        ))}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
        {points.length === 1
          ? `${points[0].toFixed(1).replace(".", ",")} kg`
          : `${points[0].toFixed(1).replace(".", ",")} → ${points[points.length - 1].toFixed(1).replace(".", ",")} kg`}
      </Text>
    </View>
  );
}

function StatCell({
  label,
  value,
  max,
  maxLabel,
  color,
}: {
  label: string;
  value: number | string;
  max?: number;
  maxLabel?: string;
  color: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>
        {label}
        {max != null ? ` / ${Math.round(max)}` : maxLabel ? ` / ${maxLabel}` : ""}
      </Text>
    </View>
  );
}

function ProgressBar({
  label,
  current,
  target,
  suffix,
  color,
}: {
  label: string;
  current: number;
  target: number;
  suffix: string;
  color: string;
}) {
  const currentValue = safeCount(current);
  const targetValue = safeCount(target);
  const width = targetValue > 0 ? Math.max(0, Math.min(100, (currentValue / targetValue) * 100)) : 0;
  return (
    <View style={styles.barBlock}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>
          {Math.round(currentValue)} / {Math.round(targetValue)}
          {suffix}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <GrowBar percent={width} color={color} style={styles.barFill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  greeting: { color: colors.text, fontSize: 28, fontWeight: "800" },
  dateLine: { color: colors.textSecondary, marginTop: 4, marginBottom: 16, textTransform: "capitalize" },
  todayRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  todayTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 132,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  kicker: { color: colors.primary, fontWeight: "700", fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" },
  tileTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 8, lineHeight: 22 },
  tileBody: { color: colors.textSecondary, marginTop: 8, lineHeight: 18, fontSize: 13 },
  miniHabit: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniHabitOn: { backgroundColor: colors.primary },
  miniHabitText: { color: colors.text, fontWeight: "800", fontSize: 12 },
  miniHabitTextOn: { color: colors.background },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statCell: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, marginTop: 2, fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  section: { color: colors.text, fontWeight: "700", marginBottom: 12 },
  closeLoad: { color: colors.primary, fontWeight: "700", lineHeight: 20, marginTop: 6 },
  dietRow: { flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "center" },
  dietCheck: { color: colors.primary, width: 16, fontWeight: "800" },
  dietTitle: { color: colors.text, fontWeight: "700", flex: 1 },
  dietOption: { color: colors.textSecondary, fontSize: 13 },
  weekStrip: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  weekDot: {
    width: 40,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: colors.surfaceHighlight,
  },
  weekDotToday: { borderWidth: 1, borderColor: colors.primary },
  weekDotOn: { backgroundColor: colors.primary },
  weekDotRest: { opacity: 0.55 },
  weekDotLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  weekDotNum: { color: colors.text, fontWeight: "800", marginTop: 2 },
  weekDotLabelOn: { color: colors.background },
  waterAmounts: { flexDirection: "row", gap: 8, marginBottom: 10 },
  waterChip: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  waterChipText: { color: colors.text, fontWeight: "700" },
  waterAdd: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 8 },
  waterInput: {
    flex: 1,
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  waterAddButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  waterAddText: { color: colors.background, fontWeight: "800" },
  waterUndo: { color: colors.primary, fontWeight: "700", marginBottom: 8 },
  barBlock: { marginBottom: 14 },
  barHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  barLabel: { color: colors.text, fontWeight: "600" },
  barValue: { color: colors.textSecondary },
  barTrack: { height: 10, backgroundColor: colors.surfaceHighlight, borderRadius: 99, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 99 },
  chatButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", overflow: "hidden" },
  chatButtonText: { color: colors.background, fontWeight: "800" },
  leaveText: { color: colors.textSecondary, fontWeight: "700" },
  careCard: {
    backgroundColor: colors.wash,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: "hidden",
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20 },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  modalBody: { color: colors.textSecondary, marginVertical: 12, lineHeight: 20 },
  modalInput: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
