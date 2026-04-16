export interface LockConfig {
  year: number;
  firstTipoff: Date;
  lockMinutesBefore: number;
}

const LOCK_CONFIGS: LockConfig[] = [
  {
    year: 2026,
    firstTipoff: new Date("2026-04-18T17:00:00Z"),
    lockMinutesBefore: 5,
  },
];

// Utility functions for localStorage prediction persistence
export function savePredictionsToLocalStorage(year: number, predictions: any) {
  try {
    localStorage.setItem(`predictions_${year}`, JSON.stringify(predictions));
  } catch (e) {
    console.warn("Failed to save predictions to localStorage", e);
  }
}

export function loadPredictionsFromLocalStorage(year: number): any | null {
  try {
    const stored = localStorage.getItem(`predictions_${year}`);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn("Failed to load predictions from localStorage", e);
    return null;
  }
}

export function clearPredictionsFromLocalStorage(year: number) {
  try {
    localStorage.removeItem(`predictions_${year}`);
  } catch (e) {
    console.warn("Failed to clear predictions from localStorage", e);
  }
}

export function getLockConfig(year: number): LockConfig {
  const cfg = LOCK_CONFIGS.find((c) => c.year === year);
  if (!cfg) throw new Error(`No lock config for season ${year}`);
  return cfg;
}

export function getLockTime(year: number): Date {
  const { firstTipoff, lockMinutesBefore } = getLockConfig(year);
  return new Date(firstTipoff.getTime() - lockMinutesBefore * 60 * 1000);
}

export function isLocked(year: number): boolean {
  return new Date() >= getLockTime(year);
}

export function secondsUntilLock(year: number): number {
  return Math.max(
    0,
    Math.floor((getLockTime(year).getTime() - Date.now()) / 1000)
  );
}