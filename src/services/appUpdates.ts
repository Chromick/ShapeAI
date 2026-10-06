import { AppState } from "react-native";
import * as Updates from "expo-updates";

const APPLY_NOW_WINDOW_MS = 6000;

export function watchAppUpdates(): () => void {
  if (__DEV__ || !Updates.isEnabled) return () => undefined;
  const startedAt = Date.now();
  let ready = false;

  const sub = AppState.addEventListener("change", (state) => {
    if (ready && state === "background") void Updates.reloadAsync().catch(() => undefined);
  });

  (async () => {
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) return;
      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew) return;
      if (Date.now() - startedAt < APPLY_NOW_WINDOW_MS) await Updates.reloadAsync();
      else ready = true;
    } catch {
      return;
    }
  })();

  return () => sub.remove();
}
