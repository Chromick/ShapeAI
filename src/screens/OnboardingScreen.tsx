import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { RootStackParamList } from "../navigation/types";
import { auth, db } from "../services/firebaseConfig";
import { Gender, Goal, calculateTargets } from "../services/nutrition";
import { BrandLockup } from "../components/Mark";
import { Reveal, SoftTouch } from "../components/motion";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

const activities = [
  { value: "1.2", label: "Sedentário" },
  { value: "1.375", label: "Leve (1-3x sem)" },
  { value: "1.55", label: "Moderado (3-5x sem)" },
  { value: "1.725", label: "Intenso" },
];

const goals: { value: Goal; label: string }[] = [
  { value: "secar", label: "Perder Gordura" },
  { value: "recompost", label: "Recomposição" },
  { value: "ganhar", label: "Ganhar Massa" },
];

export function OnboardingScreen({ navigation }: Props) {
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activity, setActivity] = useState("1.55");
  const [goal, setGoal] = useState<Goal>("recompost");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setChecking(false);
      return;
    }
    getDoc(doc(db, "users", uid))
      .then((snapshot) => {
        if (snapshot.exists()) {
          const plan = snapshot.data().trainingPlan;
          navigation.replace(plan ? "Main" : "TrainingSetup");
        } else setChecking(false);
      })
      .catch((error) => {
        setChecking(false);
        Alert.alert(
          "Erro no Banco de Dados",
          "Verifique se você criou o banco Firestore e liberou os Security Rules (ex: allow read, write: if request.auth != null)",
        );
        console.error("Erro Firestore:", error);
      });
  }, [navigation]);

  async function handleSubmit() {
    if (!name.trim() || !age || !weight || !height) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSaving(true);
    try {
      const metrics = {
        gender,
        age: parseInt(age, 10),
        weight: parseFloat(weight),
        height: parseFloat(height),
        activity: parseFloat(activity),
        goal,
      };
      await setDoc(doc(db, "users", uid), {
        name: name.trim(),
        metrics,
        targets: calculateTargets(metrics),
        createdAt: new Date().toISOString(),
        frequentFoods: [],
      });
      navigation.replace("TrainingSetup");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar os dados.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Verificando perfil...</Text>
      </View>
    );
  }

  return (
    <Reveal>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.brand}>
        <BrandLockup size={32} />
      </View>
      <Text style={styles.title}>Seu ponto de partida</Text>
      <Text style={styles.subtitle}>
        Nome, peso e objetivo. A partir daqui o tutor acompanha treino, dieta e o dia.
      </Text>

      <Text style={styles.label}>Como quer ser chamado?</Text>
      <TextInput style={styles.input} placeholder="Seu nome" placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} />

      <Text style={styles.label}>Sexo Fisiológico</Text>
      <View style={styles.row}>
        <Choice label="Masculino" active={gender === "M"} onPress={() => setGender("M")} />
        <Choice label="Feminino" active={gender === "F"} onPress={() => setGender("F")} />
      </View>

      <Text style={styles.label}>Idade (anos)</Text>
      <TextInput style={styles.input} placeholder="Ex: 30" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={age} onChangeText={setAge} />
      <Text style={styles.label}>Peso (kg)</Text>
      <TextInput style={styles.input} placeholder="Ex: 80" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={weight} onChangeText={setWeight} />
      <Text style={styles.label}>Altura (cm)</Text>
      <TextInput style={styles.input} placeholder="Ex: 180" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={height} onChangeText={setHeight} />

      <Text style={styles.label}>Nível de Atividade</Text>
      <View style={styles.rowWrap}>
        {activities.map((item) => (
          <Choice key={item.value} label={item.label} active={activity === item.value} onPress={() => setActivity(item.value)} />
        ))}
      </View>

      <Text style={styles.label}>Qual seu Objetivo?</Text>
      <View style={styles.rowWrap}>
        {goals.map((item) => (
          <Choice key={item.value} label={item.label} active={goal === item.value} onPress={() => setGoal(item.value)} />
        ))}
      </View>

      <SoftTouch style={styles.button} onPress={handleSubmit} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>Gerar Planejamento</Text>}
      </SoftTouch>
    </ScrollView>
    </Reveal>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <SoftTouch style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </SoftTouch>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  loadingText: { color: colors.textSecondary, marginTop: 12 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 30, paddingBottom: 60 },
  brand: { marginBottom: 22 },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, marginTop: 8, marginBottom: 24, lineHeight: 20 },
  label: { color: colors.text, marginBottom: 8, marginTop: 12, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", gap: 8 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.text },
  choiceTextActive: { color: colors.background, fontWeight: "700" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: { color: colors.background, fontWeight: "800", fontSize: 16 },
});
