import { useStore, todayKey } from '../store';
import { fetchAppleHealthDays, latestBodyFromAppleHealth, appleHealthSupported } from './appleHealth';
import { fetchOuraDays } from './oura';

/** Pull fresh data from every connected source. Returns a list of non-fatal errors. */
export async function syncHealth(days = 14): Promise<string[]> {
  const s = useStore.getState();
  const errors: string[] = [];

  if (appleHealthSupported && s.appleHealthEnabled) {
    try {
      s.upsertHealth(await fetchAppleHealthDays(days));
      const b = await latestBodyFromAppleHealth();
      if (b.weightKg && b.weightDate) {
        // Only import if we don't already have a weigh-in that day
        if (!useStore.getState().body.some((e) => e.date === b.weightDate && e.weightKg != null))
          s.addBody({ date: b.weightDate, weightKg: b.weightKg, bodyFatPct: b.bodyFatPct });
      }
      if (b.heightCm && !s.profile.heightCm) s.updateProfile({ heightCm: b.heightCm });
    } catch (e) {
      errors.push(`Apple Health: ${(e as Error).message}`);
    }
  }

  if (s.oura) {
    try {
      s.upsertHealth(await fetchOuraDays(days));
    } catch (e) {
      errors.push(`Oura: ${(e as Error).message}`);
    }
  }
  return errors;
}

export const lastSyncedLabel = () => `Synced ${todayKey()}`;
