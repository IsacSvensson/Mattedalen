import type { DayKey } from '../engine';
import type { AppContext } from './app';
import { choose } from './components/modal';
import { h } from './dom';

/**
 * What is new in the app, for grown-ups (docs/PLAN-UPPDATERING.md, U2). Newest
 * first. A change that children or grown-ups see gets a post here, in the same
 * change: a title and one to three short points, in Swedish.
 */
export interface NewsItem {
  id: string;
  day: DayKey;
  title: string;
  points: string[];
}

export const NEWS: readonly NewsItem[] = [
  {
    id: '2026-10-18-uppdatering',
    day: '2026-10-18',
    title: 'Tillbaka dit du var',
    points: [
      'Efter en uppdatering öppnar appen samma skärm som förut. I ”För vuxna” frågar den efter vuxenkoden igen.',
      'Den här rutan säger vad som är nytt. Allt finns också under ”Nytt i appen” i ”För vuxna”.',
    ],
  },
  {
    id: '2026-10-18-plus-forst',
    day: '2026-10-18',
    title: 'Plus först vid bäcken',
    points: [
      'En minusfakta kommer när plusfaktan i samma familj sitter: 13 − 5 efter 8 + 5.',
      'Första gången kommer ett kort som visar att minus betyder att ta bort.',
    ],
  },
  {
    id: '2026-10-18-minustecknet',
    day: '2026-10-18',
    title: 'Mer hjälp med minus',
    points: [
      '”För vuxna” säger till när ett barn ofta svarar summan på minus, med ett tips.',
      'Gissningar blir inte längre svarsalternativ, och knappsatsen vid bäcken tar två siffror.',
    ],
  },
  {
    id: '2026-10-17-tyck-till',
    day: '2026-10-17',
    title: 'Tyck till',
    points: ['Under ”För vuxna” kan du mejla oss eller skapa ett ärende på GitHub. Appen spårar ingenting, så det du berättar är det enda vi får veta.'],
  },
];

/** The newest post this device has seen. */
export const NEWS_SEEN_KEY = 'newsSeen';

/** At most so many posts in the box, so that it fits a small phone; the rest are on the page "Nytt i appen". */
export const NEWS_IN_BOX = 2;

/** The posts newer than `seenId`, newest first; all of them when it is not in the list (an older post that is gone). */
export function newsSince(seenId: string, news: readonly NewsItem[] = NEWS): NewsItem[] {
  const at = news.findIndex((n) => n.id === seenId);
  return at === -1 ? [...news] : news.slice(0, at);
}

/** One post: its title and points. */
export function newsItemView(item: NewsItem): HTMLElement {
  return h('li', { class: 'news-item' }, h('strong', null, item.title), h('ul', null, item.points.map((p) => h('li', null, p))));
}

/**
 * The box "Nytt i Mattedalen", on the first screen after an update, when
 * there are posts this device has not seen. A new device has seen everything:
 * no old news on the first start. A device that already has children but
 * never saw a post (the version before this list) sees the newest ones.
 */
export async function showNewsIfAny(ctx: AppContext): Promise<void> {
  const newest = NEWS[0];
  if (!newest) return;
  const seen = await ctx.store.getSetting<string>(NEWS_SEEN_KEY);
  if (seen === undefined && (await ctx.store.listProfiles()).length === 0) {
    await ctx.store.setSetting(NEWS_SEEN_KEY, newest.id);
    return;
  }
  const fresh = seen === undefined ? [...NEWS] : newsSince(seen);
  if (!fresh.length) return;
  const shown = fresh.slice(0, NEWS_IN_BOX);
  const more = fresh.length - shown.length;
  await choose(
    'Nytt i Mattedalen',
    h(
      'div',
      { class: 'news' },
      h('ul', { class: 'news-list' }, shown.map(newsItemView)),
      more > 0 ? h('p', { class: 'muted' }, `Och ${more} till under ”Nytt i appen” i ”För vuxna”.`) : null,
    ),
    [{ value: 'ok', label: 'Okej', primary: true }],
    { cancel: false },
  );
  await ctx.store.setSetting(NEWS_SEEN_KEY, newest.id);
}
