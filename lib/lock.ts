export interface LockConfig {
  year: number;
  firstTipoff: Date;
  lockMinutesBefore: number;
}

const LOCK_CONFIGS: LockConfig[] = [
  {
    year: 2026,
    firstTipoff: new Date("2026-04-18T20:00:00Z"),
    lockMinutesBefore: 5,
  },
];

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