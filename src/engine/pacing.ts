import type { EngineConfig } from './types';

/**
 * Keeps the share of correct answers inside the target band (80–90 %) by
 * adjusting how many known items are asked between two new ones. Too easy →
 * new items come sooner; too hard → new items wait and the gap grows.
 */
export class PacingController {
  private recent: boolean[] = [];
  private sinceAdjust = 0;
  gap: number;

  constructor(
    private readonly cfg: EngineConfig['pacing'],
    initialGap: number,
  ) {
    this.gap = clamp(Math.round(initialGap), cfg.minGap, cfg.maxGap);
  }

  /** Rolling accuracy, or null while there is too little data. */
  accuracy(): number | null {
    if (this.recent.length < Math.min(4, this.cfg.window)) return null;
    return this.recent.filter(Boolean).length / this.recent.length;
  }

  /** New items are held back while the learner is below the target band. */
  allowNew(): boolean {
    const acc = this.accuracy();
    return acc === null || acc >= this.cfg.targetLow;
  }

  record(correct: boolean): void {
    this.recent.push(correct);
    if (this.recent.length > this.cfg.window) this.recent.shift();
    this.sinceAdjust++;
    // Adjust only on a full window, at most every half window.
    const acc = this.accuracy();
    if (acc === null || this.recent.length < this.cfg.window || this.sinceAdjust < Math.ceil(this.cfg.window / 2)) return;
    if (acc > this.cfg.targetHigh) {
      this.gap = clamp(this.gap - 1, this.cfg.minGap, this.cfg.maxGap);
      this.sinceAdjust = 0;
    } else if (acc < this.cfg.targetLow) {
      this.gap = clamp(this.gap + 2, this.cfg.minGap, this.cfg.maxGap);
      this.sinceAdjust = 0;
    }
  }
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
