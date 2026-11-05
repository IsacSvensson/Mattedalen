import { s } from '../../../shell/dom';

/**
 * Small drawings for the answers about the day (docs/PLAN-KLOCKAN.md): a bowl
 * for breakfast, a plate for dinner, a bed for bedtime, a school, the morning
 * sun, the evening moon and the night's stars. Drawings, never controls.
 */
const ART: Record<string, string> = {
  frukost:
    '<path d="M8 26 h32 a16 14 0 0 1 -32 0 Z" fill="#f6efe0"/><path d="M8 26 h32 a16 14 0 0 1 -32 0 Z"/><path d="M14 22 q4 -4 8 0 q4 -4 8 0 q4 -4 6 0" fill="none"/>',
  middag:
    '<ellipse cx="24" cy="30" rx="18" ry="8" fill="#fff"/><ellipse cx="24" cy="30" rx="18" ry="8"/><ellipse cx="24" cy="29" rx="9" ry="4" fill="var(--leaf-light)"/><path d="M6 12 v12 M42 12 v12" fill="none"/>',
  läggdags:
    '<path d="M6 34 V18 M6 26 h36 v8 M42 34 V24" fill="none"/><rect x="10" y="20" width="10" height="6" rx="3" fill="#fff"/><path d="M34 6 a6 6 0 1 0 6 8 a5 5 0 0 1 -6 -8 Z" fill="var(--sun)"/>',
  skolan:
    '<path d="M6 20 L24 8 L42 20 Z" fill="var(--primary)"/><rect x="10" y="20" width="28" height="20" fill="#e9dcc4"/><rect x="21" y="29" width="6" height="11" fill="var(--wood)"/><rect x="14" y="24" width="5" height="5" fill="#fff"/><rect x="29" y="24" width="5" height="5" fill="#fff"/>',
  'på morgonen':
    '<path d="M6 34 h36" fill="none"/><path d="M14 34 a10 10 0 0 1 20 0 Z" fill="var(--sun)"/><path d="M24 14 v4 M12 20 l3 3 M36 20 l-3 3" fill="none"/>',
  'på kvällen': '<path d="M28 8 a14 14 0 1 0 10 24 a11 11 0 0 1 -10 -24 Z" fill="var(--sun)"/>',
  'mitt i natten':
    '<path d="M14 10 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1 Z" fill="var(--sun)"/><path d="M33 22 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 Z" fill="var(--sun)"/>',
};

export function dayIcon(answer: string): SVGSVGElement | null {
  const art = ART[answer];
  if (!art) return null;
  const svg = s('svg', { class: 'day-icon', viewBox: '0 0 48 44', 'aria-hidden': 'true' });
  svg.innerHTML = `<g fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${art}</g>`;
  return svg;
}
