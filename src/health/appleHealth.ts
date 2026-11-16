// Fallback for web/Android — Apple Health only exists on iPhone.
import type { HealthDay } from '../store';

export const appleHealthSupported = false;
export async function connectAppleHealth(): Promise<boolean> {
  return false;
}
export async function fetchAppleHealthDays(_days = 7): Promise<HealthDay[]> {
  return [];
}
export async function latestBodyFromAppleHealth(): Promise<{
  weightKg?: number;
  weightDate?: string;
  bodyFatPct?: number;
  heightCm?: number;
}> {
  return {};
}
