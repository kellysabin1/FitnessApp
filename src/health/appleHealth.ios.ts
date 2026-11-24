// Apple Health (HealthKit) — iOS only. RingConn, Apple Watch, and most other
// wearables write into Apple Health, so this is how we get RingConn data too.
import {
  CategoryValueSleepAnalysis,
  getMostRecentQuantitySample,
  isHealthDataAvailable,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { HealthDay } from '../store';
import { todayKey } from '../store';

export const appleHealthSupported = true;

const READ = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierHeight',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
] as const;

export async function connectAppleHealth(): Promise<boolean> {
  if (!isHealthDataAvailable()) return false;
  return requestAuthorization({ toRead: READ });
}

function dayRange(daysAgo: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

/** Pull the last `days` days of daily totals/averages. */
export async function fetchAppleHealthDays(days = 7): Promise<HealthDay[]> {
  const out: HealthDay[] = [];
  for (let i = 0; i < days; i++) {
    const { start, end } = dayRange(i);
    const filter = { date: { startDate: start, endDate: end } };
    const [steps, energy, rhr, hrv] = await Promise.all([
      queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], { filter, unit: 'count' }).catch(() => undefined),
      queryStatisticsForQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], { filter, unit: 'kcal' }).catch(
        () => undefined,
      ),
      queryStatisticsForQuantity('HKQuantityTypeIdentifierRestingHeartRate', ['discreteAverage'], { filter, unit: 'count/min' }).catch(
        () => undefined,
      ),
      queryStatisticsForQuantity('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', ['discreteAverage'], { filter, unit: 'ms' }).catch(
        () => undefined,
      ),
    ]);
    out.push({
      date: todayKey(start),
      steps: round(steps?.sumQuantity?.quantity),
      activeKcal: round(energy?.sumQuantity?.quantity),
      restingHr: round(rhr?.averageQuantity?.quantity),
      hrvMs: round(hrv?.averageQuantity?.quantity),
      sleepHours: await sleepEndingOn(start),
      source: 'apple_health',
    });
  }
  return out;
}

/** Sleep for the night that ends on `day` (6pm previous day → 6pm `day`). */
async function sleepEndingOn(day: Date): Promise<number | undefined> {
  const startDate = new Date(day);
  startDate.setHours(-6, 0, 0, 0);
  const endDate = new Date(day);
  endDate.setHours(18, 0, 0, 0);
  try {
    const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 0,
      filter: { date: { startDate, endDate } },
    });
    const asleep = new Set<number>([
      CategoryValueSleepAnalysis.asleepUnspecified,
      CategoryValueSleepAnalysis.asleepCore,
      CategoryValueSleepAnalysis.asleepDeep,
      CategoryValueSleepAnalysis.asleepREM,
    ]);
    // Multiple sources (e.g. RingConn + iPhone) can overlap — merge intervals before summing.
    const intervals = samples
      .filter((s) => asleep.has(s.value as number))
      .map((s) => [+new Date(s.startDate), +new Date(s.endDate)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let total = 0;
    let cur: [number, number] | undefined;
    for (const iv of intervals) {
      if (!cur || iv[0] > cur[1]) {
        if (cur) total += cur[1] - cur[0];
        cur = [...iv];
      } else cur[1] = Math.max(cur[1], iv[1]);
    }
    if (cur) total += cur[1] - cur[0];
    return total > 0 ? Math.round((total / 3_600_000) * 10) / 10 : undefined;
  } catch {
    return undefined;
  }
}

export async function latestBodyFromAppleHealth() {
  const [mass, fat, height] = await Promise.all([
    getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg').catch(() => undefined),
    getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyFatPercentage', '%').catch(() => undefined),
    getMostRecentQuantitySample('HKQuantityTypeIdentifierHeight', 'cm').catch(() => undefined),
  ]);
  return {
    weightKg: mass?.quantity,
    weightDate: mass ? todayKey(new Date(mass.startDate)) : undefined,
    bodyFatPct: fat ? fat.quantity * 100 : undefined,
    heightCm: height?.quantity,
  };
}

const round = (n?: number) => (n == null ? undefined : Math.round(n));
