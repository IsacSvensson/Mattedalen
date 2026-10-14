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
  /** What a new child meets first in this place, if anything (e.g. the start check). */
  welcome?(ctx: AppContext, profile: Profile): void;
  /** The place's part of the parent view for one child. */
  parentSection(ctx: AppContext, profile: Profile, save: SaveProfile): Promise<HTMLElement>;
}
