import { doc, getDoc } from "firebase/firestore";
import { WeekClose, WeekDay, buildWeekClose, eachDay, weekBounds } from "../data/weekClose";
import { StoredPlan } from "../data/trainingPlan";
import { db } from "./firebaseConfig";
import { DailyTracking, getLocalISODate, trackingDocId } from "./nutrition";

export async function loadWeekClose(input: {
  uid: string;
  plan?: StoredPlan;
  mealsPerDay: number;
  waterGoalMl: number;
}): Promise<WeekClose> {
  const bounds = weekBounds();
  const dates = eachDay(bounds.start, bounds.end);
  const days: WeekDay[] = await Promise.all(
    dates.map(async (date) => {
      const iso = getLocalISODate(date);
      const snapshot = await getDoc(doc(db, "daily_tracking", trackingDocId(input.uid, iso)));
      return {
        date,
        iso,
        data: snapshot.exists() ? (snapshot.data() as DailyTracking) : null,
      };
    }),
  );
  return buildWeekClose(days, bounds, input);
}
