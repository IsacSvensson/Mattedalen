import type { ContentPack } from '../engine';
import type { Profile } from '../storage';
import type { AppContext } from './app';
import type { IconName } from './components/icons';

/** A change to a child's profile, saved from the parent view. */
export type ProfileChange = Partial<Omit<Profile, 'settings'>> & { settings?: Partial<Profile['settings']> };
export type SaveProfile = (change: ProfileChange) => Promise<void>;

/**
 * A place's scene in the valley for one child (docs/PLAN-DALEN.md): the place
 * as it is, with what the child is on now and the place's own button.
 */
export interface PlaceScene {
  /** Today's state, e.g. `thirsty`; used as the class `mood-…`. */
  mood: string;
  /** Today's state in words, shown and read aloud. */
  moodText: string;
  moodIcon: Element;
  /** The place as it is: the bridge, the path with its lanterns or the bed. Never a control. */
  art: HTMLElement;
  /** The picture in words, for screen readers. */
  artText: string | null;
  /** What the child is on now, e.g. "Nu: Tiokamrater", or what waits. */
  line: HTMLElement | null;
  /** Icon on the name, e.g. a moon while the place rests. */
  nameIcon: Element | null;
  /** Whole areas known: one sunflower each on the hill. */
  sunflowers: number;
  /** The same in words, for screen readers. */
  landscapeText: string | null;
  /** What the day's session is called in "I dag", e.g. "Vattna trädgården". */
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
  /** Starts the day's session there, with the start check or the check first when it is time ("I dag"). */
  start(ctx: AppContext, profile: Profile): Promise<void>;
  /** The place's scene in the valley. */
  scene(ctx: AppContext, profile: Profile): Promise<PlaceScene>;
  /**
   * Whether the place is open to this child. A place that is not open yet
   * rests in the valley, with `closedText` saying when it opens. Without this,
   * the place is always open.
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
