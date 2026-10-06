import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signInWithEmailAndPassword } from "firebase/auth";
import { BrandLockup } from "../components/Mark";
import { Reveal, SoftTouch } from "../components/motion";
import { Edge } from "../components/Edge";
import { auth } from "../services/firebaseConfig";
import { colors } from "../theme/colors";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Erro", "Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      Alert.alert("Acesso Negado", "E-mail ou senha incorretos ou usuário não autorizado.");
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Reveal>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.hero}>
            <BrandLockup size={56} />
            <Text style={styles.lead}>Treino, dieta e o dia, num só lugar.</Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Entrar</Text>
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <SoftTouch style={styles.button} onPress={handleLogin} disabled={loading}>
              <Edge />
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
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
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  hero: { alignItems: "center", marginBottom: 32, gap: 14 },
  lead: {
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 260,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelTitle: { color: colors.text, fontWeight: "800", fontSize: 18, marginBottom: 14 },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    overflow: "hidden",
  },
  buttonText: { color: colors.background, fontWeight: "800", fontSize: 16 },
});
