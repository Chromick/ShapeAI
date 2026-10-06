import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Easing, StyleSheet, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, User } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MainTabParamList, RootStackParamList } from "./src/navigation/types";
import { watchAppUpdates } from "./src/services/appUpdates";
import { syncWatchSleepOnce } from "./src/services/daySync";
import { runCaregiver } from "./src/services/caregiver";
import { auth } from "./src/services/firebaseConfig";
import { ChatScreen } from "./src/screens/ChatScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { DietScreen } from "./src/screens/DietScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { TrainingSetupScreen } from "./src/screens/TrainingSetupScreen";
import { WorkoutScreen } from "./src/screens/WorkoutScreen";
import { colors } from "./src/theme/colors";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        animation: "fade",
        transitionSpec: {
          animation: "timing",
          config: { duration: 220, easing: Easing.out(Easing.cubic) },
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Treino"
        component={WorkoutScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Dieta"
        component={DietScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="nutrition" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: "Tutor",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => watchAppUpdates(), []);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setBooting(false);
      if (next) {
        void syncWatchSleepOnce();
        void runCaregiver();
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const tick = () => void runCaregiver();
    const interval = setInterval(tick, 15 * 60 * 1000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [user]);

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade", animationDuration: 220 }}>
          {user ? (
            <Stack.Group>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="TrainingSetup" component={TrainingSetupScreen} />
              <Stack.Screen name="Main" component={MainTabs} />
            </Stack.Group>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
});
