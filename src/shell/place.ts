import type { ContentPack } from '../engine';
import type { Profile } from '../storage';
import type { AppContext } from './app';
import type { IconName } from './components/icons';

/** A change to a child's profile, saved from the parent view. */
export type ProfileChange = Partial<Omit<Profile, 'settings'>> & { settings?: Partial<Profile['settings']> };
export type SaveProfile = (change: ProfileChange) => Promise<void>;

/** How a place looks on the valley map for one child. */
export interface PlaceOnMap {
  /** Class of the place's spot on the map, e.g. `place-garden`. */
  spot: string;
  /** Today's state, e.g. `thirsty`; used as the class `mood-…`. */
  mood: string;
  /** Today's state in words, shown and read aloud. */
  moodText: string;
  moodIcon: Element;
  /** What grows or is built there: the child's knowledge. */
  art: HTMLElement;
  /** Icon on the name, e.g. a moon while the place rests. */
  nameIcon: Element | null;
  /** Whole areas known: one sunflower each on the hill. */
  sunflowers: number;
  /** The same in words, for screen readers. */
  landscapeText: string | null;
  /** The main button to the place, e.g. "Gå till trädgården". */
  go: { label: string; icon: IconName };
  /** Items due for review today: the day's time is shared after this. */
  due: number;
}

/**
 * A place in the valley: a content pack and its screens. The shell (profiles,
 * the valley, the parent view, storage) is shared by every place.
 */
export interface Place {
  id: string;
  name: string;
  pack: ContentPack;
  /** The place's own screen. */
  open(ctx: AppContext, profile: Profile): Promise<void>;
  onMap(ctx: AppContext, profile: Profile): Promise<PlaceOnMap>;
  /**
   * Whether the place is open to this child. A place that is not open yet is
   * drawn resting on the map, with `closedText` saying when it opens. Without
   * this, the place is always open.
   */
  isOpen?(ctx: AppContext, profile: Profile): Promise<boolean>;
  /** When a closed place opens, in words for the child, e.g. "Trädgården öppnar när …". */
  closedText?: string;
  /** The place's part of the parent view for one child. */
  parentSection(ctx: AppContext, profile: Profile, save: SaveProfile): Promise<HTMLElement>;
}

/** Whether a place is open to a child (a place without a rule always is). */
export function placeIsOpen(place: Place, ctx: AppContext, profile: Profile): Promise<boolean> {
  return place.isOpen ? place.isOpen(ctx, profile) : Promise.resolve(true);
}
