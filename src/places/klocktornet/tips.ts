import { s } from '../../shell/dom';
import type { PictureWords } from '../../shell/components/explain';

/** A lit window, for "Vad betyder bilderna?". */
function windowIcon(): SVGSVGElement {
  const svg = s('svg', { class: 'icon tower-window-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.innerHTML = '<rect x="6" y="3" width="12" height="18" rx="6" fill="var(--sun)" stroke="var(--ink)" stroke-width="2"/>';
  return svg;
}

/** What the tower's pictures mean, for the child (docs/PLAN-ENKLARE.md, E4). */
export const TOWER_PICTURES = (): PictureWords[] => [
  { picture: windowIcon(), words: 'Ett fönster för varje del. Det lyser när du kan delen. Till slut lyser hela tornet.' },
];

/**
 * "Så kan du hjälpa till" (docs/PLAN-ENKLARE.md, E4): one tip per part, with
 * the real clocks at home, since what is learnt on a screen carries over
 * better with them (docs/KLOCKAN-UNDERLAG.md).
 */
export const TOWER_TIPS: Record<string, string> = {
  dagen: 'Prata om dagen: vad gör vi först, och sedan? Fråga: hur lång tid tar det att borsta tänderna?',
  urtavlan: 'Visa en riktig klocka. Timvisaren är den korta. Fråga: vilken visare visar timmen?',
  timvisaren: 'Timvisaren rör sig hela tiden. Fråga: står den på en siffra, eller mellan två?',
  hel: 'Titta på köksklockan vid hel timme. Fråga: vad är klockan nu?',
  halv: 'Halv fyra är halvvägs till fyra, och timvisaren står mitt emellan 3 och 4. Fråga vid en halvtimme: vad är klockan?',
  kvart: 'En kvart är en fjärdedel av ett varv, 15 minuter. Fråga: hur många kvartar är en timme?',
  femmin: 'Räkna i femsteg runt klockan: 5, 10, 15 … Fråga: minutvisaren står på 4, hur många minuter är det?',
};
