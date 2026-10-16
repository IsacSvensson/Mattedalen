import { systemClock } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../app';
import { avatarIcon } from '../../components/avatars';
import { icon } from '../../components/icons';
import { h } from '../../dom';
import { formatDay, minutesPerDay } from '../../stats';
import { showProfiles } from '../profiles';
import { showDevice } from './device';
import { pageRow, profileSaver, showParentPage } from './frame';
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
    selected ? await childOverview(ctx, selected) : null,
    h(
      'nav',
      { class: 'parent-section', 'aria-label': 'Enheten' },
      h(
        'ul',
        { class: 'parent-rows' },
        pageRow({ icon: icon('phone'), title: 'Hämta ett barn', text: 'QR-kod, säkerhetskopia eller Gångerträdgården', onclick: () => void showImport(ctx, selected?.id) }),
        pageRow({ icon: icon('lock'), title: 'Den här enheten', text: 'Lagring, version, hemskärmen, integritet och vuxenkod', onclick: () => void showDevice(ctx, selected?.id) }),
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
      ctx.places.map((place) => pageRow({ icon: place.icon(), title: place.name, text: place.about, onclick: () => void showParentPlace(ctx, profile.id, place.id) })),
    ),
    h(
      'ul',
      { class: 'parent-rows' },
      pageRow({
        icon: icon('grownup'),
        title: 'Barnets inställningar',
        text: 'Namn, passlängd, uppläsning, platsernas val, flytta eller spara',
        onclick: () => void showChildSettings(ctx, profile.id),
      }),
    ),
  );
}

/** A place's page for one child: its own part of the view (`Place.parentPage`). */
export async function showParentPlace(ctx: AppContext, profileId: string, placeId: string): Promise<void> {
  const profile = await ctx.store.getProfile(profileId);
  const place = ctx.places.find((p) => p.id === placeId);
  if (!profile || !place) return showParent(ctx, profileId);
  const save = profileSaver(ctx, profile, () => showParentPlace(ctx, profileId, placeId));
  showParentPage(ctx, { title: place.name, subtitle: profile.name, back: () => void showParent(ctx, profileId) }, await place.parentPage(ctx, profile, save));
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
