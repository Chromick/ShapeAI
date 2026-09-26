import { Progression, StoredPlan, sessionForDate } from "./trainingPlan";
import { DailyTracking, getLocalISODate, safeCount } from "../services/nutrition";

export type WeekDay = {
  date: Date;
  iso: string;
  data: DailyTracking | null;
};

export type WeekBounds = {
  start: Date;
  end: Date;
  closing: boolean;
};

export type WeekClose = {
  title: string;
  range: string;
  meals: string;
  training: string;
  water: string;
  weight: string;
  sleep: string;
  load: string;
  script: string;
};

const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function atNoon(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

export function weekBounds(now: Date = new Date()): WeekBounds {
  const today = atNoon(now);
  const weekday = today.getDay();
  const sinceMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - sinceMonday);
  if (weekday === 1) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - 7);
    const end = new Date(monday);
    end.setDate(monday.getDate() - 1);
    return { start, end, closing: true };
  }
  return { start: monday, end: today, closing: weekday === 0 };
}

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = atNoon(start);
  const last = atNoon(end).getTime();
  while (cursor.getTime() <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function rangeLabel(start: Date, end: Date): string {
  const startMonth = months[start.getMonth()];
  const endMonth = months[end.getMonth()];
  if (start.getMonth() === end.getMonth()) return `${start.getDate()} a ${end.getDate()} de ${endMonth}`;
  return `${start.getDate()} de ${startMonth} a ${end.getDate()} de ${endMonth}`;
}

function kilos(value: number): string {
  return String(Math.round(safeCount(value) * 10) / 10).replace(".", ",");
}

function loadLine(
  progression: Progression | undefined,
  poor: number,
  recorded: number,
  dayCount: number,
  planned: number,
  done: number,
  closing: boolean,
  hasPlan: boolean,
): string {
  if (!hasPlan) return "A ficha ainda não existe. Não há carga para subir.";
  if (poor > 0 && progression === "failure") return "Teve noite ruim. Não vai até a falha e não sobe carga.";
  if (poor > 0) return "Teve noite ruim. Mantém a última carga, sem subir.";
  if (recorded === 0) return "Sono não entrou. Sem isso, não sobe carga.";
  if (planned > 0 && done < planned) {
    return closing
      ? "Treino da semana incompleto. Mantém a carga."
      : "Já passou treino sem marcar. Mantém a carga.";
  }
  if (!closing) return "Até aqui a semana está em dia. A carga se decide no fechamento, se as noites seguirem boas e as repetições fecharam.";
  if (recorded < dayCount) return "Faltou sono em parte da semana. Sobe carga só no dia em que a noite foi boa e as repetições fecharam.";
  if (progression === "failure") return "Noites boas e treinos feitos. A ficha é até a falha. Pode manter, se a recuperação seguir boa.";
  return "Noites boas e treinos feitos. Se as repetições fecharam, a carga pode subir.";
}

export function buildWeekClose(
  days: WeekDay[],
  bounds: WeekBounds,
  input: { plan?: StoredPlan; mealsPerDay: number; waterGoalMl: number },
): WeekClose {
  const goal = Math.max(2000, safeCount(input.waterGoalMl));
  const slots = Math.max(0, input.mealsPerDay);
  let marked = 0;
  let planned = 0;
  let done = 0;
  let waterDays = 0;
  let waterHit = 0;
  let waterTotal = 0;
  let good = 0;
  let poor = 0;
  const weights: number[] = [];

  for (const day of days) {
    marked += Object.keys(day.data?.meals_done ?? {}).length;
    const ml = safeCount(day.data?.water_ml);
    if (ml > 0) {
      waterDays += 1;
      waterTotal += ml;
      if (ml >= goal) waterHit += 1;
    }
    const weight = safeCount(day.data?.weight);
    if (weight > 0) weights.push(weight);
    if (day.data?.sleep === "good") good += 1;
    else if (day.data?.sleep === "poor") poor += 1;
    if (!input.plan) continue;
    const session = sessionForDate(input.plan, day.date);
    if (session.rest) continue;
    planned += 1;
    if (day.data?.workout_done) done += 1;
  }

  const meals = slots
    ? `${marked} de ${slots * days.length} refeições marcadas.`
    : "O plano ainda não virou refeições.";
  const training = input.plan ? `${done} de ${planned} treinos feitos.` : "A ficha ainda não foi gerada.";
  const water = waterDays
    ? `Água em ${waterDays} ${waterDays === 1 ? "dia" : "dias"}, média ${kilos(waterTotal / waterDays / 1000)} L. Meta batida em ${waterHit}.`
    : "Água ainda não marcada.";
  const weight =
    weights.length >= 2
      ? `${kilos(weights[0])} kg para ${kilos(weights[weights.length - 1])} kg.`
      : weights.length === 1
        ? `${kilos(weights[0])} kg anotado. Falta outro peso para ver a diferença.`
        : "Peso não anotado nesta semana.";
  const missing = days.length - good - poor;
  const sleep = `${good} ${good === 1 ? "noite boa" : "noites boas"}, ${poor} ${poor === 1 ? "ruim" : "ruins"}${missing ? `, ${missing} sem registro` : ""}.`;
  const load = loadLine(
    input.plan?.progression,
    poor,
    good + poor,
    days.length,
    planned,
    done,
    bounds.closing,
    Boolean(input.plan),
  );
  const title = bounds.closing ? "Fechamento da semana" : "Semana até agora";
  const range = rangeLabel(bounds.start, bounds.end);
  const script = `${title}, ${range}. ${meals} ${training} ${water} ${weight} ${sleep} ${load}`;

  return { title, range, meals, training, water, weight, sleep, load, script };
}

export function isoDays(bounds: WeekBounds): string[] {
  return eachDay(bounds.start, bounds.end).map((date) => getLocalISODate(date));
}
