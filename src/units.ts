// All data is stored in metric (kg, cm). These helpers convert for display/input.
export type Units = 'us' | 'metric';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

export const weightLabel = (u: Units) => (u === 'us' ? 'lb' : 'kg');

/** kg -> number in the user's units, rounded for display. */
export function displayWeight(kg: number | undefined, u: Units, digits = 1): string {
  if (kg == null || Number.isNaN(kg)) return '—';
  const v = u === 'us' ? kgToLb(kg) : kg;
  return trim(v.toFixed(digits));
}

/** Parse a value the user typed in their units back to kg. */
export function inputToKg(value: string, u: Units): number | undefined {
  const n = parseFloat(value.replace(',', '.'));
  if (Number.isNaN(n)) return undefined;
  return u === 'us' ? lbToKg(n) : n;
}

export function kgToInput(kg: number | undefined, u: Units): string {
  if (kg == null) return '';
  return displayWeight(kg, u);
}

export function displayHeight(cm: number | undefined, u: Units): string {
  if (!cm) return '—';
  if (u === 'metric') return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / CM_PER_IN);
  return `${Math.floor(totalIn / 12)}′${totalIn % 12}″`;
}

export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * CM_PER_IN;
export function cmToFtIn(cm: number) {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}

function trim(s: string) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
