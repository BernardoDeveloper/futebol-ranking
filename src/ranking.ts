/** One line of the ranking, as returned by the database's ranking() function. */
export interface RankingRow {
  player_id: string;
  name: string;
  /** Average rating rounded to one decimal; null when nobody has rated the player. */
  average: number | string | null;
  ratings_count: number;
}

export const NO_RATING = 'sem nota';

export function formatAverage(average: RankingRow['average']): string {
  if (average === null) return NO_RATING;
  const value = Number(average);
  return Number.isFinite(value) ? value.toFixed(1) : NO_RATING;
}

/** Opens the "Copiar" text, so it can be pasted straight into an AI chat that splits the teams. */
export const COPY_PROMPT = 'Baseado nessa lista monte um time dividido, deixando balanceado conforme a pontuação';

/**
 * The text "Copiar" puts on the clipboard: the prompt, a blank line, then
 * `<name> - <average rating>`, one line per player, in ranking order.
 */
export function rankingText(rows: readonly RankingRow[]): string {
  const lines = rows.map((row) => `${row.name} - ${formatAverage(row.average)}`);
  return [COPY_PROMPT, '', ...lines].join('\n');
}
