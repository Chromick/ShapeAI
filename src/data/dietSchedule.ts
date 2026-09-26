export type DietOption = {
  id: string;
  label: string;
};

export type DietMeal = {
  id: string;
  title: string;
  note?: string;
  options: DietOption[];
};

const breakfast: DietOption[] = [
  { id: "b1", label: "Pão integral zero açúcar, 2 fatias, ou francês integral, 1 unidade, + ovo ou queijo, 1, + bebida 150 ml" },
  { id: "b2", label: "Fruta, 1 porção, + 1 colher rasa de aveia ou de sementes" },
  { id: "b3", label: "Iogurte natural, 150 ml, + 1 colher cheia de aveia ou sementes, + fruta" },
  { id: "b4", label: "Salada de fruta, 2 colheres de servir, + 1 colher rasa de aveia ou sementes" },
  { id: "b5", label: "Cuscuz + 3 colheres rasas de farelo de aveia, + 1 a 2 ovos, + bebida 150 ml" },
  { id: "b6", label: "Bolo fit, 1 fatia média, + bebida sem açúcar, 150 ml" },
  { id: "b7", label: "2 ovos + 1 torrada integral, + bebida 150 ml, + fruta, + 1 colher de chá de sementes" },
  { id: "b8", label: "Panqueca de aveia, 4 colheres cheias, + 2 ovos, + bebida 150 ml, + fruta" },
  { id: "b9", label: "Crepioca, 4 colheres cheias de aveia, + 2 ovos, + bebida" },
  { id: "b10", label: "Vitamina turbinada, 150 a 200 ml" },
  { id: "b11", label: "Mingau de aveia no leite desnatado, 150 ml" },
  { id: "b12", label: "Aveia crocante, 4 colheres cheias, + 2 ovos mexidos, + bebida 150 ml" },
  { id: "b13", label: "Sanduíche natural, 1, + carne magra, 100 g, + folhosos" },
];

const lunch: DietOption[] = [
  { id: "l1", label: "Macarrão, 1 escumadeira média, + hortaliça A, 3 a 6 colheres, + proteína 100 g, + folhosos. Fruta" },
  { id: "l2", label: "Hortaliça A, B e C, + proteína 100 g, + folhosos. Fruta" },
  { id: "l3", label: "Arroz, 3 a 4 colheres, + feijão, 1 concha, + hortaliça A, + proteína 100 g, + folhosos. Fruta" },
  { id: "l4", label: "Arroz com brócolis, 4 a 5 colheres, + hortaliça, + proteína 100 g, + folhosos. Fruta" },
  { id: "l5", label: "Quinoa, 4 a 7 colheres, + hortaliças, + proteína 100 g, + folhosos. Fruta" },
];

const dinner: DietOption[] = [
  { id: "d1", label: "Hortaliça A, 4 a 7 colheres, + hortaliça B, 3 a 5, + proteína 100 g, + folhosos" },
  { id: "d2", label: "Omelete, 3 ovos, + hortaliças A e B, + folhosos. Fruta" },
  { id: "d3", label: "Sanduíche integral, 1, + carne magra 150 g, + folhosos. Fruta" },
  { id: "d4", label: "Sopa de hortaliças e macarrão + carne, 2 conchas médias. Fruta" },
];

function meal(id: string, title: string, options: DietOption[], note?: string): DietMeal {
  return { id, title, options, note };
}

export function eMultiSchedule(): DietMeal[] {
  return [
    meal("cafe", "Café da manhã", breakfast),
    meal("colacao", "Colação", breakfast, "3 ou 4 horas depois do café."),
    meal("almoco", "Almoço", lunch, "Folhosos primeiro. Depois o prato."),
    meal("lanche", "Lanche da tarde", breakfast, "3 ou 4 horas depois do almoço."),
    meal("jantar", "Jantar", dinner, "Folhosos primeiro. Depois o prato."),
    meal("ceia", "Ceia", breakfast, "Se ainda couber no intervalo de 3 ou 4 horas."),
  ];
}

const heading = /^(caf[eé]|cola[cç][aã]o|almo[cç]o|lanche|jantar|ceia)\b/i;

function looseSchedule(text: string): DietMeal[] {
  const blocks: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const title = line.replace(/^#+\s*/, "").replace(/:\s*$/, "");
    if (heading.test(title) && title.length < 70) {
      current = { title, lines: [] };
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("-") || /^op[cç][aã]o\b/i.test(line)) {
      current.lines.push(line.replace(/^-\s*/, ""));
    }
  }
  return blocks
    .filter((block) => block.lines.length > 0)
    .map((block, index) =>
      meal(
        `meal-${index}`,
        block.title,
        block.lines.slice(0, 16).map((label, optionIndex) => ({
          id: `${index}-${optionIndex}`,
          label: label.slice(0, 180),
        })),
      ),
    );
}

export function scheduleFor(plan?: string, source?: string): DietMeal[] {
  if (!plan?.trim()) return [];
  if (source === "e-multi-dhara-hentzy" || plan.includes("CAFÉ DA MANHÃ / COLAÇÃO")) return eMultiSchedule();
  return looseSchedule(plan);
}

export function optionLabel(meal: DietMeal, optionId: string | undefined): string {
  if (!optionId) return "Ainda não marcado";
  return meal.options.find((option) => option.id === optionId)?.label ?? "Ainda não marcado";
}
