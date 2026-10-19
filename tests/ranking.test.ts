import { describe, expect, it } from 'vitest';
import { COPY_PROMPT, formatAverage, NO_RATING, rankingText, type RankingRow } from '../src/ranking';

describe('formatAverage (R4.1)', () => {
  it('shows one decimal', () => {
    expect(formatAverage(8.7)).toBe('8.7');
    expect(formatAverage(7)).toBe('7.0');
  });

  it('accepts the numeric the database may send as text', () => {
    expect(formatAverage('7.5')).toBe('7.5');
  });

  it('marks a player nobody has rated', () => {
    expect(formatAverage(null)).toBe(NO_RATING);
  });
});

describe('rankingText (R4.2)', () => {
  const row = (name: string, average: RankingRow['average'], ratings_count: number): RankingRow => ({
    player_id: name,
    name,
    average,
    ratings_count,
  });

  it('opens with the team-split prompt and a blank line, then one "<name> - <average rating>" line per player in ranking order', () => {
    const rows = [row('Ana', 8.7, 3), row('Bruno', 7.5, 2), row('Caio', null, 0)];
    expect(rankingText(rows)).toBe(
      `Baseado nessa lista monte um time dividido, deixando balanceado conforme a pontuação\n\nAna - 8.7\nBruno - 7.5\nCaio - ${NO_RATING}`,
    );
  });

  it('is only the prompt for an empty list', () => {
    expect(rankingText([])).toBe(`${COPY_PROMPT}\n`);
  });
});
