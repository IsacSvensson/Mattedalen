import { s } from '../dom';

/**
 * The app's icons, drawn in the same style as the plants: simple shapes with
 * the ink outline (see `.icon path` in styles.css). Each path may have a fill
 * colour; `none` leaves it as a line.
 */
interface IconDef {
  paths: [d: string, fill?: string][];
}

const ICONS = {
  home: { paths: [['M3.5 11 12 3.8l8.5 7.2V20a1 1 0 0 1-1 1H15v-5.5H9V21H4.5a1 1 0 0 1-1-1Z', 'var(--i-red)']] },
  can: {
    paths: [
      ['M7 10.5c0-4 6-4 6 0'],
      ['M14 14.5 19.5 8.5'],
      ['M18 7l3 3'],
      ['M3.5 10.5h11V18a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18Z', 'var(--i-blue)'],
    ],
  },
  target: {
    paths: [
      ['M12 3.5a8.5 8.5 0 1 0 8.5 8.5', 'var(--i-red)'],
      ['M12 7.5a4.5 4.5 0 1 0 4.5 4.5', 'var(--card)'],
      ['M12 12 19 5'],
      ['M16.5 4.5h3v3'],
    ],
  },
  watch: {
    paths: [['M12 21a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z', 'var(--i-yellow)'], ['M12 13.5V10'], ['M9.5 2.75h5'], ['M12 2.75V6'], ['M18.5 6.5l1.2-1.2']],
  },
  cards: {
    paths: [
      ['M4.7 6.3 11.6 5l2.5 13.2-6.9 1.3a1 1 0 0 1-1.2-.8L3.9 7.5a1 1 0 0 1 .8-1.2Z', 'var(--i-blue)'],
      ['M11.4 4.6l7.2 1a1 1 0 0 1 .9 1.1L18 18.1a1 1 0 0 1-1.1.9l-7.2-1a1 1 0 0 1-.9-1.1L10.3 5.5a1 1 0 0 1 1.1-.9Z', 'var(--i-yellow)'],
    ],
  },
  lock: {
    paths: [['M5.5 10.5h13a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1Z', 'var(--i-yellow)'], ['M8 10.5V7.5a4 4 0 0 1 8 0v3']],
  },
  plus: { paths: [['M12 5v14'], ['M5 12h14']] },
  speaker: {
    paths: [['M4 9.5h3.5L12 5.5v13l-4.5-4H4a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5Z', 'var(--i-yellow)'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
  },
  arrow: { paths: [['M5 12h13'], ['M13 6.5 18.5 12 13 17.5']] },
  back: { paths: [['M19 12H6'], ['M11 6.5 5.5 12l5.5 5.5']] },
  close: { paths: [['M6 6l12 12'], ['M18 6 6 18']] },
  check: { paths: [['M5 12.5l4.5 4.5L19 7.5']] },
  erase: { paths: [['M8.5 5.5H19a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8.5L3 12Z', 'var(--card)'], ['M11 9.5l5 5'], ['M16 9.5l-5 5']] },
  basket: {
    paths: [
      ['M8 11a4 4 0 0 1 8 0'],
      ['M3 11h18l-2.2 8.6a1.5 1.5 0 0 1-1.5 1.1H6.7a1.5 1.5 0 0 1-1.5-1.1Z', 'var(--i-yellow)'],
      ['M6.5 15.5h11'],
    ],
  },
  lantern: {
    paths: [
      ['M12 2.5v2.5'],
      ['M7.5 8 12 5l4.5 3Z', 'var(--i-red)'],
      ['M8.5 8h7v9h-7Z', 'var(--i-yellow)'],
      ['M12 10.5c1.1 1.3 1.5 2.2 1.5 3a1.5 1.5 0 0 1-3 0c0-.8.4-1.7 1.5-3Z', 'var(--i-red)'],
      ['M7 17h10v3.5H7Z', 'var(--i-blue)'],
    ],
  },
  drop: { paths: [['M12 3.5c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11Z', 'var(--i-blue)']] },
  steps: { paths: [['M3.5 20.5V16h5v-4.5h5V7h5V3.5h2.5v17Z', 'var(--i-yellow)']] },
  rotate: { paths: [['M19 12a7 7 0 1 1-2.1-5'], ['M17.5 3v4.5H13']] },
  phone: {
    paths: [['M7.5 2.5h9a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Z', 'var(--i-blue)'], ['M12 7v7'], ['M9 11.5l3 3 3-3'], ['M10.5 18.5h3']],
  },
  refresh: { paths: [['M19.5 12a7.5 7.5 0 0 1-13.4 4.6'], ['M4.5 12a7.5 7.5 0 0 1 13.4-4.6'], ['M18.5 3.5v4h-4'], ['M5.5 20.5v-4h4']] },
  search: { paths: [['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z', 'var(--i-blue)'], ['M15.5 15.5 20.5 20.5']] },
  zoomOut: { paths: [['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z', 'var(--card)'], ['M15.5 15.5 20.5 20.5'], ['M7.5 10.5h6']] },
  zoomIn: { paths: [['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z', 'var(--card)'], ['M15.5 15.5 20.5 20.5'], ['M7.5 10.5h6'], ['M10.5 7.5v6']] },
  moon: { paths: [['M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z', 'var(--i-yellow)']] },
  sun: {
    paths: [
      ['M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z', 'var(--i-yellow)'],
      ['M12 2.5v2'],
      ['M12 19.5v2'],
      ['M2.5 12h2'],
      ['M19.5 12h2'],
      ['M5.3 5.3l1.4 1.4'],
      ['M17.3 17.3l1.4 1.4'],
      ['M5.3 18.7l1.4-1.4'],
      ['M17.3 6.7l1.4-1.4'],
    ],
  },
  trophy: {
    paths: [
      ['M7 3.5h10v5a5 5 0 0 1-10 0Z', 'var(--i-yellow)'],
      ['M7 5.5H4.5a3 3 0 0 0 3 4'],
      ['M17 5.5h2.5a3 3 0 0 1-3 4'],
      ['M12 13.5v4'],
      ['M8 20.5h8l-1-3H9Z', 'var(--i-yellow)'],
    ],
  },
  grownup: {
    paths: [
      ['M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'var(--i-yellow)'],
      ['M5 20.5c0-4.5 3-7 7-7s7 2.5 7 7Z', 'var(--i-blue)'],
    ],
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

/** An icon for buttons and headings. Decorative: the button or text carries the name. */
export function icon(name: IconName, extraClass = ''): SVGSVGElement {
  const def: IconDef = ICONS[name];
  return s(
    'svg',
    { class: `icon icon-${name}${extraClass ? ` ${extraClass}` : ''}`, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    def.paths.map(([d, fill]) => s('path', { d, style: fill ? `--f:${fill}` : undefined })),
  );
}
