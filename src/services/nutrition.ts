import type { StoredPlan } from "../data/trainingPlan";

export type Gender = "M" | "F";
export type Goal = "secar" | "recompost" | "ganhar";

export type Metrics = {
  gender: Gender;
  age: number;
  weight: number;
  height: number;
  activity: number;
  goal: Goal;
};

export type Targets = {
  tmb: number;
  tdee: number;
  calories: number;
  protein: number;
  fat: number;
  carb: number;
  water_ml: number;
};

export type FrequentFood = {
  name: string;
  detail: string;
};

export type Vitamin = {
  id: string;
  name: string;
  dose: string;
};

export type UserProfile = {
  name: string;
  metrics: Metrics;
  targets: Targets;
  createdAt: string;
  lastWeighInDate?: string;
  frequentFoods?: FrequentFood[];
  nutritionistPlan?: string;
  nutritionistAnalysis?: string;
  nutritionistPlanSource?: string;
  vitamins?: Vitamin[];
  trainingPlan?: StoredPlan;
  lastLoads?: Record<string, { values: string[]; date: string }>;
};

export type DailyTracking = {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  water_done: boolean;
  water_ml?: number;
  water_entries?: number[];
  weight?: number;
  workout_done: boolean;
  vitamins_taken?: string[];
  meals_done?: Record<string, string>;
  sleep?: "good" | "poor";
  sleepHours?: number;
  restingHeartRate?: number;
  sleepSource?: string;
};

export const emptyDay = (): DailyTracking => ({
  total_calories: 0,
  total_protein: 0,
  total_carbs: 0,
  total_fats: 0,
  water_done: false,
  workout_done: false,
});

export function getLocalISODate(date: Date = new Date()): string {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().split("T")[0];
}

export function trackingDocId(uid: string, date: string = getLocalISODate()): string {
  return `${uid}_${date}`;
}

function activityMultiplier(activity: number): number {
  if (activity > 1 && activity < 3) return activity;
  const legacy: Record<number, number> = {
    1: 1.2,
    2: 1.375,
    3: 1.55,
    4: 1.725,
    5: 1.9,
  };
  return legacy[activity] ?? 1.55;
}

function goalCalories(tdee: number, goal: Goal | number | string): number {
  if (goal === "secar" || goal === 1) return tdee * 0.85;
  if (goal === "ganhar" || goal === 3) return tdee * 1.1;
  return tdee * 0.95;
}

export function safeCount(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function isMale(gender: string): boolean {
  return gender === "M" || gender === "male" || gender === "Masculino";
}

export function calculateTargets(metrics: Metrics): Targets {
  const weight = safeCount(metrics.weight);
  const height = safeCount(metrics.height);
  const age = safeCount(metrics.age);
  if (weight <= 0 || height <= 0 || age <= 0) {
    return { tmb: 0, tdee: 0, calories: 0, protein: 0, fat: 0, carb: 0, water_ml: 0 };
  }
  const base = 10 * weight + 6.25 * height - 5 * age;
  const tmb = isMale(metrics.gender) ? base + 5 : base - 161;
  const tdee = tmb * activityMultiplier(Number(metrics.activity));
  const calories = goalCalories(tdee, metrics.goal);
  const protein = weight * 2;
  const fat = weight * 0.9;
  const carb = (calories - protein * 4 - fat * 9) / 4;

  return {
    tmb: Math.round(safeCount(tmb)),
    tdee: Math.round(safeCount(tdee)),
    calories: Math.round(safeCount(calories)),
    protein: Math.round(safeCount(protein)),
    fat: Math.round(safeCount(fat)),
    carb: Math.max(0, Math.round(safeCount(carb))),
    water_ml: Math.round(weight * 35),
  };
}

export function daysSince(date: string | undefined): number | null {
  if (!date) return null;
  const then = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.ceil(Math.abs(Date.now() - then.getTime()) / 86400000);
}

export function needsWeighIn(profile: UserProfile): boolean {
  const reference = profile.lastWeighInDate ?? profile.createdAt;
  const days = daysSince(reference);
  return days === null || days >= 7;
}
