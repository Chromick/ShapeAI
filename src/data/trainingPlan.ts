export type MuscleId =
  | "peito"
  | "costas"
  | "ombro"
  | "biceps"
  | "triceps"
  | "quadriceps"
  | "posterior"
  | "gluteos"
  | "panturrilha"
  | "core";

export type DaysPerWeek = 3 | 4 | 5;
export type Progression = "pyramid" | "straight" | "failure";
export type SetStyle = Progression | "time";

export type LoadMemory = {
  values: string[];
  date: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  muscleId: MuscleId;
  sets: number;
  scheme: string;
  why: string;
  setStyle?: SetStyle;
  priority?: boolean;
  swappedFrom?: string;
  swapNote?: string;
};

export type TrainingSession = {
  id: string;
  title: string;
  dayLabel: string;
  weekday: number;
  rest: boolean;
  summary: string;
  exercises: Exercise[];
};

export type StoredPlan = {
  daysPerWeek: DaysPerWeek;
  priorities: MuscleId[];
  progression?: Progression;
  progressionReason?: string;
  sessions: TrainingSession[];
  weekStart?: string;
  weekMap?: Record<string, string>;
};

export function progressionFor(
  metrics: { age?: number; activity?: number } | undefined,
  sleep?: "good" | "poor" | null,
): { progression: Progression; reason: string } {
  const age = Number(metrics?.age);
  const activity = Number(metrics?.activity);
  const years = Number.isFinite(age) && age > 0 ? age : 0;
  const trains = Number.isFinite(activity) && activity >= 1.55;
  const intense = Number.isFinite(activity) && activity >= 1.725;

  if (!years) {
    return {
      progression: "straight",
      reason: "Sem idade no perfil. Séries comuns até a idade entrar.",
    };
  }
  if (sleep === "poor") {
    return {
      progression: "straight",
      reason: "Sono ruim. Séries comuns, sem subir carga e sem ir até a falha.",
    };
  }
  if (years >= 45 || !trains) {
    return {
      progression: "straight",
      reason:
        years >= 45
          ? `Aos ${years} anos, séries comuns. A mesma carga nas 3 séries, de 8 a 12.`
          : "Treino ainda leve. Séries comuns até o movimento assentar.",
    };
  }
  if (years < 35 && intense && sleep === "good") {
    return {
      progression: "failure",
      reason: "Idade, treino intenso e noite boa. Séries até a falha.",
    };
  }
  return {
    progression: "pyramid",
    reason: `Aos ${years} anos e já treinando na semana. Pirâmide 12, 10 e 8, uma carga por série.`,
  };
}

type Region = "upper" | "lower";
type SessionKind = "upper" | "lower" | "full";

type Variation = { name: string; why: string; scheme?: string };

type MuscleDef = {
  id: MuscleId;
  label: string;
  region: Region;
  variations: Variation[];
};

const pyramid = "Pirâmide 12 → 10 → 8";

export const MUSCLES: MuscleDef[] = [
  {
    id: "peito",
    label: "Peito",
    region: "upper",
    variations: [
      { name: "Supino reto com barra", why: "Peito na porção média." },
      { name: "Supino inclinado com halteres", why: "Peito na porção de cima, outro ângulo da semana." },
      { name: "Crucifixo na máquina", why: "Peito em alongamento, sem carga instável." },
    ],
  },
  {
    id: "costas",
    label: "Costas",
    region: "upper",
    variations: [
      { name: "Puxada frontal aberta", why: "Dorsal em amplitude." },
      { name: "Remada curvada ou cavalinho", why: "Espessura de costas." },
      { name: "Remada baixa na polia", why: "Costas com o tronco estável." },
    ],
  },
  {
    id: "ombro",
    label: "Ombro",
    region: "upper",
    variations: [
      { name: "Desenvolvimento com halteres", why: "Ombro com carga, deltoide anterior." },
      { name: "Elevação lateral", why: "Deltoide lateral, carga moderada." },
      { name: "Elevação lateral na polia", why: "Mesmo músculo, tensão mais constante." },
    ],
  },
  {
    id: "biceps",
    label: "Bíceps",
    region: "upper",
    variations: [
      { name: "Rosca direta com barra", why: "Bíceps na porção longa." },
      { name: "Rosca martelo", why: "Braquial, ângulo diferente." },
      { name: "Rosca inclinada com halteres", why: "Bíceps alongado." },
    ],
  },
  {
    id: "triceps",
    label: "Tríceps",
    region: "upper",
    variations: [
      { name: "Tríceps na polia com corda", why: "Cabeça lateral, fácil de ajustar a carga." },
      { name: "Tríceps francês com halteres", why: "Cabeça longa, antes da fadiga se for prioridade." },
      { name: "Tríceps testa com barra EZ", why: "Terceiro ângulo, cotovelo mais flexionado." },
    ],
  },
  {
    id: "quadriceps",
    label: "Quadríceps",
    region: "lower",
    variations: [
      { name: "Agachamento livre ou hack", why: "Quadríceps bilateral." },
      { name: "Leg press", why: "Quadríceps com a lombar apoiada." },
      { name: "Agachamento búlgaro", why: "Quadríceps unilateral." },
    ],
  },
  {
    id: "posterior",
    label: "Posterior",
    region: "lower",
    variations: [
      { name: "Stiff", why: "Posterior e cadeia de trás, com o quadril." },
      { name: "Mesa flexora", why: "Posterior isolado." },
      { name: "Flexora em pé", why: "Uma perna de cada vez." },
    ],
  },
  {
    id: "gluteos",
    label: "Glúteos",
    region: "lower",
    variations: [
      { name: "Hip thrust", why: "Glúteo máximo, pouca fadiga lombar." },
      { name: "Abdução de quadril", why: "Glúteo médio." },
      { name: "Elevação pélvica unilateral", why: "Glúteo de um lado, no começo se for prioridade." },
    ],
  },
  {
    id: "panturrilha",
    label: "Panturrilha",
    region: "lower",
    variations: [
      { name: "Panturrilha em pé", why: "Gastrocnêmio." },
      { name: "Panturrilha sentado", why: "Sóleo, joelho flexionado." },
      { name: "Panturrilha no leg press", why: "Mesmo músculo, sem equilíbrio em cima." },
    ],
  },
  {
    id: "core",
    label: "Core",
    region: "lower",
    variations: [
      { name: "Abdominal na polia", why: "Core com carga controlada." },
      { name: "Prancha", why: "Estabilidade, sem ir à falha.", scheme: "3 séries de 30 a 40 segundos" },
      { name: "Abdominal infra", why: "Porção de baixo do abdômen." },
    ],
  },
];

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Blueprint = { weekday: number; kind: SessionKind; title: string };

const BLUEPRINTS: Record<DaysPerWeek, Blueprint[]> = {
  3: [
    { weekday: 1, kind: "full", title: "Full A" },
    { weekday: 3, kind: "full", title: "Full B" },
    { weekday: 5, kind: "full", title: "Full C" },
  ],
  4: [
    { weekday: 1, kind: "upper", title: "Superior A" },
    { weekday: 2, kind: "lower", title: "Inferior A" },
    { weekday: 4, kind: "upper", title: "Superior B" },
    { weekday: 5, kind: "lower", title: "Inferior B" },
  ],
  5: [
    { weekday: 1, kind: "upper", title: "Superior A" },
    { weekday: 2, kind: "lower", title: "Inferior A" },
    { weekday: 3, kind: "upper", title: "Superior B" },
    { weekday: 4, kind: "lower", title: "Inferior B" },
    { weekday: 5, kind: "full", title: "Fechamento" },
  ],
};

function muscleById(id: MuscleId): MuscleDef {
  const found = MUSCLES.find((muscle) => muscle.id === id);
  if (!found) throw new Error(id);
  return found;
}

export function muscleLabel(id: MuscleId): string {
  return muscleById(id).label;
}

function accepts(kind: SessionKind, region: Region): boolean {
  if (kind === "full") return true;
  return kind === region;
}

function styled(variation: Variation, progression: Progression): { scheme: string; setStyle: SetStyle } {
  if (variation.scheme) return { scheme: variation.scheme, setStyle: "time" };
  if (progression === "straight") return { scheme: "3 séries iguais, 8 a 12", setStyle: "straight" };
  if (progression === "failure") return { scheme: "3 séries até a falha", setStyle: "failure" };
  return { scheme: pyramid, setStyle: "pyramid" };
}

function sessionSummary(progression: Progression, focus: string[]): string {
  const style =
    progression === "straight"
      ? "Mesma carga nas 3 séries."
      : progression === "failure"
        ? "Até a falha, sem número fixo de repetições."
        : "Pirâmide 12, 10 e 8, perto da falha, sem esgotar.";
  return focus.length ? `${focus.join(" e ")} na frente. ${style}` : `Sem prioridade neste dia. ${style}`;
}

export function loadKey(name: string): string {
  return name.trim().toLowerCase();
}

export function loadSlots(exercise: Pick<Exercise, "scheme" | "setStyle">): string[] {
  if (exercise.setStyle === "time") return [];
  if (exercise.setStyle === "straight" || exercise.setStyle === "failure") return ["carga"];
  if (exercise.setStyle === "pyramid") return ["12", "10", "8"];
  const scheme = exercise.scheme.toLowerCase();
  if (scheme.includes("segundo")) return [];
  if (scheme.includes("falha")) return ["carga"];
  if (scheme.includes("pirâmide") || scheme.includes("piramide")) return ["12", "10", "8"];
  return ["carga"];
}

export function buildPlan(
  daysPerWeek: DaysPerWeek,
  priorities: MuscleId[],
  progression: Progression = "pyramid",
): StoredPlan {
  const unique = [...new Set(priorities)].slice(0, 2);
  const blueprints = BLUEPRINTS[daysPerWeek];
  const buckets: { muscle: MuscleDef; variation: Variation; priority: boolean }[][] = blueprints.map(() => []);

  const slots = MUSCLES.flatMap((muscle) => {
    const priority = unique.includes(muscle.id);
    const count = priority ? 3 : 2;
    return muscle.variations.slice(0, count).map((variation) => ({ muscle, variation, priority }));
  }).sort((a, b) => Number(b.priority) - Number(a.priority));

  for (const slot of slots) {
    let best = 0;
    let bestSize = Number.POSITIVE_INFINITY;
    blueprints.forEach((blueprint, index) => {
      if (!accepts(blueprint.kind, slot.muscle.region)) return;
      if (buckets[index].length < bestSize) {
        best = index;
        bestSize = buckets[index].length;
      }
    });
    buckets[best].push(slot);
  }

  const priorityNames = unique.map(muscleLabel);
  const trainingSessions: TrainingSession[] = blueprints.map((blueprint, index) => {
    const ordered = [...buckets[index]].sort((a, b) => Number(b.priority) - Number(a.priority));
    const exercises: Exercise[] = ordered.map((slot, exerciseIndex) => {
      const style = styled(slot.variation, progression);
      const exercise: Exercise = {
        id: `${blueprint.weekday}-${slot.muscle.id}-${exerciseIndex}`,
        name: slot.variation.name,
        muscle: slot.muscle.label,
        muscleId: slot.muscle.id,
        sets: 3,
        scheme: style.scheme,
        setStyle: style.setStyle,
        why: slot.priority
          ? `Prioridade. ${slot.variation.why} Entra no começo, com 9 séries na semana.`
          : `${slot.variation.why} Fecha 6 séries na semana, em outro ângulo.`,
      };
      if (slot.priority) exercise.priority = true;
      return exercise;
    });
    const focus = exercises.filter((exercise) => exercise.priority).map((exercise) => exercise.muscle);
    const uniqueFocus = [...new Set(focus)];
    return {
      id: `${blueprint.kind}-${blueprint.weekday}`,
      title: blueprint.title,
      dayLabel: DAY_NAMES[blueprint.weekday],
      weekday: blueprint.weekday,
      rest: false,
      summary: sessionSummary(progression, uniqueFocus),
      exercises,
    };
  });

  const sessions = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const found = trainingSessions.find((session) => session.weekday === weekday);
    if (found) return found;
    return {
      id: `rest-${weekday}`,
      title: "Descanso",
      dayLabel: DAY_NAMES[weekday],
      weekday,
      rest: true,
      summary: "Sem musculação. Sono ruim e déficit pedem este dia livre.",
      exercises: [],
    };
  });

  return { daysPerWeek, priorities: unique, progression, sessions };
}

function atNoon(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

export function isoDate(date: Date = new Date()): string {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().split("T")[0];
}

export function mondayOf(date: Date = new Date()): Date {
  const today = atNoon(date);
  const weekday = today.getDay();
  const sinceMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - sinceMonday);
  return monday;
}

function mondayIndex(weekday: number): number {
  return weekday === 0 ? 6 : weekday - 1;
}

function addDays(date: Date, days: number): Date {
  const next = atNoon(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sundayOf(date: Date = new Date()): Date {
  return addDays(mondayOf(date), 6);
}

function calendarSession(plan: StoredPlan, date: Date): TrainingSession {
  return plan.sessions.find((session) => session.weekday === date.getDay()) ?? plan.sessions[0];
}

export function trainingOrder(plan: StoredPlan): TrainingSession[] {
  return plan.sessions
    .filter((session) => !session.rest)
    .sort((a, b) => mondayIndex(a.weekday) - mondayIndex(b.weekday));
}

export function sessionLetter(plan: StoredPlan, sessionId: string): string {
  const index = trainingOrder(plan).findIndex((session) => session.id === sessionId);
  return index >= 0 ? String.fromCharCode(65 + index) : "";
}

export function sessionForDate(plan: StoredPlan, date: Date = new Date()): TrainingSession {
  const start = isoDate(mondayOf(date));
  if (plan.weekStart === start && plan.weekMap) {
    const mapped = plan.weekMap[isoDate(date)];
    if (mapped) {
      return plan.sessions.find((session) => session.id === mapped) ?? calendarSession(plan, date);
    }
  }
  return calendarSession(plan, date);
}

export function weekAgenda(plan: StoredPlan, date: Date = new Date()): { date: Date; session: TrainingSession }[] {
  const monday = mondayOf(date);
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const day = addDays(monday, offset);
    return { date: day, session: sessionForDate(plan, day) };
  });
}

export function matchSession(plan: StoredPlan, hint: string, now: Date = new Date()): TrainingSession | undefined {
  const raw = hint.trim().toLowerCase();
  if (!raw) return sessionForDate(plan, now);
  const train = trainingOrder(plan);
  if (/ontem/.test(raw)) {
    const yesterday = addDays(now, -1);
    const previous = sessionForDate(plan, yesterday);
    if (!previous.rest) return previous;
    return train[0];
  }
  const letter = raw.replace(/treino\s*/g, "").trim();
  const fromLetter = letter.match(/^([a-e])$/);
  if (fromLetter) {
    const index = fromLetter[1].charCodeAt(0) - 97;
    return train[index];
  }
  return (
    train.find((session) => session.id.toLowerCase() === raw) ??
    train.find((session) => session.title.toLowerCase() === raw) ??
    train.find((session) => session.title.toLowerCase().includes(raw)) ??
    plan.sessions.find((session) => session.dayLabel.toLowerCase().includes(raw) && !session.rest) ??
    train.find((session) => sessionLetter(plan, session.id).toLowerCase() === letter)
  );
}

function restOn(plan: StoredPlan, weekday: number): TrainingSession | undefined {
  return plan.sessions.find((session) => session.rest && session.weekday === weekday) ?? plan.sessions.find((session) => session.rest);
}

export function applySessionToday(
  plan: StoredPlan,
  hint: string,
  now: Date = new Date(),
): { plan: StoredPlan; message: string } | { error: string } {
  const chosen = matchSession(plan, hint, now);
  if (!chosen || chosen.rest) {
    return { error: "Não achei esse treino na ficha. Fala A, B, C ou o nome do dia." };
  }
  const train = trainingOrder(plan);
  if (!train.some((session) => session.id === chosen.id)) {
    return { error: "Esse dia é descanso na ficha." };
  }
  const already = sessionForDate(plan, now);
  if (already.id === chosen.id && !/ontem/.test(hint.trim().toLowerCase())) {
    const letter = sessionLetter(plan, chosen.id);
    return {
      plan,
      message: `Hoje já é o treino ${letter} (${chosen.title}).`,
    };
  }

  const monday = mondayOf(now);
  const sunday = sundayOf(now);
  const today = atNoon(now);
  const map: Record<string, string> = {};
  const sameWeek = plan.weekStart === isoDate(monday);

  for (let cursor = new Date(monday); cursor < today; cursor = addDays(cursor, 1)) {
    const iso = isoDate(cursor);
    map[iso] = sameWeek && plan.weekMap?.[iso] ? plan.weekMap[iso] : calendarSession(plan, cursor).id;
  }

  if (/ontem/.test(hint.trim().toLowerCase())) {
    const yesterday = addDays(today, -1);
    if (yesterday.getTime() >= monday.getTime()) {
      const rest = restOn(plan, yesterday.getDay());
      if (rest) map[isoDate(yesterday)] = rest.id;
    }
  }

  map[isoDate(today)] = chosen.id;

  const used = new Set(Object.values(map));
  const leftover = train.filter((session) => !used.has(session.id));
  const free: Date[] = [];
  for (let cursor = addDays(today, 1); cursor <= sunday; cursor = addDays(cursor, 1)) {
    free.push(new Date(cursor));
  }

  leftover.forEach((session, step) => {
    const slot = free[step];
    if (!slot) return;
    map[isoDate(slot)] = session.id;
  });

  free.slice(leftover.length).forEach((slot) => {
    const rest = restOn(plan, slot.getDay());
    if (rest) map[isoDate(slot)] = rest.id;
  });

  const next: StoredPlan = { ...plan, weekStart: isoDate(monday), weekMap: map };
  const remaining = leftover
    .map((session) => {
      const when = weekAgenda(next, today).find((item) => item.session.id === session.id);
      const day = when ? DAY_NAMES[when.date.getDay()] : "a encaixar na próxima semana";
      return `${sessionLetter(next, session.id)} ${session.title} na ${day}`;
    })
    .join("; ");
  const letter = sessionLetter(next, chosen.id);
  return {
    plan: next,
    message: remaining
      ? `Hoje é o treino ${letter} (${chosen.title}). O que faltava foi empurrado: ${remaining}.`
      : `Hoje é o treino ${letter} (${chosen.title}). Não resta outro treino nesta semana.`,
  };
}

export function volumeOf(plan: StoredPlan): { muscle: string; sets: number; priority: boolean }[] {
  const totals = new Map<MuscleId, number>();
  for (const session of plan.sessions) {
    for (const exercise of session.exercises) {
      totals.set(exercise.muscleId, (totals.get(exercise.muscleId) ?? 0) + exercise.sets);
    }
  }
  return MUSCLES.map((muscle) => ({
    muscle: muscle.label,
    sets: totals.get(muscle.id) ?? 0,
    priority: plan.priorities.includes(muscle.id),
  })).filter((item) => item.sets > 0);
}

export function rulesFor(plan: StoredPlan | undefined): string {
  if (!plan) {
    return "O usuário ainda não escolheu prioridades nem dias. Mande ele abrir a aba Treino e concluir o primeiro acesso.";
  }
  const names = plan.priorities.map(muscleLabel).join(" e ");
  const agenda = plan.sessions
    .filter((session) => !session.rest)
    .map((session) => `${session.dayLabel}: ${session.title}`)
    .join(", ");
  const progression = plan.progression ?? "pyramid";
  const current =
    progression === "straight"
      ? "séries comuns, a mesma carga nas 3 séries"
      : progression === "failure"
        ? "3 séries até a falha, sem número fixo de repetições"
        : "pirâmide 12 → 10 → 8, com uma carga para cada série";
  return `Dias: ${plan.daysPerWeek} por semana (${agenda}).
Prioridades, no máximo duas: ${names}. Elas abrem o treino quando aparecem e ficam com 9 séries. Os outros grupamentos ficam com 6.
Progressão desta ficha: ${current}. ${plan.progressionReason ?? ""}
O formato já foi escolhido pelos dados: idade, quanto a pessoa treina e o sono. Não peça para ela escolher pirâmide, série comum ou falha na entrada.
Séries comuns servem para idade mais alta, treino leve ou sono ruim. Até a falha só cabe com menos de 35 anos, treino intenso e noite boa. Tempo, como a prancha, não tem carga.
Sono ruim ou déficit: não sobe carga e não manda ir até a falha. Mantém a última carga.
Se a pessoa quiser outro formato, explica a diferença. A ficha só muda quando ela gera de novo na aba Treino, e o app recalcula o formato. Não reescreve a divisão sozinho.
Se faltou um dia de treino e ela fez (ou vai fazer) o treino atrasado hoje, use apply_training_today. Isso empurra o que ainda falta e tira o descanso que não cabe mais. Não deixe a aba Treino no dia antigo.
Se a pessoa trocar um exercício porque o aparelho estava ocupado, use swap_exercise no mesmo grupamento e no dia em que ela treinou. A troca fica gravada na ficha.`;
}

export function planScript(plan: StoredPlan): string {
  return plan.sessions
    .filter((session) => !session.rest)
    .map(
      (session) =>
        `${session.dayLabel} | ${session.title} | ${session.exercises
          .map((exercise) => `${exercise.name} (${exercise.muscle})`)
          .join("; ")}`,
    )
    .join("\n");
}

export function alternativesFor(exercise: { muscleId: MuscleId; name: string }): string[] {
  const muscle = MUSCLES.find((item) => item.id === exercise.muscleId);
  return (muscle?.variations.map((item) => item.name) ?? []).filter((name) => name !== exercise.name);
}

export function swapExercise(
  plan: StoredPlan,
  input: { day?: string; currentName: string; newName: string; note?: string },
  today: Date = new Date(),
): { plan: StoredPlan; message: string } | { error: string } {
  const current = input.currentName.trim().toLowerCase();
  const nextName = input.newName.trim();
  if (!current || !nextName) return { error: "Faltou o exercício antigo ou o novo." };

  const dayHint = input.day?.trim().toLowerCase();
  const matches = plan.sessions.flatMap((session) =>
    session.exercises
      .filter((exercise) => {
        const name = exercise.name.toLowerCase();
        return name.includes(current) || current.includes(name);
      })
      .map((exercise) => ({ session, exercise })),
  );
  if (!matches.length) return { error: `Não achei "${input.currentName}" na ficha.` };

  const picked =
    matches.find((item) => dayHint && item.session.dayLabel.toLowerCase().includes(dayHint)) ??
    matches.find((item) => item.session.weekday === today.getDay()) ??
    matches[0];

  const sessions = plan.sessions.map((session) => {
    if (session.id !== picked.session.id) return session;
    return {
      ...session,
      exercises: session.exercises.map((exercise) => {
        if (exercise.id !== picked.exercise.id) return exercise;
        return {
          ...exercise,
          name: nextName,
          swappedFrom: exercise.swappedFrom ?? exercise.name,
          swapNote: input.note?.trim() || "Troca registrada no tutor.",
          why: `Troca registrada: saiu ${exercise.name}. ${input.note?.trim() || "Mesmo grupamento, outro movimento."}`,
        };
      }),
    };
  });

  return {
    plan: { ...plan, sessions },
    message: `${picked.session.dayLabel}: ${picked.exercise.name} virou ${nextName}. Continua sendo ${picked.exercise.muscle}.`,
  };
}
