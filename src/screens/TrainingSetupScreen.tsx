import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { Reveal, SoftTouch } from "../components/motion";
import { Edge } from "../components/Edge";
import { DaysPerWeek, MUSCLES, MuscleId, buildPlan, progressionFor } from "../data/trainingPlan";
import { RootStackParamList } from "../navigation/types";
import { auth, db } from "../services/firebaseConfig";
import { Metrics, UserProfile, calculateTargets, safeCount, trackingDocId } from "../services/nutrition";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "TrainingSetup">;

const dayOptions: { value: DaysPerWeek; label: string; detail: string }[] = [
  { value: 3, label: "3 dias", detail: "Segunda, quarta e sexta. Corpo inteiro." },
  { value: 4, label: "4 dias", detail: "Segunda e quinta superior. Terça e sexta inferior." },
  { value: 5, label: "5 dias", detail: "Superior, inferior, superior, inferior e um fechamento na sexta." },
];

export function TrainingSetupScreen({ navigation }: Props) {
  const [priorities, setPriorities] = useState<MuscleId[]>([]);
  const [days, setDays] = useState<DaysPerWeek | null>(null);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sleep, setSleep] = useState<"good" | "poor" | null>(null);
  const [ageDraft, setAgeDraft] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snapshot) => {
      if (snapshot.exists()) setProfile(snapshot.data() as UserProfile);
    });
    getDoc(doc(db, "daily_tracking", trackingDocId(uid))).then((snapshot) => {
      const value = snapshot.data()?.sleep;
      setSleep(value === "good" || value === "poor" ? value : null);
    });
  }, []);

  function toggle(id: MuscleId) {
    setPriorities((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  }

  async function generate() {
    if (!days || priorities.length < 1) {
      Alert.alert("Falta escolher", "Marque 1 ou 2 prioridades e quantos dias você treina.");
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid || !profile) return;
    const typedAge = parseInt(ageDraft, 10);
    const years = safeCount(profile.metrics?.age) || typedAge;
    if (!years) {
      Alert.alert("Idade", "Coloca a idade. O tipo de série sai dela.");
      return;
    }
    setSaving(true);
    try {
      let metrics: Metrics = profile.metrics;
      if (!safeCount(profile.metrics?.age)) {
        metrics = { ...profile.metrics, age: years };
        await setDoc(doc(db, "users", uid), { metrics, targets: calculateTargets(metrics) }, { merge: true });
      }
      const decided = progressionFor(metrics, sleep);
      const trainingPlan = {
        ...buildPlan(days, priorities, decided.progression),
        progressionReason: decided.reason,
      };
      await setDoc(doc(db, "users", uid), { trainingPlan }, { merge: true });
      navigation.replace("Main");
    } catch (error) {
      Alert.alert("Erro", "Não consegui salvar o treino.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  const upper = MUSCLES.filter((muscle) => muscle.region === "upper");
  const lower = MUSCLES.filter((muscle) => muscle.region === "lower");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Reveal>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Prioridades</Text>
        <Text style={styles.lead}>
          Escolha até dois grupos. Eles entram no começo do treino e ficam com 9 séries na semana. O resto fica com 6.
        </Text>
        <Text style={styles.section}>Superiores</Text>
        <View style={styles.row}>
          {upper.map((muscle) => (
            <Chip
              key={muscle.id}
              label={muscle.label}
              active={priorities.includes(muscle.id)}
              disabled={!priorities.includes(muscle.id) && priorities.length >= 2}
              onPress={() => toggle(muscle.id)}
            />
          ))}
        </View>
        <Text style={styles.section}>Inferiores</Text>
        <View style={styles.row}>
          {lower.map((muscle) => (
            <Chip
              key={muscle.id}
              label={muscle.label}
              active={priorities.includes(muscle.id)}
              disabled={!priorities.includes(muscle.id) && priorities.length >= 2}
              onPress={() => toggle(muscle.id)}
            />
          ))}
        </View>
        <Text style={styles.count}>{priorities.length} de 2</Text>

        <Text style={styles.section}>Tipo de série</Text>
        <View style={styles.day}>
          <Text style={styles.dayLabel}>O tutor escolhe</Text>
          <Text style={styles.dayDetail}>
            {profile ? progressionFor(profile.metrics, sleep).reason : "Lendo idade, treino e sono."}
          </Text>
        </View>
        {profile && !safeCount(profile.metrics?.age) ? (
          <>
            <Text style={styles.section}>Idade</Text>
            <TextInput
              style={styles.age}
              placeholder="Anos"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={ageDraft}
              onChangeText={setAgeDraft}
            />
          </>
        ) : null}

        <Text style={styles.section}>Dias disponíveis</Text>
        {dayOptions.map((option) => (
          <SoftTouch
            key={option.value}
            style={[styles.day, days === option.value && styles.dayOn]}
            onPress={() => setDays(option.value)}
          >
            <Text style={[styles.dayLabel, days === option.value && styles.dayLabelOn]}>{option.label}</Text>
            <Text style={styles.dayDetail}>{option.detail}</Text>
          </SoftTouch>
        ))}

        <SoftTouch style={styles.button} onPress={generate} disabled={saving}>
          <Edge />
          <Text style={styles.buttonText}>{saving ? "Gerando..." : "Gerar treino"}</Text>
        </SoftTouch>
      </ScrollView>
      </Reveal>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <SoftTouch
      style={[styles.chip, active && styles.chipOn, disabled && styles.chipOff]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </SoftTouch>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  lead: { color: colors.textSecondary, marginTop: 8, lineHeight: 20 },
  section: { color: colors.text, fontWeight: "800", marginTop: 22, marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipOff: { opacity: 0.4 },
  chipText: { color: colors.text },
  chipTextOn: { color: colors.background, fontWeight: "800" },
  count: { color: colors.primary, marginTop: 10, fontWeight: "700" },
  day: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayOn: { borderColor: colors.primary },
  dayLabel: { color: colors.text, fontWeight: "800" },
  dayLabelOn: { color: colors.primary },
  dayDetail: { color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  age: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
    overflow: "hidden",
  },
  buttonText: { color: colors.background, fontWeight: "800" },
});
