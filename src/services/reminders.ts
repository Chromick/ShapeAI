import { Platform } from "react-native";

const WATER_HOURS = [8, 10, 12, 14, 16, 18, 20];

let handlerReady = false;
let restNotificationId: string | null = null;

async function notifications() {
  const module = await import("expo-notifications");
  if (!handlerReady) {
    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerReady = true;
  }
  if (Platform.OS === "android") {
    await module.setNotificationChannelAsync("water", {
      name: "Água",
      importance: module.AndroidImportance.DEFAULT,
    });
    await module.setNotificationChannelAsync("rest", {
      name: "Descanso do treino",
      importance: module.AndroidImportance.HIGH,
    });
  }
  return module;
}

export async function ensureWaterReminders(): Promise<"on" | "denied" | "unavailable"> {
  try {
    const module = await notifications();
    const current = await module.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      const asked = await module.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") return "denied";

    const scheduled = await module.getAllScheduledNotificationsAsync();
    const existing = scheduled.filter((item) => item.content.data?.kind === "water");
    if (existing.length === WATER_HOURS.length) return "on";
    await Promise.all(existing.map((item) => module.cancelScheduledNotificationAsync(item.identifier)));

    await Promise.all(
      WATER_HOURS.map((hour) =>
        module.scheduleNotificationAsync({
          content: {
            title: "Hora da água",
            body: "Bebe um pouco e marca no app mais ou menos quanto tomou.",
            data: { kind: "water" },
          },
          trigger: {
            type: module.SchedulableTriggerInputTypes.DAILY,
            channelId: "water",
            hour,
            minute: 0,
          },
        }),
      ),
    );
    return "on";
  } catch {
    return "unavailable";
  }
}

export async function scheduleRestEnd(seconds: number): Promise<void> {
  try {
    const module = await notifications();
    if (restNotificationId) {
      await module.cancelScheduledNotificationAsync(restNotificationId).catch(() => undefined);
    }
    restNotificationId = await module.scheduleNotificationAsync({
      content: {
        title: "Descanso acabou",
        body: "Próxima série.",
        data: { kind: "rest" },
      },
      trigger: {
        type: module.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: "rest",
        seconds: Math.max(1, Math.round(seconds)),
      },
    });
  } catch {
    restNotificationId = null;
  }
}

export async function cancelRestEnd(): Promise<void> {
  if (!restNotificationId) return;
  const id = restNotificationId;
  restNotificationId = null;
  try {
    const module = await notifications();
    await module.cancelScheduledNotificationAsync(id);
  } catch {
    restNotificationId = null;
  }
}
