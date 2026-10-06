export type MealMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

const empty: MealMacros = { calories: 0, protein: 0, carbs: 0, fats: 0 };

const byFoodId: Record<string, MealMacros> = {
  ovos: { calories: 150, protein: 13, carbs: 1, fats: 10 },
  "pao-queijo": { calories: 210, protein: 11, carbs: 24, fats: 7 },
  "iogurte-fruta": { calories: 160, protein: 8, carbs: 28, fats: 3 },
  aveia: { calories: 220, protein: 10, carbs: 32, fats: 6 },
  fruta: { calories: 70, protein: 1, carbs: 18, fats: 0 },
  tapioca: { calories: 250, protein: 12, carbs: 28, fats: 8 },
  "arroz-frango": { calories: 520, protein: 40, carbs: 55, fats: 10 },
  "arroz-carne": { calories: 540, protein: 38, carbs: 55, fats: 14 },
  omelete: { calories: 220, protein: 16, carbs: 6, fats: 14 },
  "frango-salada": { calories: 280, protein: 38, carbs: 8, fats: 10 },
  sopa: { calories: 260, protein: 18, carbs: 24, fats: 8 },
  sanduiche: { calories: 320, protein: 24, carbs: 30, fats: 10 },
};

function n(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function range(a: number, b: number): number {
  return (a + b) / 2;
}

function pick(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  if (match[2]) return range(n(Number(match[1])), n(Number(match[2])));
  return n(Number(match[1]));
}

export function macrosForLabel(label: string): MealMacros {
  const text = label.toLowerCase();
  const next: MealMacros = { ...empty };

  const eggs = pick(text, /(\d+)\s*(?:a\s*(\d+)\s*)?ovos?/);
  if (eggs) {
    next.calories += eggs * 75;
    next.protein += eggs * 6.5;
    next.carbs += eggs * 0.5;
    next.fats += eggs * 5;
  }

  const slices = pick(text, /(\d+)\s*(?:a\s*(\d+)\s*)?fatias?/);
  if (slices) {
    next.calories += slices * 70;
    next.protein += slices * 3;
    next.carbs += slices * 12;
    next.fats += slices * 1;
  }

  const meat = pick(text, /(?:prote[ií]na|carne magra|carne)\s*,?\s*(\d+)\s*(?:a\s*(\d+)\s*)?g/);
  if (meat) {
    next.calories += (meat / 100) * 165;
    next.protein += (meat / 100) * 31;
    next.fats += (meat / 100) * 3.6;
  }

  const rice = pick(text, /arroz[^\d]*(\d+)\s*(?:a\s*(\d+)\s*)?colheres/);
  if (rice) {
    next.calories += rice * 40;
    next.protein += rice * 0.8;
    next.carbs += rice * 8;
    next.fats += rice * 0.2;
  }

  const quinoa = pick(text, /quinoa[^\d]*(\d+)\s*(?:a\s*(\d+)\s*)?colheres/);
  if (quinoa) {
    next.calories += quinoa * 25;
    next.protein += quinoa * 1;
    next.carbs += quinoa * 4;
    next.fats += quinoa * 0.4;
  }

  const oat = pick(text, /(?:aveia|farelo)[^\d]*(\d+)\s*(?:a\s*(\d+)\s*)?colheres/);
  if (oat) {
    next.calories += oat * 30;
    next.protein += oat * 1.5;
    next.carbs += oat * 5;
    next.fats += oat * 0.7;
  }

  const veg = pick(text, /hortali[cç]a[^\d]*(\d+)\s*(?:a\s*(\d+)\s*)?colheres/);
  if (veg) {
    next.calories += veg * 12;
    next.protein += veg * 0.5;
    next.carbs += veg * 2;
  }

  if (/1\s*escumadeira|escumadeira m[eé]dia/.test(text)) {
    next.calories += 140;
    next.protein += 5;
    next.carbs += 28;
    next.fats += 1;
  }
  if (/feij[aã]o/.test(text) && /concha/.test(text)) {
    next.calories += 90;
    next.protein += 5;
    next.carbs += 16;
    next.fats += 0.5;
  }
  const soup = pick(text, /(\d+)\s*(?:a\s*(\d+)\s*)?conchas?/);
  if (soup && /sopa/.test(text)) {
    next.calories += soup * 140;
    next.protein += soup * 9;
    next.carbs += soup * 14;
    next.fats += soup * 4;
  }
  const drink = pick(text, /(\d+)\s*(?:a\s*(\d+)\s*)?ml/);
  if (drink) {
    next.calories += (drink / 150) * 60;
    next.protein += (drink / 150) * 5;
    next.carbs += (drink / 150) * 7;
    next.fats += (drink / 150) * 2;
  }
  if (/\bfruta\b/.test(text)) {
    const fruits = /salada de fruta/.test(text) ? 1.5 : 1;
    next.calories += 70 * fruits;
    next.protein += 1 * fruits;
    next.carbs += 18 * fruits;
  }
  if (/iogurte/.test(text) && !drink) {
    next.calories += 90;
    next.protein += 8;
    next.carbs += 10;
    next.fats += 2.5;
  }
  if (/sandu[ií]che/.test(text)) {
    next.calories += 180;
    next.protein += 8;
    next.carbs += 22;
    next.fats += 5;
  }
  if (/queijo/.test(text) && !slices) {
    next.calories += 70;
    next.protein += 5;
    next.fats += 5;
  }
  if (/bolo fit/.test(text)) {
    next.calories += 180;
    next.protein += 6;
    next.carbs += 28;
    next.fats += 5;
  }
  if (/cuscuz/.test(text)) {
    next.calories += 120;
    next.protein += 3;
    next.carbs += 26;
    next.fats += 0.5;
  }
  if (/mingau/.test(text)) {
    next.calories += 160;
    next.protein += 8;
    next.carbs += 24;
    next.fats += 4;
  }
  if (/panqueca|crepioca/.test(text) && !oat) {
    next.calories += 160;
    next.protein += 6;
    next.carbs += 22;
    next.fats += 4;
  }

  if (next.calories <= 0) return empty;
  return {
    calories: Math.round(next.calories),
    protein: Math.round(next.protein),
    carbs: Math.round(next.carbs),
    fats: Math.round(next.fats),
  };
}

export function macrosForOption(optionId: string, label: string): MealMacros {
  return byFoodId[optionId] ?? macrosForLabel(label);
}

export function addMacros(a: MealMacros, b: MealMacros): MealMacros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fats: a.fats + b.fats,
  };
}

export function macrosFromMeals(
  meals: { id: string; options: { id: string; label: string }[] }[],
  done: Record<string, string>,
): MealMacros {
  return meals.reduce((sum, meal) => {
    const optionId = done[meal.id];
    const option = meal.options.find((item) => item.id === optionId);
    if (!option) return sum;
    return addMacros(sum, macrosForOption(option.id, option.label));
  }, empty);
}
