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
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { optionLabel, scheduleFor } from "../data/dietSchedule";
import { WeekClose } from "../data/weekClose";
import { sessionForDate } from "../data/trainingPlan";
import { loadWeekClose } from "../services/weekClose";
import { ensureWaterReminders } from "../services/reminders";
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
      setWeighOpen(needsWeighIn(data));

      const dates = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        return getLocalISODate(date);
      });
      const rows = await Promise.all(
        dates.map(async (date) => {
          const day = await getDoc(doc(db, "daily_tracking", trackingDocId(uid, date)));
          return { date, data: day.exists() ? (day.data() as DailyTracking) : null };
        }),
      );
      setHistory(rows);

      unsubscribe = onSnapshot(doc(db, "daily_tracking", trackingDocId(uid)), (day) => {
        setToday(day.exists() ? (day.data() as DailyTracking) : emptyDay());
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [navigation]);

  useEffect(() => {
    ensureWaterReminders().then(setReminders);
  }, []);

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

  async function toggleHabit(field: "workout_done") {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(
      doc(db, "daily_tracking", trackingDocId(uid)),
      { [field]: !today[field] },
      { merge: true },
    );
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
  const meals = scheduleFor(profile.nutritionistPlan, profile.nutritionistPlanSource);
  const mealsDone = today.meals_done ?? {};
  const eaten = meals.filter((meal) => mealsDone[meal.id]).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Reveal>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <BrandLockup size={26} />
        </View>
        <Text style={styles.greeting}>Olá, {profile.name || "Visitante"}</Text>

        {weekClose ? (
          <View style={styles.card}>
            <Text style={styles.section}>{weekClose.title}</Text>
            <Text style={styles.closeRange}>{weekClose.range}</Text>
            <Text style={styles.closeLine}>{weekClose.training}</Text>
            <Text style={styles.closeLine}>{weekClose.meals}</Text>
            <Text style={styles.closeLine}>{weekClose.water}</Text>
            <Text style={styles.closeLine}>{weekClose.weight}</Text>
            <Text style={styles.closeLine}>{weekClose.sleep}</Text>
            <Text style={styles.closeLoad}>{weekClose.load}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.section}>Semana</Text>
          {history.map((item) => {
            const day = item.date === getLocalISODate() ? today : item.data;
            const date = new Date(`${item.date}T12:00:00`);
            const marked = Object.keys(day?.meals_done ?? {}).length;
            const session = profile.trainingPlan ? sessionForDate(profile.trainingPlan, date) : null;
            const trained = session?.rest ? "descanso" : day?.workout_done ? "treinou" : "não treinou";
            const weight = safeCount(day?.weight);
            return (
              <View key={item.date} style={[styles.weekRow, item.date === getLocalISODate() && styles.weekToday]}>
                <View style={styles.weekHead}>
                  <Text style={styles.weekDay}>
                    {weekDays[date.getDay()]} {date.getDate()}
                  </Text>
                  <Text style={styles.weekWeight}>{weight > 0 ? `${String(weight).replace(".", ",")} kg` : ""}</Text>
                </View>
                <Text style={styles.weekDetail}>
                  Dieta {meals.length ? `${marked}/${meals.length}` : "—"} · {trained} · Água {liters(safeCount(day?.water_ml))} L
                </Text>
              </View>
            );
          })}
          <Text style={styles.waterHint}>Peso de hoje, em jejum se for o dia de atualizar.</Text>
          <View style={styles.waterAdd}>
            <TextInput
              style={styles.waterInput}
              placeholder="kg"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={newWeight}
              onChangeText={setNewWeight}
            />
            <SoftTouch style={styles.waterAddButton} onPress={handleWeighIn}>
              <Text style={styles.waterAddText}>Salvar peso</Text>
            </SoftTouch>
          </View>
        </View>

        <View style={styles.card}>
          <ProgressBar label="🔥 Calorias Totais" current={today.total_calories} target={targets.calories} suffix=" kcal" color={colors.calories} />
          <ProgressBar label="🥩 Proteína" current={today.total_protein} target={targets.protein} suffix="g" color={colors.primary} />
          <ProgressBar label="🍚 Carboidratos" current={today.total_carbs} target={targets.carb} suffix="g" color={colors.carbs} />
          <ProgressBar label="🥑 Gorduras" current={today.total_fats} target={targets.fat} suffix="g" color={colors.fat} />
        </View>

        <SoftTouch style={styles.card} onPress={() => navigation.navigate("Dieta")}>
          <Text style={styles.section}>Dieta de hoje</Text>
          {meals.length ? (
            <>
              <Text style={styles.dietCount}>
                {eaten} de {meals.length} refeições marcadas
              </Text>
              {meals.map((meal) => (
                <View key={meal.id} style={styles.dietRow}>
                  <Text style={styles.dietCheck}>{mealsDone[meal.id] ? "✓" : "○"}</Text>
                  <View style={styles.dietCopy}>
                    <Text style={styles.dietTitle}>{meal.title}</Text>
                    <Text style={styles.dietOption} numberOfLines={1}>
                      {optionLabel(meal, mealsDone[meal.id])}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.dietOption}>O plano ainda não virou refeições. Abre a aba Dieta e salva o cardápio.</Text>
          )}
        </SoftTouch>

        <View style={styles.card}>
          <Text style={styles.section}>Água</Text>
          <ProgressBar label="💧 Água" current={waterMl} target={waterGoal} suffix=" ml" color={colors.primary} />
          <Text style={styles.waterHint}>
            Meta {liters(waterGoal)} L, no mínimo 2 L. Marca mais ou menos o que tomou.
          </Text>
          <View style={styles.waterAmounts}>
            {waterAmounts.map((amount) => (
              <SoftTouch key={amount} style={styles.waterChip} onPress={() => addWater(amount)}>
                <Text style={styles.waterChipText}>{amount} ml</Text>
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
              <Text style={styles.waterAddText}>Adicionar</Text>
            </SoftTouch>
          </View>
          {(today.water_entries ?? []).length ? (
            <SoftTouch onPress={undoWater}>
              <Text style={styles.waterUndo}>Desfazer o último, {(today.water_entries ?? []).at(-1)} ml</Text>
            </SoftTouch>
          ) : null}
          <Text style={styles.waterHint}>
            {reminders === "on"
              ? "Avisos às 8, 10, 12, 14, 16, 18 e 20."
              : reminders === "denied"
                ? "Os avisos estão desligados nas permissões do celular. A água continua aqui para marcar."
                : reminders === "unavailable"
                  ? "Os avisos do dia entram quando o Shape estiver instalado. Enquanto isso, marca aqui quanto tomou."
                  : "Ligando os avisos do dia."}
          </Text>
        </View>

        <View style={styles.habits}>
          <SoftTouch
            style={[styles.habit, today.workout_done && styles.habitActive]}
            onPress={() => toggleHabit("workout_done")}
          >
            <Text style={styles.habitIcon}>🏋️</Text>
            <Text style={[styles.habitText, today.workout_done && styles.habitTextActive]}>Treinei</Text>
          </SoftTouch>
        </View>

        <SoftTouch style={styles.coachCard} onPress={() => navigation.navigate("Treino")}>
          <Text style={styles.coachKicker}>Treino de hoje</Text>
          <Text style={styles.coachTitle}>
            {profile.trainingPlan ? sessionForDate(profile.trainingPlan).title : "Definir prioridades"}
          </Text>
          <Text style={styles.coachBody}>
            {profile.trainingPlan
              ? sessionForDate(profile.trainingPlan).summary
              : "Escolhe até dois grupos e os dias da semana. A ficha é gerada a partir disso."}
          </Text>
        </SoftTouch>

        <SoftTouch style={styles.chatButton} onPress={() => navigation.navigate("Chat")}>
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
              <Text style={styles.chatButtonText}>Recalcular Dieta!</Text>
            </SoftTouch>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  brandRow: { marginBottom: 16 },
  greeting: { color: colors.text, fontSize: 28, fontWeight: "800", marginBottom: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { color: colors.text, fontWeight: "700", marginBottom: 12 },
  closeRange: { color: colors.textSecondary, marginTop: -6, marginBottom: 10 },
  closeLine: { color: colors.text, lineHeight: 20, marginBottom: 4 },
  closeLoad: { color: colors.primary, fontWeight: "700", lineHeight: 20, marginTop: 8 },
  dietCount: { color: colors.primary, fontWeight: "700", marginBottom: 10 },
  dietRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  dietCheck: { color: colors.primary, width: 16, fontWeight: "800" },
  dietCopy: { flex: 1 },
  dietTitle: { color: colors.text, fontWeight: "700" },
  dietOption: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  weekRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekToday: { backgroundColor: colors.wash, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 10 },
  weekHead: { flexDirection: "row", justifyContent: "space-between" },
  weekDay: { color: colors.text, fontWeight: "700" },
  weekWeight: { color: colors.primary, fontWeight: "700" },
  weekDetail: { color: colors.textSecondary, marginTop: 2, fontSize: 12 },
  waterHint: { color: colors.textSecondary, lineHeight: 18, marginBottom: 10 },
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
  habits: { flexDirection: "row", gap: 10, marginBottom: 16 },
  habit: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  habitActive: { borderColor: colors.primary, backgroundColor: colors.wash },
  habitIcon: { fontSize: 22 },
  habitText: { color: colors.textSecondary, marginTop: 6, fontWeight: "600" },
  habitTextActive: { color: colors.primary },
  chatButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  chatButtonText: { color: colors.background, fontWeight: "800" },
  coachCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachKicker: { color: colors.primary, fontWeight: "700", marginBottom: 4 },
  coachTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  coachBody: { color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
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
