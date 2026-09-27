export type FoodAnswer = "eats" | "avoids";

export type SuggestedFood = {
  id: string;
  label: string;
  slots: string[];
};

export type SuggestedSlot = {
  id: string;
  title: string;
  start: number;
  end: number;
};

const foods: SuggestedFood[] = [
  { id: "ovos", label: "2 ovos mexidos", slots: ["cafe", "colacao", "ceia"] },
  { id: "pao-queijo", label: "2 fatias de pão integral com queijo", slots: ["cafe", "lanche"] },
  { id: "iogurte-fruta", label: "Iogurte natural com uma fruta", slots: ["cafe", "colacao", "lanche", "ceia"] },
  { id: "aveia", label: "Aveia com leite", slots: ["cafe", "colacao"] },
  { id: "fruta", label: "Uma fruta", slots: ["colacao", "lanche", "ceia"] },
  { id: "tapioca", label: "Tapioca com ovo", slots: ["cafe", "lanche"] },
  { id: "arroz-frango", label: "Arroz, feijão, frango grelhado e salada", slots: ["almoco"] },
  { id: "arroz-carne", label: "Arroz, feijão, carne magra e legumes", slots: ["almoco", "jantar"] },
  { id: "omelete", label: "Omelete de 2 ovos com legumes", slots: ["jantar", "ceia"] },
  { id: "frango-salada", label: "Frango grelhado com salada", slots: ["almoco", "jantar"] },
  { id: "sopa", label: "Sopa de legumes com carne", slots: ["jantar"] },
  { id: "sanduiche", label: "Sanduíche integral com frango ou ovo e folha", slots: ["lanche", "jantar"] },
];

const catalog: Record<string, Omit<SuggestedSlot, "start" | "end"> & { start: number; end: number }> = {
  cafe: { id: "cafe", title: "Café da manhã", start: 5, end: 10 },
  colacao: { id: "colacao", title: "Colação", start: 10, end: 12 },
  almoco: { id: "almoco", title: "Almoço", start: 12, end: 15 },
  lanche: { id: "lanche", title: "Lanche", start: 15, end: 18 },
  jantar: { id: "jantar", title: "Jantar", start: 18, end: 21 },
  ceia: { id: "ceia", title: "Ceia", start: 21, end: 29 },
};

export function slotsForCount(count: number): SuggestedSlot[] {
  if (count <= 3) {
    return [
      catalog.cafe,
      { ...catalog.almoco, start: 10 },
      { ...catalog.jantar, start: 15, end: 29 },
    ];
  }
  if (count === 4) {
    return [catalog.cafe, { ...catalog.almoco, start: 10 }, catalog.lanche, { ...catalog.jantar, end: 29 }];
  }
  if (count === 5) {
    return [catalog.cafe, catalog.colacao, catalog.almoco, catalog.lanche, { ...catalog.jantar, end: 29 }];
  }
  return [catalog.cafe, catalog.colacao, catalog.almoco, catalog.lanche, catalog.jantar, catalog.ceia];
}

export function slotNow(slots: SuggestedSlot[], date: Date = new Date()): SuggestedSlot {
  const hour = date.getHours();
  return slots.find((slot) => hour >= slot.start && hour < slot.end) ?? slots[0];
}

export function foodById(id: string): SuggestedFood | undefined {
  return foods.find((food) => food.id === id);
}

export function suggestFood(slotId: string, answers: Record<string, FoodAnswer>, skipped: string[]): SuggestedFood | null {
  const open = foods.filter(
    (food) => food.slots.includes(slotId) && answers[food.id] !== "avoids" && !skipped.includes(food.id),
  );
  const known = open.filter((food) => answers[food.id] === "eats");
  return known[0] ?? open[0] ?? null;
}

export function foodsForSlot(slotId: string, answers: Record<string, FoodAnswer>): SuggestedFood[] {
  return foods.filter((food) => food.slots.includes(slotId) && answers[food.id] !== "avoids");
}

export function eatenNames(answers: Record<string, FoodAnswer> | undefined): string[] {
  if (!answers) return [];
  return foods.filter((food) => answers[food.id] === "eats").map((food) => food.label);
}

export function avoidedNames(answers: Record<string, FoodAnswer> | undefined): string[] {
  if (!answers) return [];
  return foods.filter((food) => answers[food.id] === "avoids").map((food) => food.label);
}

export function suggestedSchedule(count: number, answers: Record<string, FoodAnswer> | undefined) {
  const known = answers ?? {};
  return slotsForCount(count).map((slot) => ({
    id: slot.id,
    title: slot.title,
    options: foodsForSlot(slot.id, known).map((food) => ({ id: food.id, label: food.label })),
  }));
}
