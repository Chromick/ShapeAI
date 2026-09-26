import Constants from "expo-constants";
import { Linking, Platform } from "react-native";

export type WatchNight = {
  hours: number;
  quality: "good" | "poor";
  restingHeartRate?: number;
  source: "Conexão Saúde" | "Saúde";
};

export type WatchResult = { ok: true; night: WatchNight } | { ok: false; message: string; download?: boolean };

const POOR_UNDER_HOURS = 6;
const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";
export const HEALTH_CONNECT_STORE = `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;

const shareHint =
  "O relógio ou a pulseira precisa enviar o sono para a Conexão Saúde. No iPhone, o caminho é o app Saúde.";

function inExpoGo(): boolean {
  return Constants.executionEnvironment === "storeClient";
}

function nightWindow(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);
  return { start, end };
}

function hoursFrom(ms: number): number {
  return Math.round((ms / 3_600_000) * 10) / 10;
}

function qualityFrom(hours: number): "good" | "poor" {
  return hours < POOR_UNDER_HOURS ? "poor" : "good";
}

export async function openHealthConnectDownload(): Promise<void> {
  await Linking.openURL(HEALTH_CONNECT_STORE);
}

export async function readWatchNight(): Promise<WatchResult> {
  if (Platform.OS === "android") return readAndroid();
  if (Platform.OS === "ios") return readIos();
  return { ok: false, message: "A conexão com aparelhos só funciona no celular, Android ou iPhone." };
}

async function readAndroid(): Promise<WatchResult> {
  try {
    const health = await import("react-native-health-connect");
    const status = await health.getSdkStatus();
    if (status === health.SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      return {
        ok: false,
        download: true,
        message: "Este celular não tem a Conexão Saúde. Baixe o app para ligar relógio e pulseira.",
      };
    }
    if (status === health.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return {
        ok: false,
        download: true,
        message: "A Conexão Saúde precisa de atualização. Baixe a versão nova na Play Store.",
      };
    }
    const ready = await health.initialize();
    if (!ready) {
      return { ok: false, download: true, message: "Não consegui abrir a Conexão Saúde. Se ela não estiver instalada, baixe abaixo." };
    }

    const granted = await health.requestPermission([
      { accessType: "read", recordType: "SleepSession" },
      { accessType: "read", recordType: "RestingHeartRate" },
    ]);
    const canSleep = granted.some((item) => item.accessType === "read" && item.recordType === "SleepSession");
    if (!canSleep) return { ok: false, message: `Falta permitir a leitura do sono na Conexão Saúde. ${shareHint}` };

    const { start, end } = nightWindow();
    const filter = {
      operator: "between" as const,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
    const sleep = await health.readRecords("SleepSession", { timeRangeFilter: filter });
    if (!sleep.records.length) {
      return { ok: false, message: `A Conexão Saúde está no celular, mas não tem sono desta noite. ${shareHint}` };
    }
    const longest = sleep.records.reduce((best, item) => {
      const ms = new Date(item.endTime).getTime() - new Date(item.startTime).getTime();
      return ms > best ? ms : best;
    }, 0);
    const hours = hoursFrom(longest);
    let restingHeartRate: number | undefined;
    try {
      const heart = await health.readRecords("RestingHeartRate", { timeRangeFilter: filter });
      const last = heart.records[heart.records.length - 1];
      if (last && typeof last.beatsPerMinute === "number") restingHeartRate = Math.round(last.beatsPerMinute);
    } catch {
      restingHeartRate = undefined;
    }
    return {
      ok: true,
      night: { hours, quality: qualityFrom(hours), restingHeartRate, source: "Conexão Saúde" },
    };
  } catch {
    if (inExpoGo()) {
      return {
        ok: false,
        download: true,
        message: "Daqui do Expo Go não dá para confirmar a Conexão Saúde. Se o celular não tiver o app, baixe abaixo. A leitura do sono entra quando o Shape estiver instalado.",
      };
    }
    return { ok: false, download: true, message: "Não achei a Conexão Saúde. Se ela não estiver no celular, baixe abaixo." };
  }
}

async function readIos(): Promise<WatchResult> {
  try {
    const health = await import("@kingstinct/react-native-healthkit");
    const available = await health.isHealthDataAvailableAsync();
    if (!available) return { ok: false, message: "Este iPhone não libera o app Saúde." };
    await health.requestAuthorization({
      toRead: ["HKCategoryTypeIdentifierSleepAnalysis", "HKQuantityTypeIdentifierRestingHeartRate"],
    });
    const { start, end } = nightWindow();
    const samples = await health.queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis", {
      limit: 0,
      filter: { date: { startDate: start, endDate: end } },
    });
    const asleep = samples.filter((sample) => [1, 3, 4, 5].includes(Number(sample.value)));
    const used = asleep.length ? asleep : samples.filter((sample) => Number(sample.value) === 0);
    if (!used.length) return { ok: false, message: `O app Saúde não tem sono desta noite. ${shareHint}` };
    const ms = used.reduce((total, sample) => {
      return total + Math.max(0, sample.endDate.getTime() - sample.startDate.getTime());
    }, 0);
    const hours = hoursFrom(ms);
    let restingHeartRate: number | undefined;
    try {
      const heart = await health.queryQuantitySamples("HKQuantityTypeIdentifierRestingHeartRate", {
        limit: 1,
        ascending: false,
        unit: "count/min",
        filter: { date: { startDate: start, endDate: end } },
      });
      const bpm = heart[0]?.quantity;
      if (typeof bpm === "number") restingHeartRate = Math.round(bpm);
    } catch {
      restingHeartRate = undefined;
    }
    return {
      ok: true,
      night: { hours, quality: qualityFrom(hours), restingHeartRate, source: "Saúde" },
    };
  } catch {
    return { ok: false, message: "Não consegui ler o app Saúde neste iPhone." };
  }
}
