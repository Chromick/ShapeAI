import { cancelRestEnd, scheduleRestEnd } from "./reminders";

type Listener = () => void;

let endsAt = 0;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeRest(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function restSecondsLeft(): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export function restIsRunning(): boolean {
  return endsAt > Date.now();
}

export async function startRest(seconds: number): Promise<void> {
  const span = Math.max(1, Math.round(seconds));
  endsAt = Date.now() + span * 1000;
  emit();
  await scheduleRestEnd(span);
}

export async function stopRest(): Promise<void> {
  endsAt = 0;
  emit();
  await cancelRestEnd();
}

export function finishRestIfDone(): boolean {
  if (!endsAt || Date.now() < endsAt) return false;
  endsAt = 0;
  emit();
  void cancelRestEnd();
  return true;
}

export function formatRest(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
