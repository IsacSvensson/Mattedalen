import { h, prefersReducedMotion, s } from '../dom';
import type { PlaceScene } from '../place';
import { brook, BROOK_AT_BRIDGE, MAP_H, MAP_W, POND, SKY_H, SPOTS, STONE_PATHS, TREES, TUFTS, type Box } from '../valleyLayout';
import { icon } from './icons';
import { scene } from './scene';

/**
 * The valley as a map that fills the screen (docs/PLAN-DALEN.md). Every place
 * stands at full size where `valleyLayout.ts` puts it. On a phone the map is
 * larger than the screen and is dragged around, in every direction; pointers at
 * the edge lead to the places out of view. Two fingers (or the button in the
 * corner) zoom out to the whole valley and back, never closer than full size.
 * A screen with room for the whole valley shows all of it, scaled to fit, with
 * the sky and the meadow out to its edges. The page itself never scrolls: the
 * map pans inside its own view.
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
 * stands. `sunflowers`: one on the hills per table the child knows. `nudge`:
 * the place first in "I dag", whose sign sways until the child taps or drags
 * the map. `hint`: a hand shows the drag, on a map larger than the screen;
 * `onMoved` is told the first time the child moves the map (docs/PLAN-ENKLARE.md, E3).
 */
export function valleyMap(
  places: MapPlace[],
  opts: { start: string; guide: Element; sunflowers: number; nudge?: string; hint?: boolean; onMoved?: () => void },
): ValleyMap {
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
        class: `place-name map-sign${p.id === opts.nudge ? ' nudge' : ''}`,
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
    if (spot.sign.up) signRow.classList.add('up');
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
  const sky = scene({ height: SKY_H, sunflowers: opts.sunflowers, cloud: true });
  const world = h('div', { class: 'map-world' }, sky, content);
  const sizer = h('div', { class: 'map-sizer' }, world);
  const view = h('div', { class: 'map-view' }, sizer);
  // A shortcut for those who see; the list of places is the way for a screen reader.
  const pointers = h('div', { class: 'map-pointers', 'aria-hidden': 'true' });
  // Out to the whole valley and back in, for those who do not pinch (and the keyboard).
  const zoomButton = h('button', { class: 'icon-button map-zoom', type: 'button', onclick: () => toggleZoom() }) as HTMLButtonElement;
  const el = h('div', { class: 'valley-map' }, view, pointers, zoomButton);

  let fits = false;
  // The map's scale on screen. A screen with room shows the whole valley; on a
  // phone the child zooms between close (1) and the whole valley (`least`).
  let scale = 1;
  let least = 1;
  // Wider or taller than the valley at this scale: the sky and the meadow go on to the screen's edges.
  let ww = MAP_W;
  let hh = MAP_H;
  let landH = 0;
  // The place nearest the middle of the screen: the map stays there when the screen turns.
  let at = opts.start;

  const boxOf = (id: string): Box => SPOTS[id]!.box;
  /** The valley's left edge in the world: the meadow beside it on a screen wider than the valley. */
  const offset = () => (ww - MAP_W) / 2;
  /** Its top: zoomed out on a tall phone a third of the room is sky above the valley, the rest meadow below. */
  const offsetY = () => (fits ? 0 : (hh - MAP_H) / 3);
  /** Where a part of the valley is on the screen now. */
  const onScreen = (b: Box): Box => ({
    x: (offset() + b.x) * scale - view.scrollLeft,
    y: (offsetY() + b.y) * scale - view.scrollTop,
    w: b.w * scale,
    h: b.h * scale,
  });
  /** Where the view should be to show a place: all of it if it fits, else its sign and the nearest part of its picture, from the top. */
  const viewFor = (id: string) => {
    const b = boxOf(id);
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const x = b.w * scale + 32 > vw ? SPOTS[id]!.focusX : b.x + b.w / 2;
    return {
      left: (offset() + x) * scale - vw / 2,
      // Room above the place for pointers to the places beyond the top.
      top: b.h * scale + CLEAR_TOP + 16 > vh ? (offsetY() + b.y) * scale - CLEAR_TOP - 52 : (offsetY() + b.y + b.h / 2) * scale - vh / 2,
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

  /** Draws the map at a scale. */
  function render(next: number) {
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    scale = next;
    ww = Math.max(MAP_W, vw / scale);
    hh = Math.max(MAP_H, vh / scale);
    world.style.width = `${ww}px`;
    world.style.height = `${hh}px`;
    world.style.transform = scale === 1 ? '' : `scale(${scale})`;
    content.style.left = `${offset()}px`;
    content.style.top = `${offsetY()}px`;
    // The sky grows upwards; the hills stay at the valley's top.
    sky.style.paddingTop = offsetY() ? `${offsetY()}px` : '';
    sizer.style.width = `${ww * scale}px`;
    sizer.style.height = `${hh * scale}px`;
    // Far out the signs keep a readable size, and the lines under them wait until the child comes closer.
    const far = scale < READABLE;
    el.classList.toggle('far', far);
    el.style.setProperty('--label', far ? String(READABLE / scale) : '1');
    const out = !fits && scale <= least + 0.001;
    zoomButton.replaceChildren(icon(out ? 'zoomIn' : 'zoomOut'));
    zoomButton.setAttribute('aria-label', out ? 'Gå närmare' : 'Visa hela dalen');
    zoomButton.title = out ? 'Gå närmare' : 'Visa hela dalen';
  }

  /**
   * Zooms to a scale, keeping the point of the valley at `from` (on the screen)
   * where `to` is: under the fingers, the mouse, or the middle of the screen.
   */
  function zoomTo(next: number, from: { x: number; y: number }, to = from) {
    const x = (view.scrollLeft + from.x) / scale - offset();
    const y = (view.scrollTop + from.y) / scale - offsetY();
    render(clamp(next, least, 1));
    view.scrollLeft = (offset() + x) * scale - to.x;
    view.scrollTop = (offsetY() + y) * scale - to.y;
    updatePointers();
  }

  let gliding = 0;
  // Where the glide is going: a key pressed again goes on from there.
  let aim = 1;
  /** The button and the keys: to a scale over a moment (at once with reduced motion), then `then`. */
  function glideTo(next: number, anchor: { x: number; y: number }, then?: () => void) {
    cancelAnimationFrame(gliding);
    aim = clamp(next, least, 1);
    // The map moves by itself: the place the child was at stays theirs, to come back in to.
    byItself = true;
    const from = scale;
    if (prefersReducedMotion()) {
      zoomTo(next, anchor);
      then?.();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 260);
      zoomTo(from + (next - from) * (1 - (1 - t) ** 3), anchor);
      if (t < 1) gliding = requestAnimationFrame(step);
      else {
        gliding = 0;
        then?.();
      }
    };
    gliding = requestAnimationFrame(step);
  }

  const middle = () => ({ x: view.clientWidth / 2, y: view.clientHeight / 2 });
  function toggleZoom() {
    if (scale > least + 0.001) return glideTo(least, middle());
    // In again at the place the child was at.
    const b = onScreen(boxOf(at));
    glideTo(1, { x: b.x + b.w / 2, y: b.y + b.h / 2 }, () => show(at, true));
  }

  function layout() {
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const k = Math.min(vw / MAP_W, vh / MAP_H);
    const wasOut = !fits && scale <= least + 0.001 && least < 1;
    fits = k >= FIT_AT;
    least = fits ? Math.min(k, 1.15) : k;
    el.classList.toggle('fits', fits);
    el.classList.toggle('zoomable', !fits);
    // The land is drawn once for the tallest the world can be here.
    const tallest = Math.max(MAP_H, vh / least);
    if (tallest !== landH) drawLand(land, (landH = tallest));
    render(fits ? least : wasOut ? least : clamp(scale, least, 1));
    show(at, false);
    updatePointers();
  }

  function updatePointers() {
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const away = fits
      ? []
      : shown.filter((p) => {
          const b = onScreen(boxOf(p.id));
          return b.x + b.w < 40 || b.x > vw - 40 || b.y + b.h < 90 || b.y > vh - 40;
        });
    const chips = away.map((p) => {
      const b = onScreen(boxOf(p.id));
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
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
    // Measured, then placed at their edge as near their place as the others allow: never on top of each other, nor on the zoom button.
    const zb = zoomButton.getBoundingClientRect();
    const vb = view.getBoundingClientRect();
    const placed: Box[] = zb.width ? [{ x: zb.left - vb.left, y: zb.top - vb.top, w: zb.width, h: zb.height }] : [];
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

  // The sign of today's place sways, and the hand shows the drag, until the child taps or moves the map.
  let hand: HTMLElement | null = null;
  let moved = false;
  const calm = () => {
    el.querySelector('.map-sign.nudge')?.classList.remove('nudge');
    hand?.remove();
    hand = null;
  };
  el.addEventListener('pointerdown', calm);

  let frame = 0;
  const onScroll = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      updatePointers();
      if (byItself) return;
      if (!moved) {
        moved = true;
        calm();
        opts.onMoved?.();
      }
      const mx = (view.scrollLeft + view.clientWidth / 2) / scale - offset();
      const my = (view.scrollTop + view.clientHeight / 2) / scale - offsetY();
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

  // Two fingers pinch the map, as in a map app: the valley stays under the fingers.
  const inView = (t: { clientX: number; clientY: number }) => {
    const r = view.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  let pinch: { distance: number; scale: number; at: { x: number; y: number } } | null = null;
  const fingers = (e: TouchEvent) => {
    const [a, b] = [e.touches[0]!, e.touches[1]!];
    const p = inView(a);
    const q = inView(b);
    return { distance: Math.hypot(p.x - q.x, p.y - q.y), mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } };
  };
  view.addEventListener(
    'touchstart',
    (e) => {
      if (fits || e.touches.length !== 2) return;
      cancelAnimationFrame(gliding);
      const f = fingers(e);
      pinch = { distance: f.distance, scale, at: f.mid };
      dragged = true;
    },
    { passive: true },
  );
  view.addEventListener(
    'touchmove',
    (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const f = fingers(e);
      zoomTo((pinch.scale * f.distance) / Math.max(1, pinch.distance), pinch.at, f.mid);
      pinch.at = f.mid;
      pinch.scale = scale;
      pinch.distance = f.distance;
    },
    { passive: false },
  );
  const endPinch = (e: TouchEvent) => {
    if (e.touches.length < 2) pinch = null;
  };
  view.addEventListener('touchend', endPinch);
  view.addEventListener('touchcancel', endPinch);
  // A pinch on a trackpad, or ctrl and the mouse wheel.
  view.addEventListener(
    'wheel',
    (e) => {
      if (fits || !e.ctrlKey) return;
      e.preventDefault();
      cancelAnimationFrame(gliding);
      zoomTo(scale * Math.exp(-e.deltaY * 0.01), inView(e));
    },
    { passive: false },
  );

  // The arrow keys move the map; + and − zoom.
  const onKey = (e: KeyboardEvent) => {
    if (fits || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '−') {
      e.preventDefault();
      const from = gliding ? aim : scale;
      glideTo(e.key === '-' || e.key === '−' ? from / 1.6 : from * 1.6, middle());
      return;
    }
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
      if (opts.hint && !fits) {
        hand = h('div', { class: 'map-hand', 'aria-hidden': 'true' }, icon('hand'));
        hand.addEventListener('animationend', () => calm());
        el.append(hand);
      }
    },
    cleanup() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(laidOut);
      cancelAnimationFrame(gliding);
      window.removeEventListener('resize', relayout);
      resized?.disconnect();
    },
  };
}

/** Below this scale the signs stop shrinking, and the lines under them are left out. */
const READABLE = 0.65;

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
