import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { doc, getDoc } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ChatAttachment, ChatMessage, sendMessageToAI, transcribeAudio } from "../services/aiService";
import { MainTabParamList } from "../navigation/types";
import { auth, db } from "../services/firebaseConfig";
import { DailyTracking, FrequentFood, UserProfile, emptyDay } from "../services/nutrition";
import { trackingDocId } from "../services/nutrition";
import { Mark } from "../components/Mark";
import { Reveal, SoftTouch, easeLayout } from "../components/motion";
import { colors } from "../theme/colors";

const welcome: ChatMessage = {
  id: "1",
  role: "assistant",
  text: "Pode falar o que comeu, o treino, as vitaminas. No mercado, dita o que comprou, a quantidade e o preço — eu gravo e monto prato ou lanche com isso. Se quiser, também digo o que ainda falta comprar.",
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

type PendingFile = ChatAttachment & { base64: string };
type PortionLine = { id: string; food: string; amount: string };
type PhotoKind = "food" | "gear" | "receipt";

function blankPortion(): PortionLine {
  return { id: `${Date.now()}-${Math.random()}`, food: "", amount: "" };
}

type Props = BottomTabScreenProps<MainTabParamList, "Chat">;

export function ChatScreen({ route }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [photoKind, setPhotoKind] = useState<PhotoKind | null>(null);
  const [portions, setPortions] = useState<PortionLine[]>([blankPortion()]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [market, setMarket] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [today, setToday] = useState<DailyTracking>(emptyDay());
  const [foods, setFoods] = useState<FrequentFood[]>([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    Promise.all([
      getDoc(doc(db, "users", uid)),
      getDoc(doc(db, "daily_tracking", trackingDocId(uid))),
    ]).then(([userDoc, dayDoc]) => {
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        setProfile(data);
        setFoods(data.frequentFoods ?? []);
      }
      setToday(dayDoc.exists() ? (dayDoc.data() as DailyTracking) : emptyDay());
    });
  }, [messages]);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  function clearAttachment() {
    setPending(null);
    setPhotoKind(null);
    setPortions([blankPortion()]);
  }

  async function send(text: string, file: PendingFile | null = pending) {
    let trimmed = text.trim();
    const image = Boolean(file?.mime.startsWith("image/"));
    if (image && file && !photoKind) {
      Alert.alert("Foto", "Diz se é comida, aparelho ou cupom.");
      return;
    }
    if (image && photoKind === "food") {
      const filled = portions.filter((line) => line.food.trim() && line.amount.trim());
      if (!filled.length) {
        Alert.alert("Porções", "Coloca o alimento e a quantidade. Exemplo: arroz, 150 g.");
        return;
      }
      const lines = filled.map((line) => `- ${line.food.trim()}: ${line.amount.trim()}`).join("\n");
      trimmed = `${trimmed ? `${trimmed}\n` : ""}Foto da refeição. Porções:\n${lines}\nRegistra essa refeição com essas quantidades.`;
    }
    if (image && photoKind === "gear") {
      trimmed = `${trimmed ? `${trimmed}\n` : ""}Foto de um aparelho. Diz qual equipamento é e para qual exercício da ficha ele serve.`;
    }
    if (image && photoKind === "receipt") {
      trimmed = `${trimmed ? `${trimmed}\n` : ""}Foto de cupom fiscal. Extraia nome, quantidade e preço de cada item e chame save_groceries. Não registre refeição.`;
    }
    if (market && photoKind !== "food") {
      trimmed = `[MODO MERCADO] ${trimmed || "Estou no mercado."}`;
    }
    if ((!trimmed && !file) || busy) return;
    const attachment = file
      ? { name: file.name, mime: file.mime, uri: file.uri }
      : undefined;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: trimmed,
      attachment,
    };
    easeLayout();
    setMessages((current) => [...current, userMessage]);
    setInput("");
    clearAttachment();
    setBusy(true);
    const reply = await sendMessageToAI(
      trimmed,
      messages,
      profile,
      today,
      foods,
      file ? { name: file.name, mime: file.mime, base64: file.base64 } : undefined,
    );
    easeLayout();
    setMessages((current) => [...current, { ...reply, id: Date.now().toString() }]);
    setBusy(false);
  }

  const seeded = useRef(false);
  useEffect(() => {
    const seed = route.params?.seed?.trim();
    if (!seed || seeded.current || busy || !profile) return;
    seeded.current = true;
    void send(seed, null);
  }, [route.params?.seed, busy, profile]);

  async function takePhoto() {
    if (busy) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Câmera", "Você precisa permitir a câmera para fotografar o aparelho ou a refeição.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setPhotoKind(null);
    setPortions([blankPortion()]);
    setPending({
      name: "foto.jpg",
      mime: "image/jpeg",
      uri: asset.uri,
      base64: asset.base64!,
    });
  }

  async function pickFile() {
    if (busy) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_FILE_BYTES) {
      Alert.alert("Arquivo grande", "Manda um PDF ou uma imagem de até 8 MB.");
      return;
    }
    const mime = asset.mimeType || (asset.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    try {
      const base64 = await new File(asset.uri).base64();
      setPhotoKind(null);
      setPortions([blankPortion()]);
      setPending({ name: asset.name, mime, uri: asset.uri, base64 });
    } catch (error) {
      Alert.alert("Arquivo", `Não consegui ler esse arquivo. ${String(error)}`);
    }
  }

  async function startRecording() {
    if (recording || busy) return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microfone", "Você precisa permitir o uso do microfone no seu celular.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (error) {
      Alert.alert("Microfone", `Falha ao iniciar gravação: ${String(error)}`);
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) return;
      setBusy(true);
      const text = await transcribeAudio(uri);
      setBusy(false);
      if (text) await send(`🎙️ ${text}`, null);
      else Alert.alert("Erro", "❌ (Falha ao transcrever o áudio)");
    } catch (error) {
      setBusy(false);
      const missing = String(error).includes("missing-key");
      Alert.alert(
        "Erro",
        missing
          ? "Falta a chave da OpenAI no arquivo .env."
          : `Falha ao enviar áudio: ${String(error)}`,
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Reveal>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.header}>
          <Mark size={16} />
          <Text style={styles.title}>Tutor</Text>
          <SoftTouch
            style={[styles.market, market && styles.marketOn]}
            onPress={() => setMarket((on) => !on)}
          >
            <Text style={[styles.marketText, market && styles.marketTextOn]}>
              {market ? "No mercado" : "Estou no mercado"}
            </Text>
          </SoftTouch>
        </View>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.role === "user";
            const image = item.attachment?.mime.startsWith("image/") ? item.attachment.uri : undefined;
            return (
              <View style={[styles.bubble, mine ? styles.user : styles.assistant]}>
                {image ? <Image source={{ uri: image }} style={styles.bubbleImage} /> : null}
                {item.attachment && !image ? (
                  <Text style={mine ? styles.userText : styles.assistantText}>{item.attachment.name}</Text>
                ) : null}
                {item.text ? (
                  <Text style={mine ? styles.userText : styles.assistantText}>{item.text}</Text>
                ) : null}
              </View>
            );
          }}
        />
        {recording ? <Text style={styles.recording}>Gravando áudio...</Text> : null}
        {busy ? <Text style={styles.recording}>Digitando...</Text> : null}
        {pending ? (
          <View style={styles.pending}>
            {pending.mime.startsWith("image/") && pending.uri ? (
              <Image source={{ uri: pending.uri }} style={styles.pendingImage} />
            ) : (
              <Ionicons name="document-text" size={28} color={colors.text} />
            )}
            <Text style={styles.pendingName} numberOfLines={1}>
              {pending.name}
            </Text>
            <SoftTouch onPress={clearAttachment} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </SoftTouch>
          </View>
        ) : null}
        {pending?.mime.startsWith("image/") ? (
          <View style={styles.portionBox}>
            <View style={styles.kindRow}>
              <SoftTouch
                style={[styles.kind, photoKind === "food" && styles.kindOn]}
                onPress={() => setPhotoKind("food")}
              >
                <Text style={[styles.kindText, photoKind === "food" && styles.kindTextOn]}>Comida</Text>
              </SoftTouch>
              <SoftTouch
                style={[styles.kind, photoKind === "gear" && styles.kindOn]}
                onPress={() => setPhotoKind("gear")}
              >
                <Text style={[styles.kindText, photoKind === "gear" && styles.kindTextOn]}>Aparelho</Text>
              </SoftTouch>
              <SoftTouch
                style={[styles.kind, photoKind === "receipt" && styles.kindOn]}
                onPress={() => setPhotoKind("receipt")}
              >
                <Text style={[styles.kindText, photoKind === "receipt" && styles.kindTextOn]}>Cupom</Text>
              </SoftTouch>
            </View>
            {photoKind === "food"
              ? portions.map((line) => (
                  <View key={line.id} style={styles.portionRow}>
                    <TextInput
                      style={styles.portionFood}
                      placeholder="Alimento"
                      placeholderTextColor={colors.textSecondary}
                      value={line.food}
                      onChangeText={(food) =>
                        setPortions((current) => current.map((item) => (item.id === line.id ? { ...item, food } : item)))
                      }
                    />
                    <TextInput
                      style={styles.portionAmount}
                      placeholder="150 g"
                      placeholderTextColor={colors.textSecondary}
                      value={line.amount}
                      onChangeText={(amount) =>
                        setPortions((current) =>
                          current.map((item) => (item.id === line.id ? { ...item, amount } : item)),
                        )
                      }
                    />
                  </View>
                ))
              : null}
            {photoKind === "food" ? (
              <SoftTouch onPress={() => setPortions((current) => [...current, blankPortion()])}>
                <Text style={styles.addPortion}>Adicionar alimento</Text>
              </SoftTouch>
            ) : null}
          </View>
        ) : null}
        <View style={styles.composer}>
          <View style={styles.pill}>
            <TextInput
              style={styles.input}
              placeholder="Mensagem"
              placeholderTextColor={colors.textSecondary}
              value={input}
              onChangeText={setInput}
              editable={!busy}
              multiline
            />
            <SoftTouch style={styles.pillIcon} onPress={pickFile} disabled={busy}>
              <Ionicons name="attach" size={24} color={colors.textSecondary} />
            </SoftTouch>
            <SoftTouch style={styles.pillIcon} onPress={takePhoto} disabled={busy}>
              <Ionicons name="camera" size={22} color={colors.textSecondary} />
            </SoftTouch>
          </View>
          <SoftTouch
            style={[styles.action, recording && styles.actionOn]}
            onPress={input.trim() || pending || market ? () => send(input) : undefined}
            onPressIn={input.trim() || pending || market ? undefined : startRecording}
            onPressOut={input.trim() || pending || market ? undefined : stopRecording}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Ionicons name={input.trim() || pending || market ? "send" : "mic"} size={22} color={colors.background} />
            )}
          </SoftTouch>
        </View>
      </KeyboardAvoidingView>
      </Reveal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: { color: colors.primary, fontWeight: "700", width: 70 },
  backSpacer: { width: 70 },
  title: { color: colors.text, fontWeight: "800", fontSize: 18, flex: 1 },
  market: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceHighlight,
  },
  marketOn: { backgroundColor: colors.primary },
  marketText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  marketTextOn: { color: colors.background },
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: "85%", borderRadius: 16, padding: 12 },
  user: { alignSelf: "flex-end", backgroundColor: colors.primary },
  assistant: { alignSelf: "flex-start", backgroundColor: colors.surfaceHighlight },
  userText: { color: colors.background },
  assistantText: { color: colors.text },
  bubbleImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 8, backgroundColor: "#FFFFFF" },
  recording: { color: colors.textSecondary, textAlign: "center", marginBottom: 6 },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 8,
    borderRadius: 16,
    backgroundColor: colors.surfaceHighlight,
  },
  pendingImage: { width: 44, height: 44, borderRadius: 8 },
  pendingName: { flex: 1, color: colors.text },
  portionBox: { marginHorizontal: 12, marginBottom: 8 },
  kindRow: { flexDirection: "row", gap: 8 },
  kind: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.surfaceHighlight,
  },
  kindOn: { backgroundColor: colors.primary },
  kindText: { color: colors.text, fontWeight: "700" },
  kindTextOn: { color: colors.background },
  portionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  portionFood: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  portionAmount: {
    width: 96,
    backgroundColor: colors.surfaceHighlight,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addPortion: { color: colors.primary, fontWeight: "700", marginTop: 8 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 24,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    maxHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  pillIcon: { width: 36, height: 48, alignItems: "center", justifyContent: "center" },
  action: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOn: { backgroundColor: colors.error },
});
