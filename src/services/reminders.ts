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
    await module.setNotificationChannelAsync("meal", {
      name: "Refeições",
      importance: module.AndroidImportance.DEFAULT,
    });
    await module.setNotificationChannelAsync("care", {
      name: "Cuidador",
      importance: module.AndroidImportance.DEFAULT,
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

export async function syncMealReminders(
  slots: { id: string; hour: number }[],
  done: Record<string, string>,
): Promise<void> {
  try {
    const module = await notifications();
    const current = await module.getPermissionsAsync();
    if (current.status !== "granted") return;
    const scheduled = await module.getAllScheduledNotificationsAsync();
    const existing = scheduled.filter((item) => item.content.data?.kind === "meal");
    await Promise.all(existing.map((item) => module.cancelScheduledNotificationAsync(item.identifier)));
    const now = new Date();
    const pending = slots.filter((slot) => {
      if (done[slot.id]) return false;
      if (slot.hour < 6 || slot.hour > 22) return false;
      if (slot.hour < now.getHours()) return false;
      if (slot.hour === now.getHours() && now.getMinutes() > 5) return false;
      return true;
    });
    await Promise.all(
      pending.map((slot) => {
            const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slot.hour, 0, 0, 0);
            if (when.getTime() <= Date.now() + 2000) return Promise.resolve();
        return module.scheduleNotificationAsync({
          content: {
            title: "Hora da refeição",
            body: "Marca no Shape se você comeu.",
            data: { kind: "meal", mealId: slot.id },
          },
          trigger: {
            type: module.SchedulableTriggerInputTypes.DATE,
            channelId: "meal",
            date: when,
          },
        });
      }),
    );
  } catch {
    return;
  }
}

export async function ensureMealReminders(hours: number[]): Promise<void> {
  await syncMealReminders(
    hours.map((hour, index) => ({ id: `slot-${index}`, hour })),
    {},
  );
}

export async function ensureCareReminders(): Promise<void> {
  try {
    const module = await notifications();
    const current = await module.getPermissionsAsync();
    if (current.status !== "granted") return;
    const hours = [12, 16, 19, 21];
    const scheduled = await module.getAllScheduledNotificationsAsync();
    const existing = scheduled.filter((item) => item.content.data?.kind === "care");
    if (existing.length === hours.length) return;
    await Promise.all(existing.map((item) => module.cancelScheduledNotificationAsync(item.identifier)));
    await Promise.all(
      hours.map((hour) =>
        module.scheduleNotificationAsync({
          content: {
            title: "Shape está de olho",
            body: "Se o treino ou a água ainda não foram marcados, entra no app.",
            data: { kind: "care" },
          },
          trigger: {
            type: module.SchedulableTriggerInputTypes.DAILY,
            channelId: "care",
            hour,
            minute: hour === 19 ? 30 : 0,
          },
        }),
      ),
    );
  } catch {
    return;
  }
}

export async function pingCare(title: string, body: string): Promise<void> {
  try {
    const module = await notifications();
    await module.scheduleNotificationAsync({
      content: { title, body, data: { kind: "care" } },
      trigger: null,
    });
  } catch {
    return;
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
