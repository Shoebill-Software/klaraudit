export type ScoreBand = 'green' | 'yellow' | 'red';

/** Scores at or above this threshold render green. */
export const SCORE_GREEN_MIN = 80;

/** Scores at or above this threshold (and below green) render yellow. */
export const SCORE_YELLOW_MIN = 50;

export function scoreBand(score: number): ScoreBand {
  if (score >= SCORE_GREEN_MIN) {
    return 'green';
  }
  if (score >= SCORE_YELLOW_MIN) {
    return 'yellow';
  }
  return 'red';
}

export function scoreLabel(band: ScoreBand): string {
  switch (band) {
    case 'green':
      return 'Pass';
    case 'yellow':
      return 'Needs attention';
    case 'red':
      return 'Fail';
  }
}
