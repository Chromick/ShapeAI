import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckPop, Reveal, SoftTouch, easeLayout } from "../components/motion";
import { Edge } from "../components/Edge";
import { BRUNO_DIET_SOURCE, BRUNO_NUTRITIONIST_PLAN, isBrunoAccount } from "../data/brunoDiet";
import { optionLabel, scheduleFor } from "../data/dietSchedule";
import { FoodAnswer, foodById, mealReminderSlots, shoppingList, slotNow, slotsForCount, suggestFood, suggestedSchedule } from "../data/suggestedDiet";
import { consumePantry, coverageLine, pantrySpend, prepLine } from "../data/pantry";
import { macrosFromMeals } from "../data/mealMacros";
import { analyzeDietFile } from "../services/aiService";
import { auth, db } from "../services/firebaseConfig";
import { DailyTracking, GroceryItem, UserProfile, Vitamin, emptyDay, trackingDocId } from "../services/nutrition";
import { syncMealReminders } from "../services/reminders";
import { colors } from "../theme/colors";

const MAX_FILE_BYTES = 3 * 1024 * 1024;

export function DietScreen() {
  const [plan, setPlan] = useState("");
  const [vitamins, setVitamins] = useState<Vitamin[]>([]);
  const [taken, setTaken] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [saved, setSaved] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [reading, setReading] = useState(false);
  const [planSource, setPlanSource] = useState<string | undefined>();
  const [mealsDone, setMealsDone] = useState<Record<string, string>>({});
  const [openMeal, setOpenMeal] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const [mealsPerDay, setMealsPerDay] = useState<number | undefined>();
  const [foodAnswers, setFoodAnswers] = useState<Record<string, FoodAnswer>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [today, setToday] = useState<DailyTracking>(emptyDay());
  const [pantry, setPantry] = useState<GroceryItem[]>([]);
  const [shoppingHelp, setShoppingHelp] = useState(true);
  const [shopBudget, setShopBudget] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubUser = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as UserProfile;
      const currentPlan = data.nutritionistPlan ?? "";
      setPlan(currentPlan);
      setPlanSource(data.nutritionistPlanSource);
      setAnalysis(data.nutritionistAnalysis ?? "");
      setVitamins(data.vitamins ?? []);
      setMealsPerDay(data.mealsPerDay || undefined);
      setFoodAnswers(data.foodAnswers ?? {});
      setPantry(data.pantry ?? []);
      setShoppingHelp(data.shoppingHelp !== false);
      setShopBudget(data.shopBudget != null ? String(data.shopBudget) : "");
      const email = auth.currentUser?.email;
      if (!currentPlan.trim() && !data.nutritionistPlanSource && isBrunoAccount(email, data.name)) {
        setPlan(BRUNO_NUTRITIONIST_PLAN);
        setDoc(
          doc(db, "users", uid),
          { nutritionistPlan: BRUNO_NUTRITIONIST_PLAN, nutritionistPlanSource: BRUNO_DIET_SOURCE },
          { merge: true },
        ).catch((error) => console.error(error));
      }
    });
    const unsubDay = onSnapshot(doc(db, "daily_tracking", trackingDocId(uid)), (snapshot) => {
      const data = snapshot.exists() ? (snapshot.data() as DailyTracking) : emptyDay();
      setToday(data);
      setTaken(data.vitamins_taken ?? []);
      setMealsDone(data.meals_done ?? {});
    });
    return () => {
      unsubUser();
      unsubDay();
    };
  }, []);

  useEffect(() => {
    const board = scheduleFor(plan, planSource);
    void syncMealReminders(mealReminderSlots(board, mealsPerDay), mealsDone);
  }, [plan, planSource, mealsPerDay, mealsDone]);

  async function savePlan() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(doc(db, "users", uid), { nutritionistPlan: plan.trim() }, { merge: true });
    setSaved(true);
  }

  async function sendDietFile() {
    const uid = auth.currentUser?.uid;
    if (!uid || reading) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if (asset.size && asset.size > MAX_FILE_BYTES) {
      Alert.alert("Arquivo grande", "Manda um PDF ou uma imagem de até 3 MB.");
      return;
    }
    const mime = asset.mimeType || (asset.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    setReading(true);
    try {
      const base64 = await new File(asset.uri).base64();
      const result = await analyzeDietFile({ name: asset.name, mime, base64 });
      if ("error" in result) {
        Alert.alert("Dieta", result.error);
        return;
      }
      setPlan(result.plan);
      setAnalysis(result.analysis);
      await setDoc(
        doc(db, "users", uid),
        {
          nutritionistPlan: result.plan,
          nutritionistAnalysis: result.analysis,
          nutritionistPlanSource: "arquivo",
        },
        { merge: true },
      );
      setSaved(true);
    } catch (error) {
      Alert.alert("Dieta", `Não consegui ler esse arquivo. ${String(error)}`);
    } finally {
      setReading(false);
    }
  }

  async function saveMealCount(count: number) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setMealsPerDay(count);
    await setDoc(doc(db, "users", uid), { mealsPerDay: count }, { merge: true });
  }

  async function persistMealMacros(
    uid: string,
    nextDone: Record<string, string>,
    meals: { id: string; options: { id: string; label: string }[] }[],
  ) {
    const previous = macrosFromMeals(meals, mealsDone);
    const next = macrosFromMeals(meals, nextDone);
    await setDoc(
      doc(db, "daily_tracking", trackingDocId(uid)),
      {
        meals_done: nextDone,
        total_calories: Math.max(0, (today.total_calories || 0) - previous.calories + next.calories),
        total_protein: Math.max(0, (today.total_protein || 0) - previous.protein + next.protein),
        total_carbs: Math.max(0, (today.total_carbs || 0) - previous.carbs + next.carbs),
        total_fats: Math.max(0, (today.total_fats || 0) - previous.fats + next.fats),
      },
      { merge: true },
    );
    void syncMealReminders(mealReminderSlots(meals, mealsPerDay), nextDone);
  }

  async function savePantry(next: GroceryItem[]) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setPantry(next);
    await setDoc(doc(db, "users", uid), { pantry: next }, { merge: true });
  }

  async function answerFood(foodId: string, slotId: string, answer: FoodAnswer | "later") {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (answer === "later") {
      setSkipped((current) => [...current, foodId]);
      return;
    }
    const nextAnswers = { ...foodAnswers, [foodId]: answer };
    setFoodAnswers(nextAnswers);
    setSkipped((current) => current.filter((id) => id !== foodId));
    if (answer === "eats") {
      const nextMeals = { ...mealsDone, [slotId]: foodId };
      setMealsDone(nextMeals);
      const slots = suggestedSchedule(mealsPerDay || 4, nextAnswers);
      await persistMealMacros(uid, nextMeals, slots);
      const food = foodById(foodId);
      if (food) await savePantry(consumePantry(pantry, food.id, food.label));
    }
    await setDoc(doc(db, "users", uid), { foodAnswers: nextAnswers }, { merge: true });
  }

  async function clearMealCount() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setMealsPerDay(undefined);
    setSkipped([]);
    await setDoc(doc(db, "users", uid), { mealsPerDay: null }, { merge: true });
  }

  async function chooseMeal(mealId: string, optionId: string) {
    easeLayout();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const next = { ...mealsDone };
    if (next[mealId] === optionId) delete next[mealId];
    else {
      next[mealId] = optionId;
      const board = scheduleFor(plan, planSource);
      const option = board.find((meal) => meal.id === mealId)?.options.find((item) => item.id === optionId);
      if (option) await savePantry(consumePantry(pantry, option.id, option.label));
    }
    setMealsDone(next);
    const board = scheduleFor(plan, planSource);
    await persistMealMacros(
      uid,
      next,
      board.length ? board : suggestedSchedule(mealsPerDay || 4, foodAnswers),
    );
  }

  async function addVitamin() {
    const uid = auth.currentUser?.uid;
    const cleanName = name.trim();
    if (!uid || !cleanName) return;
    const next = [...vitamins, { id: Date.now().toString(), name: cleanName, dose: dose.trim() }];
    setVitamins(next);
    setName("");
    setDose("");
    await setDoc(doc(db, "users", uid), { vitamins: next }, { merge: true });
  }

  async function removeVitamin(id: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const next = vitamins.filter((vitamin) => vitamin.id !== id);
    setVitamins(next);
    await setDoc(doc(db, "users", uid), { vitamins: next }, { merge: true });
  }

  async function toggleVitamin(id: string) {
    easeLayout();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const next = taken.includes(id) ? taken.filter((item) => item !== id) : [...taken, id];
    setTaken(next);
    await setDoc(doc(db, "daily_tracking", trackingDocId(uid)), { vitamins_taken: next }, { merge: true });
  }

  const pending = vitamins.filter((vitamin) => !taken.includes(vitamin.id)).length;
  const meals = scheduleFor(plan, planSource);
  const eaten = meals.filter((meal) => mealsDone[meal.id]).length;
  const bag = shoppingList(foodAnswers);
  const cover = coverageLine(meals, mealsDone, pantry);
  const leftoverPrep = prepLine(pantry);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Reveal>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Dieta</Text>
        <Text style={styles.lead}>
          {plan.trim()
            ? "O tutor segue o plano da sua nutricionista. Ele não inventa outro cardápio nem dose de vitamina."
            : "Sem plano de nutricionista, o app sugere pelo horário. Você diz se come e se tem o alimento."}
        </Text>

        {!plan.trim() ? (
          mealsPerDay ? (
            <Suggestion
              count={mealsPerDay}
              answers={foodAnswers}
              skipped={skipped}
              pantry={pantry}
              chosenId={mealsDone[slotNow(slotsForCount(mealsPerDay)).id]}
              onAnswer={answerFood}
              onResetCount={clearMealCount}
            />
          ) : (
            <View style={styles.meal}>
              <Edge />
              <Text style={styles.vitaminName}>Quantas refeições você faz no dia?</Text>
              <View style={styles.countRow}>
                {[3, 4, 5, 6].map((count) => (
                  <SoftTouch key={count} style={styles.countChip} onPress={() => saveMealCount(count)}>
                    <Text style={styles.countText}>{count}</Text>
                  </SoftTouch>
                ))}
              </View>
            </View>
          )
        ) : null}

        {meals.length ? (
          <>
            <Text style={styles.section}>Hoje</Text>
            <Text style={styles.lead}>
              {eaten} de {meals.length} refeições. A barra de kcal no Início soma as porções escritas no plano, sem inventar refeição.
            </Text>
            {cover ? <Text style={styles.dose}>{cover}</Text> : null}
            {meals.map((meal) => {
              const chosen = mealsDone[meal.id];
              const open = openMeal === meal.id;
              return (
                <View key={meal.id} style={styles.meal}>
                  <Edge />
                  <SoftTouch
                    onPress={() => {
                      easeLayout();
                      setOpenMeal(open ? null : meal.id);
                    }}
                  >
                    <View style={styles.mealHead}>
                      <CheckPop on={Boolean(chosen)}>
                        <View style={[styles.check, chosen && styles.checkOn]}>
                          <Text style={styles.checkMark}>{chosen ? "✓" : ""}</Text>
                        </View>
                      </CheckPop>
                      <View style={styles.mealText}>
                        <Text style={styles.vitaminName}>{meal.title}</Text>
                        <Text style={styles.dose} numberOfLines={open ? 6 : 2}>
                          {optionLabel(meal, chosen)}
                        </Text>
                      </View>
                    </View>
                    {meal.note ? <Text style={styles.note}>{meal.note}</Text> : null}
                  </SoftTouch>
                  {open
                    ? meal.options.map((option) => {
                        const on = chosen === option.id;
                        return (
                          <SoftTouch
                            key={option.id}
                            style={[styles.option, on && styles.optionOn]}
                            onPress={() => chooseMeal(meal.id, option.id)}
                          >
                            <Text style={[styles.optionText, on && styles.optionTextOn]}>{option.label}</Text>
                          </SoftTouch>
                        );
                      })
                    : null}
                </View>
              );
            })}
          </>
        ) : null}

        {bag.length && !plan.trim() ? (
          <View style={styles.meal}>
            <Edge />
            <Text style={styles.vitaminName}>Lista de compra</Text>
            <Text style={styles.dose}>Do que você marcou que come.</Text>
            {bag.map((item) => (
              <Text key={item} style={styles.note}>
                {item}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.meal}>
          <Edge />
          <Text style={styles.vitaminName}>Despensa</Text>
          <Text style={styles.dose}>
            Fala no tutor o que comprou, a quantidade e o preço. Ele sugere prato com isso. Dica de mercado dá para ligar ou desligar.
          </Text>
          <SoftTouch
            style={[styles.option, shoppingHelp && styles.optionOn]}
            onPress={async () => {
              const uid = auth.currentUser?.uid;
              if (!uid) return;
              const next = !shoppingHelp;
              setShoppingHelp(next);
              await setDoc(doc(db, "users", uid), { shoppingHelp: next }, { merge: true });
            }}
          >
            <Text style={[styles.optionText, shoppingHelp && styles.optionTextOn]}>
              {shoppingHelp ? "Dicas do que comprar: ligadas" : "Dicas do que comprar: desligadas"}
            </Text>
          </SoftTouch>
          <TextInput
            style={styles.input}
            placeholder="Teto de gasto, ex: 150"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={shopBudget}
            onChangeText={setShopBudget}
            onEndEditing={async () => {
              const uid = auth.currentUser?.uid;
              if (!uid) return;
              const amount = parseFloat(shopBudget.replace(",", "."));
              const value = Number.isFinite(amount) && amount > 0 ? amount : null;
              await setDoc(doc(db, "users", uid), { shopBudget: value }, { merge: true });
            }}
          />
          {shopBudget && pantrySpend(pantry) > parseFloat(shopBudget.replace(",", ".") || "0") ? (
            <Text style={styles.note}>
              Soma na despensa R$ {pantrySpend(pantry).toFixed(2).replace(".", ",")} passou do teto.
            </Text>
          ) : null}
          {leftoverPrep ? <Text style={styles.note}>{leftoverPrep}</Text> : null}
          {pantry.length ? (
            pantry.map((item) => (
              <View key={item.id} style={styles.vitamin}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vitaminName}>{item.name}</Text>
                  <Text style={styles.dose}>
                    {item.quantity}
                    {item.price != null ? ` · R$ ${item.price.toFixed(2).replace(".", ",")}` : ""}
                  </Text>
                </View>
                <SoftTouch
                  onPress={async () => {
                    const uid = auth.currentUser?.uid;
                    if (!uid) return;
                    const next = pantry.filter((row) => row.id !== item.id);
                    setPantry(next);
                    await setDoc(doc(db, "users", uid), { pantry: next }, { merge: true });
                  }}
                >
                  <Text style={styles.remove}>Tirar</Text>
                </SoftTouch>
              </View>
            ))
          ) : (
            <Text style={styles.dose}>Ainda vazia. No tutor: “comprei 1 kg de frango, R$ 22”.</Text>
          )}
        </View>

        <SoftTouch
          onPress={() => {
            easeLayout();
            setShowText((open) => !open);
          }}
        >
          <Text style={styles.section}>{showText || !meals.length ? "Texto do plano" : "Ver texto do plano"}</Text>
        </SoftTouch>
        {showText || !meals.length ? (
        <>
        <TextInput
          style={styles.plan}
          multiline
          placeholder="Cole aqui as refeições, horários e observações que ela passou."
          placeholderTextColor={colors.textSecondary}
          value={plan}
          onChangeText={(value) => {
            setPlan(value);
            setSaved(false);
          }}
        />
        <SoftTouch style={styles.button} onPress={savePlan}>
          <Edge />
          <Text style={styles.buttonText}>{saved ? "Plano salvo" : "Salvar plano"}</Text>
        </SoftTouch>
        <SoftTouch style={styles.secondary} onPress={sendDietFile} disabled={reading}>
          <Text style={styles.secondaryText}>{reading ? "Lendo o arquivo..." : "Enviar arquivo da dieta"}</Text>
        </SoftTouch>
        <Text style={styles.lead}>PDF ou foto do plano. O tutor transcreve o cardápio e deixa uma leitura curta, sem inventar outro.</Text>
        {analysis ? <Text style={styles.analysis}>{analysis}</Text> : null}
        </>
        ) : null}

        <Text style={styles.section}>Vitaminas de hoje</Text>
        <Text style={styles.lead}>
          {vitamins.length === 0
            ? "Cadastre só o que ela sugeriu. O app marca o que você tomou e cobra o que ficou de fora."
            : pending === 0
              ? "Tudo do dia marcado."
              : `${pending} ainda sem marcar hoje.`}
        </Text>
        {vitamins.map((vitamin) => {
          const checked = taken.includes(vitamin.id);
          return (
            <View key={vitamin.id} style={styles.vitamin}>
              <SoftTouch style={styles.vitaminMain} onPress={() => toggleVitamin(vitamin.id)}>
                <CheckPop on={checked}>
                  <View style={[styles.check, checked && styles.checkOn]}>
                    <Text style={styles.checkMark}>{checked ? "✓" : ""}</Text>
                  </View>
                </CheckPop>
                <View>
                  <Text style={styles.vitaminName}>{vitamin.name}</Text>
                  <Text style={styles.dose}>{vitamin.dose || "Dose não informada"}</Text>
                </View>
              </SoftTouch>
              <SoftTouch onPress={() => removeVitamin(vitamin.id)}>
                <Text style={styles.remove}>Tirar</Text>
              </SoftTouch>
            </View>
          );
        })}

        <TextInput
          style={styles.input}
          placeholder="Nome da vitamina"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Dose que ela passou, se tiver"
          placeholderTextColor={colors.textSecondary}
          value={dose}
          onChangeText={setDose}
        />
        <SoftTouch style={styles.secondary} onPress={addVitamin}>
          <Text style={styles.secondaryText}>Adicionar vitamina</Text>
        </SoftTouch>
      </ScrollView>
      </Reveal>
    </SafeAreaView>
  );
}

function Suggestion({
  count,
  answers,
  skipped,
  pantry,
  chosenId,
  onAnswer,
  onResetCount,
}: {
  count: number;
  answers: Record<string, FoodAnswer>;
  skipped: string[];
  pantry?: GroceryItem[];
  chosenId?: string;
  onAnswer: (foodId: string, slotId: string, answer: FoodAnswer | "later") => void;
  onResetCount: () => void;
}) {
  const slots = slotsForCount(count);
  const slot = slotNow(slots);
  const food = suggestFood(slot.id, answers, skipped, pantry);
  const chosen = chosenId ? foodById(chosenId) : undefined;
  return (
    <View style={styles.meal}>
      <Edge />
      <Text style={styles.vitaminName}>Agora · {slot.title}</Text>
      <Text style={styles.dose}>{count} refeições no dia. A sugestão muda com o horário.</Text>
      {chosen ? <Text style={styles.note}>Marcado: {chosen.label}</Text> : null}
      {food ? (
        <>
          <Text style={styles.suggestion}>{food.label}</Text>
          <SoftTouch style={styles.option} onPress={() => onAnswer(food.id, slot.id, "eats")}>
            <Text style={styles.optionText}>Tenho e como</Text>
          </SoftTouch>
          <SoftTouch style={styles.option} onPress={() => onAnswer(food.id, slot.id, "later")}>
            <Text style={styles.optionText}>Agora não tenho</Text>
          </SoftTouch>
          <SoftTouch style={styles.option} onPress={() => onAnswer(food.id, slot.id, "avoids")}>
            <Text style={styles.optionText}>Não como isso</Text>
          </SoftTouch>
        </>
      ) : (
        <Text style={styles.dose}>Nesta hora não sobrou alimento que você come.</Text>
      )}
      <SoftTouch onPress={onResetCount}>
        <Text style={styles.note}>Mudar quantas refeições</Text>
      </SoftTouch>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  lead: { color: colors.textSecondary, marginTop: 8, marginBottom: 8, lineHeight: 20 },
  section: { color: colors.text, fontWeight: "800", marginTop: 18, marginBottom: 8 },
  plan: {
    minHeight: 140,
    textAlignVertical: "top",
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    overflow: "hidden",
  },
  buttonText: { color: colors.background, fontWeight: "800" },
  analysis: {
    color: colors.text,
    marginTop: 12,
    lineHeight: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vitamin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vitaminMain: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.primary },
  checkMark: { color: colors.background, fontWeight: "800" },
  vitaminName: { color: colors.text, fontWeight: "700" },
  dose: { color: colors.textSecondary, fontSize: 12 },
  meal: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  mealHead: { flexDirection: "row", gap: 10 },
  mealText: { flex: 1 },
  note: { color: colors.primary, marginTop: 8, fontSize: 12 },
  countRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  countChip: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  countText: { color: colors.text, fontWeight: "800", fontSize: 18 },
  suggestion: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 10, lineHeight: 24 },
  option: {
    marginTop: 8,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.text, lineHeight: 18 },
  optionTextOn: { color: colors.background, fontWeight: "700" },
  remove: { color: colors.error, fontSize: 12 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondary: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryText: { color: colors.primary, fontWeight: "800" },
});
