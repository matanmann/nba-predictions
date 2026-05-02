export const ROUND_MULTIPLIERS = [1, 2, 4, 8];

export interface SeriesResult {
  winnerId: string;
  gameCount: number;
  leadingScorer: string;
  round: number;
}

export interface SeriesPred {
  winnerId: string;
  gameCount: number;
  leadingScorer: string;
}

export interface SeriesScore {
  winnerScore: number;
  gamesScore: number;
  scorerScore: number;
  bonusApplied: boolean;
  total: number;
}

export function scoreSeriesPrediction(
  pred: SeriesPred,
  result: SeriesResult
): SeriesScore {
  const m = ROUND_MULTIPLIERS[result.round - 1] ?? 1;

  const wOk = pred.winnerId === result.winnerId;
  const gOk = pred.gameCount === result.gameCount;
  const sOk = normalizePlayerName(pred.leadingScorer) === normalizePlayerName(result.leadingScorer);

  const winnerScore = wOk ? 3 * m : 0;
  const gamesScore  = wOk && gOk ? 2 * m : 0;
  const scorerScore = sOk ? 1 * m : 0;
  const rawTotal    = winnerScore + gamesScore + scorerScore;

  const allCorrect = wOk && gOk && sOk;
  // Use Math.floor for deterministic integer scores
  const total = allCorrect ? Math.floor(rawTotal * 1.5) : rawTotal;

  return { winnerScore, gamesScore, scorerScore, bonusApplied: allCorrect, total };
}

export function scoreLeader(predicted: string, actual: string): number {
  return normalizePlayerName(predicted) === normalizePlayerName(actual) ? 12 : 0;
}

export function scoreGeneral(
  predicted: Record<string, number>,
  actual: Record<string, number>
): { perQuestion: Record<string, number>; total: number } {
  const perQuestion: Record<string, number> = {};
  let total = 0;
  for (const key of Object.keys(actual)) {
    const pts = predicted[key] === actual[key] ? 6 : 0;
    perQuestion[key] = pts;
    total += pts;
  }
  return { perQuestion, total };
}

export function scoreSnacks(
  predicted: boolean[],
  actual: (boolean | null)[]
): number[] {
  return predicted.map((a, i) => {
    if (actual[i] === null || actual[i] === undefined) return 0;
    return a === actual[i] ? 2 : 0;
  });
}

// Normalize player names to handle casing/whitespace differences
function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}