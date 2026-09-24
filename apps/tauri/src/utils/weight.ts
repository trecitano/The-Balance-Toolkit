/**
 * User weight is stored in kilograms everywhere (core, persistence, session baseline).
 * `weightMetric` is only a display preference; these helpers convert at the UI edge.
 */
const LB_PER_KG = 2.2046226218;

export const kgToUnit = (kg: number, unit: string): number => (unit === "lb" ? kg * LB_PER_KG : kg);

export const unitToKg = (value: number, unit: string): number => (unit === "lb" ? value / LB_PER_KG : value);

/** Text shown in an input for a stored kilogram value, or "" when unset. */
export const formatWeight = (kg: number | null | undefined, unit: string): string =>
  kg == null ? "" : String(Number(kgToUnit(kg, unit).toFixed(2)));
