import type { ItemId } from '../../engine';
import { isDivisionId, isFactId, parseDivisionId, parseFactId } from '../../content/multiplication';
import type { HelpPicture, ProfileSettings } from '../../storage';

/**
 * The pictures on the garden's help card after a wrong answer
 * (docs/PLAN-KLOCKAN.md, ST): the rectangle always, then the supports that
 * fit the item. They take turns, one each time the child meets the item.
 */
export type GardenPicture = 'array' | HelpPicture;

/** Where the minute hand stands for the clock: the factor beside 5, or the answer of a division by 5. */
export function clockPosition(id: ItemId): number | null {
  if (isFactId(id)) {
    const { a, b } = parseFactId(id);
    if (b === 5) return a;
    if (a === 5) return b;
    return null;
  }
  if (isDivisionId(id)) {
    const { divisor, quotient } = parseDivisionId(id);
    return divisor === 5 ? quotient : null;
  }
  return null;
}

/** The item's pictures, without the ones a grown-up has turned off. */
export function picturesFor(id: ItemId, settings: Pick<ProfileSettings, 'helpPicturesOff'>): GardenPicture[] {
  const off = new Set(settings.helpPicturesOff ?? []);
  const out: GardenPicture[] = ['array'];
  if (!off.has('clock') && clockPosition(id) !== null) out.push('clock');
  return out;
}

/** This time's picture: the next one each time the child meets the item (`seen`). */
export function pictureFor(id: ItemId, seen: number, settings: Pick<ProfileSettings, 'helpPicturesOff'>): GardenPicture {
  const all = picturesFor(id, settings);
  return all[seen % all.length] ?? 'array';
}

/** The clock's line: "Minutvisaren på 7 är 35 minuter. 7 × 5 = 35." (`÷` is the child's sign later). */
export function clockLine(id: ItemId): string | null {
  const at = clockPosition(id);
  if (at === null) return null;
  if (isDivisionId(id)) return `${at * 5} minuter: minutvisaren står på ${at}. ${at * 5} ÷ 5 = ${at}.`;
  const { a, b } = parseFactId(id);
  return `Minutvisaren på ${at} är ${at * 5} minuter. ${a} × ${b} = ${a * b}.`;
}
