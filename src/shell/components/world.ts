import { h, prefersReducedMotion } from "../dom";
import type { PlaceScene } from "../place";
import { icon } from "./icons";

/**
 * The valley as a world of scenes, one per place (docs/PLAN-DALEN.md). The
 * child swipes between them and they snap into place; the neighbours show at
 * the edges, so there is plainly more. Arrows at the edges carry the
 * neighbour's icon, the dots below say where the child is, and the arrow keys
 * move too. On a wide screen every scene fits side by side and nothing moves
 * (the CSS decides). The page itself never scrolls sideways: the world pans
 * inside its own track.
 */
export interface WorldScene {
  /** The place's id, used for the scene's element ids. */
  id: string;
  name: string;
  open: boolean;
  scene: PlaceScene;
  go: () => void;
}

export interface World {
  el: HTMLElement;
  /** Call once the world is on the page: it shows the start scene. */
  mount(): void;
  cleanup(): void;
}

/**
 * `start`: today's place, where the world opens. `guide`: the child's animal;
 * a tap on it goes back to today's place.
 */
export function world(
  scenes: WorldScene[],
  opts: { start: number; guide: Element },
): World {
  const home = Math.max(0, Math.min(scenes.length - 1, opts.start));
  let current = home;
  const guide = h(
    "button",
    {
      class: "world-guide",
      type: "button",
      "aria-label": "Till dagens plats",
      onclick: () => go(home),
    },
    opts.guide,
  );

  const items = scenes.map((sc, i) => {
    const { scene } = sc;
    const sign = h(
      "button",
      {
        class: "place-name world-sign",
        id: `scene-${sc.id}`,
        type: "button",
        "aria-label": `${sc.name}. ${scene.moodText}`,
        disabled: !sc.open,
        onclick: () => sc.go(),
      },
      scene.nameIcon,
      sc.name,
    );
    return h(
      "li",
      {
        class: `world-scene mood-${scene.mood}${sc.open ? "" : " closed"}`,
        "aria-labelledby": `scene-${sc.id}`,
        dataset: { index: String(i) },
      },
      h("div", { class: "world-title" }, sign),
      // The picture is not a control (the bed's squares would be inside one), but a tap on it goes there too.
      h(
        "div",
        {
          class: "world-art",
          "aria-hidden": "true",
          onclick: () => sc.open && sc.go(),
        },
        scene.art,
      ),
      scene.artText ? h("p", { class: "sr-only" }, scene.artText) : null,
      h(
        "p",
        { class: "place-status" },
        scene.moodIcon,
        h("span", null, scene.moodText),
      ),
      scene.line,
      sc.open
        ? h(
            "button",
            {
              class: "big-button",
              type: "button",
              autofocus: i === current,
              onclick: () => sc.go(),
            },
            icon(scene.go.icon),
            scene.go.label,
          )
        : null,
    );
  });

  const track = h(
    "ol",
    { class: "world-track", "aria-label": "Platserna i dalen" },
    items,
  );
  const arrow = (side: "prev" | "next") =>
    h("button", {
      class: `world-arrow ${side}`,
      type: "button",
      onclick: () => go(current + (side === "prev" ? -1 : 1)),
    });
  const prev = arrow("prev");
  const next = arrow("next");
  const dots = h(
    "div",
    { class: "world-dots", "aria-hidden": "true" },
    scenes.map(() => h("span")),
  );
  const el = h("div", { class: "world" }, track, prev, next, dots);

  /** The scene nearest the middle of the track. */
  const nearest = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    items.forEach((li, i) => {
      if (
        Math.abs(li.offsetLeft + li.offsetWidth / 2 - mid) <
        Math.abs(items[best]!.offsetLeft + items[best]!.offsetWidth / 2 - mid)
      )
        best = i;
    });
    return best;
  };

  const update = () => {
    items.forEach((li, i) => li.classList.toggle("here", i === current));
    [...dots.children].forEach((d, i) =>
      d.classList.toggle("on", i === current),
    );
    const label = (b: HTMLButtonElement, i: number) => {
      const target = scenes[i];
      b.hidden = !target;
      if (!target) return;
      b.setAttribute("aria-label", `Till ${target.name.toLowerCase()}`);
      const mood = target.scene.moodIcon.cloneNode(true) as Element;
      b.replaceChildren(
        ...(b === prev ? [chevron("prev"), mood] : [mood, chevron("next")]),
      );
    };
    label(prev, current - 1);
    label(next, current + 1);
    // The guide walks along: it stands by the sign of the scene the child is at.
    items[current]!.querySelector(".world-title")!.prepend(guide);
    // The arrows sit level with the middle of the picture they point past.
    const art = items[current]!.querySelector<HTMLElement>(".world-art")!;
    el.style.setProperty(
      "--arrow-top",
      `${Math.round(art.offsetTop + art.offsetHeight / 2)}px`,
    );
  };

  const scrollTo = (i: number, smooth: boolean) => {
    const li = items[i]!;
    track.scrollTo({
      left: li.offsetLeft - (track.clientWidth - li.offsetWidth) / 2,
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
  };

  // While the world glides to a scene the child chose, the scenes it passes are not where the child is.
  let gliding: number | null = null;
  let glideTimer = 0;
  const landed = () => {
    gliding = null;
    clearTimeout(glideTimer);
  };

  function go(i: number) {
    if (i < 0 || i >= scenes.length) return;
    current = i;
    update();
    gliding = i;
    clearTimeout(glideTimer);
    // `scrollend` ends the glide; without it, a moment later does.
    glideTimer = window.setTimeout(landed, 1000);
    scrollTo(i, true);
  }

  let frame = 0;
  const onScroll = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const i = nearest();
      if (gliding !== null) {
        if (i === gliding) landed();
        return;
      }
      if (i !== current) {
        current = i;
        update();
      }
    });
  };
  track.addEventListener("scroll", onScroll, { passive: true });
  track.addEventListener("scrollend", () => {
    landed();
    onScroll();
  });

  const onKey = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement
    )
      return;
    if (e.key === "ArrowLeft") go(current - 1);
    else if (e.key === "ArrowRight") go(current + 1);
    else return;
    e.preventDefault();
  };
  document.addEventListener("keydown", onKey);

  // A turned phone or a resized window: stay at the same scene.
  const resized =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          update();
          scrollTo(current, false);
        })
      : null;

  return {
    el,
    mount() {
      update();
      scrollTo(current, false);
      resized?.observe(track);
    },
    cleanup() {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
      clearTimeout(glideTimer);
      resized?.disconnect();
    },
  };
}

function chevron(side: "prev" | "next"): HTMLElement {
  return h(
    "span",
    { class: "world-chevron", "aria-hidden": "true" },
    side === "prev" ? "‹" : "›",
  );
}
