import { DEFAULT_CONFIG, systemClock } from '../../../engine';
import { moreTime } from '../../play';
import { persistenceStatus, requestPersistence, type Profile } from '../../../storage';
import { show, type AppContext } from '../../app';
import { avatarIcon } from '../../components/avatars';
import { toast } from '../../components/modal';
import { icon } from '../../components/icons';
import { h } from '../../dom';
import { formatDay, minutesPerDay, slowFacts } from '../../stats';
import { showProfiles } from '../profiles';
import { showDevice } from './device';
import { showFeedback } from './feedback';
import { pageRow, profileSaver, showParentPage } from './frame';
import type { ParentTodo, Place, PlaceSummary } from '../../place';
import { showImport } from './importPage';
import { showChildSettings } from './settings';

/**
 * "För vuxna" (docs/PLAN-FORALDRAVYN.md): a short overview with the children,
 * the week and a row per place; the rest is a tap away, on pages of their own.
 */
export async function showParent(ctx: AppContext, selectedId?: string): Promise<void> {
  const profiles = await ctx.store.listProfiles();
  const selected = profiles.find((p) => p.id === selectedId) ?? profiles[0];

  const view = h(
    'main',
    { class: 'screen parent parent-overview' },
    h(
      'header',
      { class: 'top-bar' },
      h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Stäng föräldravyn', onclick: () => void showProfiles(ctx) }, icon('close')),
      h('h1', null, 'För vuxna'),
    ),
    profiles.length
      ? h(
          'nav',
          { class: 'parent-tabs', 'aria-label': 'Barn' },
          profiles.map((p) =>
            h(
              'button',
              { class: `parent-tab${p.id === selected?.id ? ' active' : ''}`, type: 'button', 'aria-pressed': String(p.id === selected?.id), onclick: () => void showParent(ctx, p.id) },
              h('span', { class: 'avatar-badge small' }, avatarIcon(p.avatar)),
              p.name,
            ),
          ),
        )
      : h('p', null, 'Inga barn ännu. Skapa en spelare på startsidan, eller hämta ett barn nedan.'),
    await todoSection(ctx, selected),
    selected ? await childOverview(ctx, selected) : null,
    h(
      'nav',
      { class: 'parent-section', 'aria-label': 'Enheten' },
      h(
        'ul',
        { class: 'parent-rows' },
        pageRow({ icon: icon('phone'), title: 'Hämta ett barn', text: 'QR-kod, säkerhetskopia eller Gångerträdgården', onclick: () => void showImport(ctx, selected?.id) }),
        pageRow({ icon: icon('lock'), title: 'Den här enheten', text: 'Lagring, version, hemskärmen, integritet och vuxenkod', onclick: () => void showDevice(ctx, selected?.id) }),
        pageRow({ icon: icon('mail'), title: 'Tyck till', text: 'Mejla oss, eller hjälp till på GitHub', onclick: () => showFeedback(ctx, selected?.id) }),
      ),
    ),
  );
  show(ctx, view);
}

/** One child: the week, a row per place, and the child's settings. */
async function childOverview(ctx: AppContext, profile: Profile): Promise<HTMLElement> {
  const sessions = await ctx.store.listSessions(profile.id);
  const today = systemClock.today();
  const days = minutesPerDay(sessions, today, 14);
  const week = days.slice(-7);
  const played = week.filter((d) => d.minutes > 0).length;

  return h(
    'section',
    { class: 'parent-section', 'aria-labelledby': 'child-heading' },
    h('h2', { id: 'child-heading', class: 'child-heading' }, h('span', { class: 'avatar-badge small' }, avatarIcon(profile.avatar)), profile.name),
    h('h3', null, 'Den här veckan'),
    minutesChart(days),
    h('p', { class: 'muted' }, `Senaste 7 dagarna: ${week.reduce((s, d) => s + d.minutes, 0)} minuter, ${played} ${played === 1 ? 'dag' : 'dagar'} med spel.`),
    h('h3', null, 'Platserna'),
    h(
      'ul',
      { class: 'parent-rows' },
      await Promise.all(ctx.places.map(async (place) => placeRow(place, await place.parentSummary(ctx, profile, noSave), () => void showParentPlace(ctx, profile.id, place.id)))),
    ),
    h(
      'ul',
      { class: 'parent-rows' },
      pageRow({
        icon: icon('grownup'),
        title: 'Barnets inställningar',
        text: 'Namn, passlängd, mer tid, uppläsning, platsernas val, flytta eller spara',
        onclick: () => void showChildSettings(ctx, profile.id),
      }),
    ),
  );
}

/** A place's page for one child: its own part of the view (`Place.parentPage`). Opening it is seeing its newest check. */
export async function showParentPlace(ctx: AppContext, profileId: string, placeId: string): Promise<void> {
  const profile = await ctx.store.getProfile(profileId);
  const place = ctx.places.find((p) => p.id === placeId);
  if (!profile || !place) return showParent(ctx, profileId);
  await ctx.store.setSetting(checksSeenKey(profileId, place.id), await checkCount(ctx, profileId, place));
  const save = profileSaver(ctx, profile, () => showParentPlace(ctx, profileId, placeId));
  showParentPage(ctx, { title: place.name, subtitle: profile.name, back: () => void showParent(ctx, profileId) }, await place.parentPage(ctx, profile, save));
}

/** Rows only read in the overview; the things to do save through their own saver. */
const noSave = async () => undefined;

/** So many facts right but slow, and "Att göra för dig" suggests more time. */
const SLOW_FACTS = 5;

const checksSeenKey = (profileId: string, placeId: string) => `parentChecksSeen:${profileId}:${placeId}`;

const checkCount = async (ctx: AppContext, profileId: string, place: Place) =>
  (await ctx.store.listSessions(profileId)).filter((s) => s.packId === place.pack.id && s.mode === 'check').length;

/**
 * "Att göra för dig": what waits for a grown-up, only when there is something.
 * It cannot be put away; a thing goes when it is done (docs/PLAN-FORALDRAVYN.md).
 * From the places (opening a place early, a table that waits for Stigen), a new
 * check result to look at, a child who is right but slow (more time), and
 * storage the browser may clear.
 */
async function todoSection(ctx: AppContext, profile: Profile | undefined): Promise<HTMLElement | null> {
  const again = () => showParent(ctx, profile?.id);
  const items: { place: string | null; todo: ParentTodo }[] = [];
  const speeds: Pick<PlaceSummary, 'slow' | 'bestTimes'>[] = [];
  if (profile) {
    const save = profileSaver(ctx, profile, again);
    for (const place of ctx.places) {
      const summary = await place.parentSummary(ctx, profile, save);
      for (const todo of summary.todo)
        items.push({
          place: place.name,
          todo: todo.seePlace && !todo.action ? { ...todo, action: { label: todo.seePlace, run: () => showParentPlace(ctx, profile.id, place.id) } } : todo,
        });
      speeds.push(summary);
      const checks = await checkCount(ctx, profile.id, place);
      const seen = (await ctx.store.getSetting<number>(checksSeenKey(profile.id, place.id))) ?? 0;
      if (checks > seen)
        items.push({
          place: place.name,
          todo: { text: `Ett nytt kollresultat för ${profile.name}.`, action: { label: 'Visa kollen', run: () => showParentPlace(ctx, profile.id, place.id) } },
        });
    }
  }
  const slow = slowFacts(speeds);
  if (profile && !profile.settings.moreTime && slow >= SLOW_FACTS)
    items.push({
      place: null,
      todo: {
        text: `${profile.name} svarar rätt men långsamt på ${slow} fakta. De blir inte buskar förrän svaren går under ${DEFAULT_CONFIG.status.fluentRtMs / 1000} s. Med mer tid räcker det med svar under ${moreTime(DEFAULT_CONFIG.status).fluentRtMs / 1000} s.`,
        action: { label: 'Ge mer tid', run: () => profileSaver(ctx, profile, again)({ settings: { moreTime: true } }) },
      },
    });
    if (ctx.storageKind === 'memory') items.push({ place: null, todo: { text: 'Webbläsaren sparar inte just nu (privat läge?). Framstegen försvinner när sidan stängs.' } });
  else if ((await persistenceStatus()) === 'not-persisted')
    items.push({
      place: null,
      todo: {
        text: 'Webbläsaren kan radera barnens framsteg om utrymmet tar slut.',
        action: {
          label: 'Be om beständig lagring',
          run: async () => {
            const result = await requestPersistence();
            toast(result === 'persisted' ? 'Beständig lagring är på' : 'Webbläsaren sa nej – lägg till appen på hemskärmen och försök igen');
            await again();
          },
        },
      },
    });
  if (!items.length) return null;
  return h(
    'section',
    { class: 'parent-section parent-todo', 'aria-labelledby': 'todo-heading' },
    h('h2', { id: 'todo-heading' }, 'Att göra för dig'),
    h(
      'ul',
      { class: 'todo-list' },
      items.map(({ place, todo }) => {
        const action = todo.action;
        return h(
          'li',
          null,
          h('p', null, place ? h('strong', null, `${place}: `) : null, todo.text),
          action
            ? h(
                'button',
                {
                  class: 'soft-button',
                  type: 'button',
                  onclick: async (e: Event) => {
                    (e.currentTarget as HTMLButtonElement).disabled = true;
                    await action.run();
                    // Done: it goes from the list. A page of its own has been shown instead.
                    if (document.querySelector('.parent-overview')) await again();
                  },
                },
                action.label,
              )
            : null,
        );
      }),
    ),
  );
}

/** A place in the overview: what the child is on, what is hardest, and a bar for how much sits. */
function placeRow(place: Place, summary: PlaceSummary, onclick: () => void): HTMLElement {
  const share = summary.total ? summary.known / summary.total : 0;
  return h(
    'li',
    null,
    h(
      'button',
      { class: 'parent-row place-row', type: 'button', onclick },
      h('span', { class: 'parent-row-icon', 'aria-hidden': 'true' }, place.icon()),
      h(
        'span',
        { class: 'parent-row-text' },
        h('strong', null, place.name),
        h('span', { class: 'muted' }, summary.now ? `Nu: ${summary.now}` : place.about),
        summary.hardest ? h('span', { class: 'muted' }, 'Svårast: ', ...summary.hardest) : null,
        h(
          'span',
          { class: 'known-bar', role: 'img', 'aria-label': `${summary.known} av ${summary.total} sitter` },
          h('span', { class: 'known-fill', style: `width:${Math.round(share * 100)}%` }),
        ),
        h('span', { class: 'muted known-text' }, `${summary.known} av ${summary.total} sitter`),
      ),
      h('span', { class: 'parent-row-go', 'aria-hidden': 'true' }, '›'),
    ),
  );
}

function minutesChart(days: { day: string; minutes: number }[]): HTMLElement {
  const max = Math.max(15, ...days.map((d) => d.minutes));
  return h(
    'div',
    { class: 'minutes' },
    h(
      'div',
      { class: 'minutes-chart', role: 'img', 'aria-label': days.map((d) => `${formatDay(d.day)}: ${d.minutes} min`).join(', ') },
      days.map((d) =>
        h(
          'div',
          { class: 'minutes-bar', title: `${formatDay(d.day)}: ${d.minutes} min` },
          h('span', { class: 'minutes-value' }, d.minutes || ''),
          h('span', { class: 'minutes-fill', style: `height:${(d.minutes / max) * 100}%` }),
          h('span', { class: 'minutes-day' }, formatDay(d.day).split(' ')[0]),
        ),
      ),
    ),
  );
}
