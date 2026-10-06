import type { GroceryItem } from "../services/nutrition";
import type { FoodAnswer } from "./suggestedDiet";

export type Need = { keys: string[]; value: number; unit: "g" | "un" | "ml"; label: string };

const recipes: Record<string, Need[]> = {
  ovos: [{ keys: ["ovo"], value: 2, unit: "un", label: "ovos" }],
  "pao-queijo": [
    { keys: ["pão", "pao", "integral"], value: 2, unit: "un", label: "pão" },
    { keys: ["queijo"], value: 30, unit: "g", label: "queijo" },
  ],
  "iogurte-fruta": [
    { keys: ["iogurte"], value: 150, unit: "ml", label: "iogurte" },
    { keys: ["fruta", "banana", "maçã", "maca", "mamão", "mamao", "maçã"], value: 1, unit: "un", label: "fruta" },
  ],
  aveia: [
    { keys: ["aveia"], value: 40, unit: "g", label: "aveia" },
    { keys: ["leite"], value: 150, unit: "ml", label: "leite" },
  ],
  fruta: [{ keys: ["fruta", "banana", "maçã", "maca", "mamão", "mamao"], value: 1, unit: "un", label: "fruta" }],
  tapioca: [
    { keys: ["tapioca", "goma"], value: 50, unit: "g", label: "tapioca" },
    { keys: ["ovo"], value: 1, unit: "un", label: "ovos" },
  ],
  "arroz-frango": [
    { keys: ["arroz"], value: 80, unit: "g", label: "arroz" },
    { keys: ["feij"], value: 80, unit: "g", label: "feijão" },
    { keys: ["frango", "peito"], value: 100, unit: "g", label: "frango" },
    { keys: ["folha", "alface", "salada", "couve"], value: 1, unit: "un", label: "folha" },
  ],
  "arroz-carne": [
    { keys: ["arroz"], value: 80, unit: "g", label: "arroz" },
    { keys: ["feij"], value: 80, unit: "g", label: "feijão" },
    { keys: ["carne", "patinho", "alcatra"], value: 100, unit: "g", label: "carne" },
  ],
  omelete: [
    { keys: ["ovo"], value: 2, unit: "un", label: "ovos" },
    { keys: ["legume", "tomate", "cebola"], value: 1, unit: "un", label: "legumes" },
  ],
  "frango-salada": [
    { keys: ["frango", "peito"], value: 120, unit: "g", label: "frango" },
    { keys: ["folha", "alface", "salada"], value: 1, unit: "un", label: "folha" },
  ],
  sopa: [
    { keys: ["legume", "cenoura", "abobr"], value: 1, unit: "un", label: "legumes" },
    { keys: ["carne", "frango"], value: 80, unit: "g", label: "carne" },
  ],
  sanduiche: [
    { keys: ["pão", "pao"], value: 2, unit: "un", label: "pão" },
    { keys: ["frango", "ovo", "peito"], value: 80, unit: "g", label: "recheio" },
  ],
};

export function parseAmount(text: string): { value: number; unit: "g" | "un" | "ml" } | null {
  const raw = text.toLowerCase().replace(",", ".");
  const kg = raw.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kg) return { value: Number(kg[1]) * 1000, unit: "g" };
  const g = raw.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (g) return { value: Number(g[1]), unit: "g" };
  const l = raw.match(/(\d+(?:\.\d+)?)\s*l\b/);
  if (l) return { value: Number(l[1]) * 1000, unit: "ml" };
  const ml = raw.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (ml) return { value: Number(ml[1]), unit: "ml" };
  const dozen = raw.match(/(\d+(?:\.\d+)?)\s*d[uú]zias?/);
  if (dozen) return { value: Number(dozen[1]) * 12, unit: "un" };
  const units = raw.match(/(\d+(?:\.\d+)?)\s*(unidades?|ovos?|fatias?|bandejas?)?/);
  if (units) return { value: Number(units[1]), unit: "un" };
  return null;
}

export function formatAmount(value: number, unit: "g" | "un" | "ml"): string {
  if (unit === "g" && value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(".", ",")} kg`;
  if (unit === "g") return `${Math.round(value)} g`;
  if (unit === "ml" && value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")} L`;
  if (unit === "ml") return `${Math.round(value)} ml`;
  return `${Math.max(0, Math.round(value))} un`;
}

function matchItem(pantry: GroceryItem[], keys: string[]): GroceryItem | undefined {
  return pantry.find((item) => {
    const name = item.name.toLowerCase();
    return keys.some((key) => name.includes(key) || key.includes(name));
  });
}

export function pantryHas(pantry: GroceryItem[] | undefined, keys: string[]): boolean {
  return Boolean(matchItem(pantry ?? [], keys));
}

export function needsForChoice(optionId: string, label: string): Need[] {
  if (recipes[optionId]) return recipes[optionId];
  const text = label.toLowerCase();
  const needs: Need[] = [];
  const eggs = text.match(/(\d+)\s*ovos?/);
  if (eggs) needs.push({ keys: ["ovo"], value: Number(eggs[1]), unit: "un", label: "ovos" });
  const meat = text.match(/(?:prote[ií]na|frango|carne)\s*,?\s*(\d+)\s*g/);
  if (meat) {
    const bird = /frango/.test(text);
    needs.push({
      keys: bird ? ["frango", "peito"] : ["carne", "frango", "peito"],
      value: Number(meat[1]),
      unit: "g",
      label: bird ? "frango" : "proteína",
    });
  }
  if (/arroz/.test(text)) needs.push({ keys: ["arroz"], value: 80, unit: "g", label: "arroz" });
  if (/feij/.test(text)) needs.push({ keys: ["feij"], value: 80, unit: "g", label: "feijão" });
  if (/ovo/.test(text) && !eggs) needs.push({ keys: ["ovo"], value: 1, unit: "un", label: "ovos" });
  if (/folha|alface|salada/.test(text)) needs.push({ keys: ["folha", "alface", "salada", "couve"], value: 1, unit: "un", label: "folha" });
  return needs;
}

export function missingForNeeds(pantry: GroceryItem[] | undefined, needs: Need[]): string[] {
  const stock = pantry ?? [];
  return needs.filter((need) => !matchItem(stock, need.keys)).map((need) => need.label);
}

export function consumePantry(pantry: GroceryItem[], optionId: string, label: string): GroceryItem[] {
  const needs = needsForChoice(optionId, label);
  if (!needs.length) return pantry;
  let next = [...pantry];
  for (const need of needs) {
    const item = matchItem(next, need.keys);
    if (!item) continue;
    const have = parseAmount(item.quantity) ?? { value: need.value, unit: need.unit };
    let left = have.value;
    if (have.unit === need.unit) left -= need.value;
    else if (have.unit === "g" && need.unit === "un") left -= need.value * 50;
    else if (have.unit === "un" && need.unit === "g") left -= Math.max(1, Math.round(need.value / 50));
    const rest = next.filter((row) => row.id !== item.id);
    if (left <= 0.5) {
      next = rest;
    } else {
      next = [{ ...item, quantity: formatAmount(left, have.unit) }, ...rest];
    }
  }
  return next;
}

export function pantryScore(pantry: GroceryItem[] | undefined, optionId: string, label: string): number {
  const needs = needsForChoice(optionId, label);
  if (!needs.length) return 0;
  const missing = missingForNeeds(pantry, needs).length;
  return needs.length - missing;
}

export function preferStockFood(
  slotId: string,
  answers: Record<string, FoodAnswer>,
  skipped: string[],
  pantry: GroceryItem[] | undefined,
  catalog: { id: string; label: string; slots: string[] }[],
): { id: string; label: string } | null {
  const open = catalog.filter(
    (food) => food.slots.includes(slotId) && answers[food.id] !== "avoids" && !skipped.includes(food.id),
  );
  if (!open.length) return null;
  const ranked = [...open].sort((a, b) => {
    const eat = Number(answers[b.id] === "eats") - Number(answers[a.id] === "eats");
    if (eat) return eat;
    return pantryScore(pantry, b.id, b.label) - pantryScore(pantry, a.id, a.label);
  });
  return ranked[0];
}

export function coverageLine(
  meals: { id: string; title: string; options: { id: string; label: string }[] }[],
  done: Record<string, string>,
  pantry: GroceryItem[] | undefined,
): string {
  if (!meals.length) return "";
  const leftover = meals.filter((meal) => !done[meal.id]);
  if (!leftover.length) return "Refeições do dia cobertas.";
  const bits = leftover.map((meal) => {
    const option =
      [...meal.options].sort((a, b) => pantryScore(pantry, b.id, b.label) - pantryScore(pantry, a.id, a.label))[0];
    if (!option) return `${meal.title} ainda aberto`;
    const miss = missingForNeeds(pantry, needsForChoice(option.id, option.label));
    if (!miss.length) return `${meal.title} dá`;
    return `${meal.title} precisa de ${miss.join(", ")}`;
  });
  return bits.join("; ") + ".";
}

export function prepLine(pantry: GroceryItem[] | undefined): string {
  const stock = pantry ?? [];
  const chicken = matchItem(stock, ["frango", "peito"]);
  const meat = matchItem(stock, ["carne", "patinho"]);
  const item = chicken ?? meat;
  if (!item) return "";
  const amount = parseAmount(item.quantity);
  if (amount && amount.unit === "g" && amount.value >= 250) {
    return `Faz o ${item.name} agora e rende o jantar de amanhã.`;
  }
  if (amount && amount.unit === "un" && amount.value >= 4 && /ovo/.test(item.name.toLowerCase())) {
    return "Faz o omelete agora e guarda uma fatia para o lanche.";
  }
  return "";
}

export function pantrySpend(items: GroceryItem[] | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + (item.price ?? 0), 0);
}
