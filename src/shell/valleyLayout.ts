/**
 * Where everything stands on the valley's map (docs/PLAN-DALEN.md), in the
 * map's own units. The brook and the path of stepping stones join the places,
 * so the layout belongs to the valley, not to the places. A place without a
 * spot here is not drawn.
 */

/** The map's size: larger than a phone, so it is dragged around; a wide screen shows all of it. */
export const MAP_W = 1100;
export const MAP_H = 1090;
/** The band of sky and hills at the top. */
export const SKY_H = 130;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Spot {
  /** The place's picture: its top left corner, and its width when the picture scales. */
  art: { x: number; y: number; w?: number };
  /** The sign (and the child's animal beside it). */
  sign: { x: number; y: number };
  /** Today's state and what the child is on now. */
  notes: { x: number; y: number };
  /** All of the place: what should be on screen when the map shows it. */
  box: Box;
  /** Where to look when the place is wider than the screen: its sign and the nearest part of its picture. */
  focusX: number;
}

export const SPOTS: Record<string, Spot> = {
  // The arch over the brook, high up where the brook comes out of the hills; the sign on the bank.
  backen: { art: { x: 100, y: 168, w: 300 }, sign: { x: 412, y: 196 }, notes: { x: 412, y: 250 }, box: { x: 90, y: 160, w: 640, h: 180 }, focusX: 530 },
  // The posts and lanterns along the far bank.
  stigen: { art: { x: 610, y: 400, w: 460 }, sign: { x: 700, y: 560 }, notes: { x: 700, y: 614 }, box: { x: 600, y: 390, w: 470, h: 290 }, focusX: 780 },
  // The whole bed on this side of the brook.
  tradgarden: { art: { x: 40, y: 470 }, sign: { x: 40, y: 396 }, notes: { x: 40, y: 965 }, box: { x: 30, y: 390, w: 520, h: 690 }, focusX: 180 },
};

/**
 * The brook's middle line, for a map `height` units tall: from behind the
 * hills, under the arch, across the meadow and down between the garden and
 * Stigen, to the map's foot.
 */
export const brook = (height: number) =>
  `M420 112 C 400 150, 268 190, 252 246 C 250 256, 250 262, 250 268 C 252 330, 520 300, 560 400 S 560 700, 575 ${height + 20}`;
/** How far along the middle line the bridge stands: the brook is narrow before it, full width after. */
export const BROOK_AT_BRIDGE = 190;

/** The path of stepping stones: from the bridge to Stigen, and over a ford to the garden. */
export const STONE_PATHS = ['M440 330 C 520 350, 600 370, 650 420', 'M760 680 C 720 730, 640 700, 560 640 S 460 560, 380 545'];

/** The free corners: a pond, trees and tufts, so the valley is a place and not a menu. */
export const POND = { cx: 900, cy: 860, rx: 120, ry: 60 };
export const TREES: [number, number][] = [
  [960, 200],
  [1030, 260],
  [760, 860],
  [700, 960],
];
export const TUFTS: [number, number][] = [
  [850, 240],
  [480, 960],
  [960, 690],
  [300, 330],
  [1050, 980],
];
