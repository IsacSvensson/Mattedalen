import { h, prefersReducedMotion, s } from '../dom';
import type { PlaceScene } from '../place';
import { brook, BROOK_AT_BRIDGE, MAP_H, MAP_W, POND, SKY_H, SPOTS, STONE_PATHS, TREES, TUFTS, type Box } from '../valleyLayout';
import { scene } from './scene';

/**
 * The valley as a map that fills the screen (docs/PLAN-DALEN.md). Every place
 * stands at full size where `valleyLayout.ts` puts it. On a phone the map is
 * larger than the screen and is dragged around, in every direction, without
 * zoom; pointers at the edge lead to the places out of view. A screen with room
 * for the whole valley shows all of it, scaled to fit, with the sky and the
 * meadow out to its edges. The page itself never scrolls: the map pans inside
 * its own view.
 */
export interface MapPlace {
  id: string;
  name: string;
  open: boolean;
  scene: PlaceScene;
  go: () => void;
}

export interface ValleyMap {
  el: HTMLElement;
  /** Call once the map is on the page: it lays out and shows the start place. */
  mount(): void;
  cleanup(): void;
}

/** The map fits when it can be shown at this share of its size or more. */
export const FIT_AT = 0.7;
/** Kept clear of pointers: the title and the corner buttons at the top, a margin at the bottom. */
const CLEAR_TOP = 84;
const CLEAR_BOTTOM = 60;
const EDGE = 8;

/**
 * `start`: today's place, where the map opens and the child's animal (`guide`)
 * stands. `sunflowers`: one on the hills per table the child knows.
 */
export function valleyMap(places: MapPlace[], opts: { start: string; guide: Element; sunflowers: number }): ValleyMap {
  const shown = places.filter((p) => SPOTS[p.id]);
  const land = s('svg', { class: 'map-land', 'aria-hidden': 'true' });
  // A drag that moved the map is not a tap on what it started on.
  let dragged = false;
  const go = (p: MapPlace) => () => {
    if (!dragged && p.open) p.go();
  };

  const items = shown.map((p) => {
    const spot = SPOTS[p.id]!;
    const { scene: sc } = p;
    const sign = h(
      'button',
      {
        class: 'place-name map-sign',
        id: `map-${p.id}`,
        type: 'button',
        'aria-label': `${p.name}. ${sc.moodText}`,
        // A place that has not opened yet rests on the map; its line says when it opens.
        disabled: !p.open,
        onclick: go(p),
      },
      sc.nameIcon,
      p.name,
    );
    const art = h('div', { class: 'map-art', 'aria-hidden': 'true', onclick: go(p) }, sc.art);
    const signRow = h('div', { class: 'map-sign-row' }, p.id === opts.start ? h('span', { class: 'map-guide', 'aria-hidden': 'true' }, opts.guide) : null, sign);
    const notes = h('div', { class: 'map-notes' }, h('p', { class: 'place-status map-pill' }, sc.moodIcon, h('span', null, sc.moodText)), sc.line);
    place(art, spot.art.x, spot.art.y);
    if (spot.art.w) art.style.width = `${spot.art.w}px`;
    place(signRow, spot.sign.x, spot.sign.y);
    place(notes, spot.notes.x, spot.notes.y);
    return h(
      'li',
      { class: `map-place mood-${sc.mood}${p.open ? '' : ' closed'}${p.id === opts.start ? ' here' : ''}`, dataset: { place: p.id } },
      art,
      signRow,
      sc.artText ? h('p', { class: 'sr-only' }, sc.artText) : null,
      notes,
    );
  });

  const content = h('div', { class: 'map-content' }, land, h('ol', { class: 'map-places', 'aria-label': 'Platserna i dalen' }, items));
  const world = h('div', { class: 'map-world' }, scene({ height: SKY_H, sunflowers: opts.sunflowers, cloud: true }), content);
  const sizer = h('div', { class: 'map-sizer' }, world);
  const view = h('div', { class: 'map-view' }, sizer);
  // A shortcut for those who see; the list of places is the way for a screen reader.
  const pointers = h('div', { class: 'map-pointers', 'aria-hidden': 'true' });
  const el = h('div', { class: 'valley-map' }, view, pointers);

  let fits = false;
  let scale = 1;
  // The place nearest the middle of the screen: the map stays there when the screen turns.
  let at = opts.start;

  const boxOf = (id: string): Box => SPOTS[id]!.box;
  /** Where the view should be to show a place: all of it if it fits, else its sign and the nearest part of its picture, from the top. */
  const viewFor = (id: string) => {
    const b = boxOf(id);
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    return {
      left: b.w + 32 > vw ? SPOTS[id]!.focusX - vw / 2 : b.x + b.w / 2 - vw / 2,
      // Room above the place for pointers to the places beyond the top.
      top: b.h + CLEAR_TOP + 16 > vh ? b.y - CLEAR_TOP - 52 : b.y + b.h / 2 - vh / 2,
    };
  };
  // While the map moves by itself (to a place, or after a resize), the place it passes is not where the child is.
  let byItself = false;
  const show = (id: string, smooth: boolean) => {
    at = id;
    if (fits) return;
    byItself = true;
    view.scrollTo({ ...viewFor(id), behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
  };
  // The child moves the map: from now on the place nearest the middle is where they are.
  const byChild = () => {
    byItself = false;
  };
  for (const type of ['pointerdown', 'wheel', 'touchstart'] as const) view.addEventListener(type, byChild, { passive: true });

  function layout() {
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const k = Math.min(vw / MAP_W, vh / MAP_H);
    fits = k >= FIT_AT;
    scale = fits ? Math.min(k, 1.15) : 1;
    // Wider or taller than the valley: the sky and the meadow go on to the screen's edges, the places stay in the middle.
    const ww = fits ? Math.max(MAP_W, vw / scale) : MAP_W;
    const hh = fits ? Math.max(MAP_H, vh / scale) : MAP_H;
    el.classList.toggle('fits', fits);
    world.style.width = `${ww}px`;
    world.style.height = `${hh}px`;
    world.style.transform = scale === 1 ? '' : `scale(${scale})`;
    content.style.left = `${(ww - MAP_W) / 2}px`;
    sizer.style.width = `${ww * scale}px`;
    sizer.style.height = `${hh * scale}px`;
    drawLand(land, hh);
    show(at, false);
    updatePointers();
  }

  function updatePointers() {
    if (fits) {
      pointers.replaceChildren();
      return;
    }
    const vx = view.scrollLeft;
    const vy = view.scrollTop;
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const away = shown.filter((p) => {
      const b = boxOf(p.id);
      return b.x + b.w < vx + 40 || b.x > vx + vw - 40 || b.y + b.h < vy + 90 || b.y > vy + vh - 40;
    });
    const chips = away.map((p) => {
      const b = boxOf(p.id);
      const cx = b.x + b.w / 2 - vx;
      const cy = b.y + b.h / 2 - vy;
      // The edge the place lies furthest beyond.
      const over = { left: -cx, right: cx - vw, up: CLEAR_TOP - cy, down: cy - vh };
      const dir = (Object.keys(over) as (keyof typeof over)[]).reduce((a, c) => (over[c] > over[a] ? c : a));
      const chip = h(
        'button',
        { class: `map-pointer ${dir}`, type: 'button', tabindex: -1, onclick: () => show(p.id, true) },
        h('span', { class: 'map-pointer-arrow' }, ARROWS[dir]),
        p.scene.moodIcon.cloneNode(true) as Element,
        p.name,
      );
      return { chip, dir, cx, cy };
    });
    pointers.replaceChildren(...chips.map((c) => c.chip));
    // Measured, then placed at their edge as near their place as the others allow: never on top of each other.
    const placed: Box[] = [];
    const hit = (b: Box) => placed.find((o) => b.x < o.x + o.w + 6 && o.x < b.x + b.w + 6 && b.y < o.y + o.h + 6 && o.y < b.y + b.h + 6);
    const bottom = vh - CLEAR_BOTTOM;
    for (const c of chips) {
      const w = c.chip.offsetWidth;
      const ht = c.chip.offsetHeight;
      const side = c.dir === 'left' || c.dir === 'right';
      const b: Box = side
        ? { x: c.dir === 'left' ? EDGE : vw - EDGE - w, y: clamp(c.cy - ht / 2, CLEAR_TOP, bottom - ht), w, h: ht }
        : { x: clamp(c.cx - w / 2, EDGE, vw - EDGE - w), y: c.dir === 'up' ? CLEAR_TOP : bottom - ht, w, h: ht };
      // Slide along the edge until free: onwards if there is room, else back.
      for (let i = 0, o = hit(b); o && i < 20; i++, o = hit(b)) {
        if (side) b.y = b.y + b.h / 2 >= o.y + o.h / 2 && o.y + o.h + 6 + b.h <= bottom ? o.y + o.h + 6 : o.y - b.h - 6;
        else b.x = b.x + b.w / 2 >= o.x + o.w / 2 && o.x + o.w + 6 + b.w <= vw - EDGE ? o.x + o.w + 6 : o.x - b.w - 6;
      }
      placed.push(b);
      c.chip.style.left = `${Math.round(b.x)}px`;
      c.chip.style.top = `${Math.round(b.y)}px`;
    }
  }

  let frame = 0;
  const onScroll = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      updatePointers();
      if (byItself) return;
      const mx = view.scrollLeft + view.clientWidth / 2;
      const my = view.scrollTop + view.clientHeight / 2;
      const dist = (b: Box) => Math.hypot(b.x + b.w / 2 - mx, b.y + b.h / 2 - my);
      at = [...shown].sort((a, b) => dist(boxOf(a.id)) - dist(boxOf(b.id)))[0]?.id ?? at;
    });
  };
  view.addEventListener('scroll', onScroll, { passive: true });

  // A mouse drags the map as a finger does.
  let drag: { x: number; y: number; left: number; top: number } | null = null;
  view.addEventListener('pointerdown', (e) => {
    dragged = false;
    if (e.pointerType !== 'mouse' || e.button !== 0 || fits) return;
    drag = { x: e.clientX, y: e.clientY, left: view.scrollLeft, top: view.scrollTop };
  });
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) dragged = true;
    view.scrollLeft = drag.left - dx;
    view.scrollTop = drag.top - dy;
  };
  const onUp = () => {
    drag = null;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  // The arrow keys move the map.
  const onKey = (e: KeyboardEvent) => {
    if (fits || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step) return;
    e.preventDefault();
    byChild();
    view.scrollBy({ left: step[0]! * 120, top: step[1]! * 120, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  document.addEventListener('keydown', onKey);

  // A turned phone or a resized window: lay out again, at the same place. The
  // window's own event too: two quick changes that end at the same size are
  // one or none for the observer, while the browser has moved the map between them.
  let laidOut = 0;
  const relayout = () => {
    cancelAnimationFrame(laidOut);
    laidOut = requestAnimationFrame(() => layout());
  };
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(relayout) : null;
  window.addEventListener('resize', relayout);

  return {
    el,
    mount() {
      layout();
      resized?.observe(view);
    },
    cleanup() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(laidOut);
      window.removeEventListener('resize', relayout);
      resized?.disconnect();
    },
  };
}

const ARROWS = { left: '←', right: '→', up: '↑', down: '↓' } as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function place(el: HTMLElement, x: number, y: number): void {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

/** The brook, the stepping stones, the pond, trees and tufts, for a map `height` units tall. */
function drawLand(svg: SVGSVGElement, height: number): void {
  svg.setAttribute('viewBox', `0 0 ${MAP_W} ${height}`);
  svg.setAttribute('width', String(MAP_W));
  svg.setAttribute('height', String(height));
  let markup =
    water(svg, brook(height)) +
    `<ellipse class="map-pond" cx="${POND.cx}" cy="${POND.cy}" rx="${POND.rx}" ry="${POND.ry}"/>` +
    TREES.map(([x, y]) => `<g class="map-tree" transform="translate(${x} ${y})"><rect x="-5" y="0" width="10" height="26" rx="3"/><circle cx="0" cy="-12" r="26"/></g>`).join('') +
    TUFTS.map(([x, y]) => `<path class="map-tuft" transform="translate(${x} ${y})" d="M-6 0 Q-4 -10 -2 0 M0 0 Q1 -13 3 0 M4 0 Q7 -9 8 0"/>`).join('');
  svg.innerHTML = markup;
  // Stepping stones along the path, each a little different, the same every time.
  markup = '';
  for (const d of STONE_PATHS) {
    const path = s('path', { d }) as SVGPathElement;
    svg.append(path);
    const length = path.getTotalLength?.() ?? 0;
    let n = 0;
    for (let t = 8; t < length; t += 24, n++) {
      const p = path.getPointAtLength(t);
      const k = STONE_SIZE[n % STONE_SIZE.length]!;
      markup += `<ellipse class="map-stone" cx="${(p.x + ((n % 3) - 1) * 4).toFixed(1)}" cy="${p.y.toFixed(1)}" rx="${(8 * k).toFixed(1)}" ry="${(5.5 * k).toFixed(1)}" transform="rotate(${((n * 37) % 60) - 30} ${p.x.toFixed(1)} ${p.y.toFixed(1)})"/>`;
    }
    path.remove();
  }
  svg.insertAdjacentHTML('beforeend', markup);
}

/**
 * The brook as water with a darker edge, narrow far away behind the hills and
 * wider as it comes closer, full width from the bridge on (as on the old map).
 */
function water(svg: SVGSVGElement, d: string): string {
  const path = s('path', { d }) as SVGPathElement;
  svg.append(path);
  const length = path.getTotalLength?.() ?? 0;
  const left: string[] = [];
  const right: string[] = [];
  const middle: string[] = [];
  for (let t = 0; t <= length; t += 6) {
    const p = path.getPointAtLength(t);
    // The glint only where the brook is wide, from the bridge on.
    if (t > BROOK_AT_BRIDGE + 20) middle.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    const q = path.getPointAtLength(Math.min(length, t + 1));
    const r = path.getPointAtLength(Math.max(0, t - 1));
    const tx = q.x - r.x;
    const ty = q.y - r.y;
    const len = Math.hypot(tx, ty) || 1;
    const half = (10 + 26 * Math.min(1, t / BROOK_AT_BRIDGE) ** 0.75) / 2;
    left.push(`${(p.x - (ty / len) * half).toFixed(1)} ${(p.y + (tx / len) * half).toFixed(1)}`);
    right.push(`${(p.x + (ty / len) * half).toFixed(1)} ${(p.y - (tx / len) * half).toFixed(1)}`);
  }
  path.remove();
  if (!left.length) return '';
  return `<path class="map-water" d="M${left.join(' L')} L${right.reverse().join(' L')} Z"/>` + (middle.length > 1 ? `<path class="map-glint" d="M${middle.join(' L')}"/>` : '');
}

/** Sizes of the stones, repeated along the path: uneven, but the same every time. */
const STONE_SIZE = [1, 0.8, 1.1, 0.9, 0.75];
