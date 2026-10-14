import { s } from '../dom';

/**
 * The players' animals, drawn in the garden's style. Profiles store the emoji
 * (older profiles and backups already do); this maps it to a drawing and a
 * Swedish name. Unknown values fall back to the text itself.
 *
 * Shapes use classes styled in styles.css: `a-main` (the animal's colour,
 * `--a`), `a-accent` (`--a2`), `a-light`, `a-white`, `a-eye`, `a-line`.
 */
interface AvatarDef {
  name: string;
  main: string;
  accent?: string;
  svg: string;
}

const EYES = (y: number, dx = 7, r = 2.6) => `<circle cx="${32 - dx}" cy="${y}" r="${r}" class="a-eye"/><circle cx="${32 + dx}" cy="${y}" r="${r}" class="a-eye"/>`;
const SMILE = (y: number, w = 5) => `<path d="M${32 - w} ${y}c${w * 0.6} ${w * 0.7} ${w * 1.4} ${w * 0.7} ${w * 2} 0" class="a-line"/>`;

const AVATARS: Record<string, AvatarDef> = {
  '🦊': {
    name: 'räv',
    main: '#f08a3e',
    svg: `<path d="M14 18 20 6l9 12M50 18 44 6l-9 12" class="a-main"/><path d="M12 24c0-6 8-10 20-10s20 4 20 10c0 14-9 26-20 30C21 50 12 38 12 24Z" class="a-main"/><path d="M32 54c-6-2-12-8-14-15 5 0 10 3 14 8 4-5 9-8 14-8-2 7-8 13-14 15Z" class="a-light"/>${EYES(31)}<path d="M29.5 43.5h5L32 46.5Z" class="a-eye"/>`,
  },
  '🐢': {
    name: 'sköldpadda',
    main: '#8fcf72',
    accent: '#b9893f',
    svg: `<path d="M9 54c0-13 10-21 23-21s23 8 23 21Z" class="a-accent"/><path d="M20 54l3.5-9h17l3.5 9M23.5 45 18 37M40.5 45 46 37" class="a-line"/><circle cx="32" cy="25" r="14" class="a-main"/>${EYES(23, 5.5)}${SMILE(29, 4.5)}`,
  },
  '🐸': {
    name: 'groda',
    main: '#7cc46a',
    svg: `<circle cx="21" cy="19" r="8" class="a-main"/><circle cx="43" cy="19" r="8" class="a-main"/><path d="M8 38c0-12 10-18 24-18s24 6 24 18-10 17-24 17S8 50 8 38Z" class="a-main"/><circle cx="21" cy="19" r="4.2" class="a-white"/><circle cx="43" cy="19" r="4.2" class="a-white"/><circle cx="21.5" cy="19.5" r="2.2" class="a-eye"/><circle cx="42.5" cy="19.5" r="2.2" class="a-eye"/><path d="M22 40c5 5 15 5 20 0" class="a-line"/>`,
  },
  '🐰': {
    name: 'kanin',
    main: '#f1ebe3',
    accent: '#f6b3b3',
    svg: `<path d="M20 30C14 22 14 6 20 4s10 14 8 26Z" class="a-main"/><path d="M44 30c6-8 6-24 0-26s-10 14-8 26Z" class="a-main"/><path d="M20.5 26c-2-6-2-14 0-16 2 2 3 9 3 16Z" class="a-accent"/><path d="M43.5 26c2-6 2-14 0-16-2 2-3 9-3 16Z" class="a-accent"/><circle cx="32" cy="40" r="18" class="a-main"/>${EYES(37, 7)}<path d="M29.5 43h5L32 46Z" class="a-accent"/><path d="M32 46v3" class="a-line"/>`,
  },
  '🐻': {
    name: 'björn',
    main: '#a8774f',
    svg: `<circle cx="17" cy="17" r="7" class="a-main"/><circle cx="47" cy="17" r="7" class="a-main"/><circle cx="32" cy="34" r="21" class="a-main"/><ellipse cx="32" cy="41" rx="10" ry="8" class="a-light"/>${EYES(30, 7.5)}<ellipse cx="32" cy="37.5" rx="3.4" ry="2.4" class="a-eye"/>`,
  },
  '🦉': {
    name: 'uggla',
    main: '#b48a63',
    accent: '#ffb03b',
    svg: `<path d="M14 14 22 20M50 14l-8 6" class="a-line"/><path d="M12 32c0-12 9-18 20-18s20 6 20 18v6c0 11-9 18-20 18s-20-7-20-18Z" class="a-main"/><path d="M22 44c3 6 7 8 10 8s7-2 10-8c-3 2-7 3-10 3s-7-1-10-3Z" class="a-light"/><circle cx="24" cy="31" r="7" class="a-white"/><circle cx="40" cy="31" r="7" class="a-white"/><circle cx="24" cy="31" r="3" class="a-eye"/><circle cx="40" cy="31" r="3" class="a-eye"/><path d="M29.5 37h5L32 41.5Z" class="a-accent"/>`,
  },
  '🐝': {
    name: 'bi',
    main: '#ffcf4a',
    svg: `<path d="M26 18c-2-5-5-8-8-8M38 18c2-5 5-8 8-8" class="a-line"/><circle cx="17" cy="10" r="2.6" class="a-eye"/><circle cx="47" cy="10" r="2.6" class="a-eye"/><ellipse cx="13" cy="30" rx="8" ry="6" class="a-white"/><ellipse cx="51" cy="30" rx="8" ry="6" class="a-white"/><circle cx="32" cy="36" r="19" class="a-main"/><path d="M13.7 41H50.3A19 19 0 0 1 47.5 47H16.5A19 19 0 0 1 13.7 41Z" class="a-dark"/>${EYES(31, 7)}${SMILE(35.5, 4)}`,
  },
  '🦋': {
    name: 'fjäril',
    main: '#7cc4e4',
    accent: '#ffb03b',
    svg: `<path d="M30 30C24 14 8 8 7 18s8 16 23 14Z" class="a-main"/><path d="M34 30c6-16 22-22 23-12s-8 16-23 14Z" class="a-main"/><path d="M30 34c-12 0-20 6-17 13s13 3 17-9Z" class="a-accent"/><path d="M34 34c12 0 20 6 17 13s-13 3-17-9Z" class="a-accent"/><rect x="29" y="22" width="6" height="28" rx="3" class="a-dark"/><path d="M30 23c-2-5-5-8-8-9M34 23c2-5 5-8 8-9" class="a-line"/><circle cx="21" cy="14" r="2.2" class="a-eye"/><circle cx="43" cy="14" r="2.2" class="a-eye"/>`,
  },
  '🐞': {
    name: 'nyckelpiga',
    main: '#e85a46',
    svg: `<path d="M27 14c-2-4-5-6-8-6M37 14c2-4 5-6 8-6" class="a-line"/><circle cx="32" cy="18" r="9" class="a-dark"/><circle cx="32" cy="38" r="20" class="a-main"/><path d="M32 18v40" class="a-line"/><circle cx="22" cy="32" r="3.5" class="a-eye"/><circle cx="42" cy="32" r="3.5" class="a-eye"/><circle cx="24" cy="45" r="3.5" class="a-eye"/><circle cx="40" cy="45" r="3.5" class="a-eye"/><circle cx="28.5" cy="16.5" r="2" class="a-white"/><circle cx="35.5" cy="16.5" r="2" class="a-white"/>`,
  },
  '🐱': {
    name: 'katt',
    main: '#b9c3cc',
    accent: '#f6b3b3',
    svg: `<path d="M13 30 15 9l14 10M51 30 49 9 35 19" class="a-main"/><path d="M11 34c0-11 9-17 21-17s21 6 21 17-9 19-21 19-21-8-21-19Z" class="a-main"/>${EYES(33, 8)}<path d="M29.5 39h5L32 42Z" class="a-accent"/><path d="M32 42v2.5c-1 2-4 2.5-5 1M32 44.5c1 2 4 2.5 5 1M8 38l10 1M8 44l10-2M56 38l-10 1M56 44l-10-2" class="a-line" style="stroke-width:2"/>`,
  },
  '🐶': {
    name: 'hund',
    main: '#e0b07a',
    accent: '#8a5a36',
    svg: `<circle cx="32" cy="33" r="19" class="a-main"/><path d="M15 18c-6 2-8 14-5 22 4 2 8-2 9-8Z" class="a-accent"/><path d="M49 18c6 2 8 14 5 22-4 2-8-2-9-8Z" class="a-accent"/><ellipse cx="32" cy="42" rx="10" ry="7.5" class="a-light"/>${EYES(30, 7.5)}<ellipse cx="32" cy="38.5" rx="3.6" ry="2.6" class="a-eye"/><path d="M28 45c2 2 6 2 8 0" class="a-line"/>`,
  },
  '🦁': {
    name: 'lejon',
    main: '#f6c76b',
    accent: '#d9822f',
    svg: `<path d="M32 6c5 0 7 4 11 5s8 4 9 8 4 8 3 12 1 9-2 12-3 8-7 10-7 5-11 5-8-3-11-5-7-4-8-8-4-8-3-12-2-8 1-11 3-8 7-10 6-6 11-6Z" class="a-accent"/><circle cx="32" cy="34" r="16" class="a-main"/><circle cx="20" cy="21" r="4" class="a-main"/><circle cx="44" cy="21" r="4" class="a-main"/>${EYES(31, 6.5)}<path d="M29 37h6l-3 3.5Z" class="a-eye"/><path d="M32 40.5v2c-1 2-4 2.5-5 1M32 42.5c1 2 4 2.5 5 1" class="a-line" style="stroke-width:2"/>`,
  },
};

export const AVATAR_KEYS = Object.keys(AVATARS);

/** Swedish name of the animal (for labels), or null for an unknown avatar. */
export function avatarName(key: string): string | null {
  return AVATARS[key]?.name ?? null;
}

/** The player's animal as an SVG; unknown values are shown as text in the same circle. */
export function avatarIcon(key: string, extraClass = ''): SVGSVGElement {
  const def = AVATARS[key];
  const svg = s('svg', {
    class: `avatar-art${extraClass ? ` ${extraClass}` : ''}`,
    viewBox: '0 0 64 64',
    'aria-hidden': 'true',
    style: def ? `--a:${def.main};--a2:${def.accent ?? def.main}` : undefined,
  });
  if (def) svg.innerHTML = def.svg;
  else svg.append(s('text', { x: 32, y: 44, 'text-anchor': 'middle', 'font-size': 34 }, key));
  return svg;
}
