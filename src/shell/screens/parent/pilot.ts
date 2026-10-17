import { pilotCode, pilotExport, pilotFileName } from '../../../storage';
import type { AppContext } from '../../app';
import { toast } from '../../components/modal';
import { h } from '../../dom';
import { APP_BUILD } from '../../pwa';
import { showParentPage } from './frame';
import { showChildSettings } from './settings';

/** The pilot code a grown-up gave the child last time, so it is there the next time. */
const codeKey = (profileId: string) => `pilotCode:${profileId}`;

/**
 * "Fil till piloten" (docs/PLAN-PILOT.md): the child's answers under a pilot
 * code, without the name, saved on this device. The grown-up chooses whether
 * to send the file; the app never does.
 */
export async function showPilotExport(ctx: AppContext, profileId: string): Promise<void> {
  const profile = await ctx.store.getProfile(profileId);
  if (!profile) return showChildSettings(ctx, profileId);
  const saved = (await ctx.store.getSetting<string>(codeKey(profileId))) ?? '';
  const data = await ctx.store.export(profileId);
  const answers = data.attempts.length + (data.daySummaries ?? []).reduce((n, d) => n + d.attempts, 0);

  const input = h('input', { type: 'text', value: saved, maxlength: 12, autocapitalize: 'characters', 'aria-label': 'Pilotkod', placeholder: 'P03' }) as HTMLInputElement;
  const error = h('p', { class: 'muted form-error', role: 'alert' });
  const save = async () => {
    const code = pilotCode(input.value);
    if (!code) {
      error.textContent = 'Skriv en pilotkod med bokstäver och siffror, till exempel P03.';
      input.focus();
      return;
    }
    error.textContent = '';
    await ctx.store.setSetting(codeKey(profileId), code);
    const file = pilotExport(await ctx.store.export(profileId), code, APP_BUILD);
    const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
    const a = h('a', { href: url, download: pilotFileName(code) });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast('Filen är sparad på enheten');
  };

  showParentPage(
    ctx,
    { title: 'Fil till piloten', subtitle: profile.name, back: () => void showChildSettings(ctx, profileId), className: 'pilot-page' },
    h(
      'section',
      { class: 'parent-section', 'aria-labelledby': 'pilot-what' },
      h('h2', { id: 'pilot-what' }, 'Det här finns i filen'),
      h(
        'ul',
        { class: 'pilot-list' },
        h('li', null, `Alla svar: ${answers} stycken, med rätt eller fel, svaret och tiden.`),
        h('li', null, `Alla pass: ${data.sessions.length} stycken.`),
        h('li', null, 'Hur varje fakta ligger till, på varje plats.'),
        h('li', null, 'Inställningarna som påverkar övningen, till exempel passlängden och ”Ge mer tid”.'),
        h('li', null, 'Appens version.'),
      ),
      h('h2', null, 'Det här finns inte i filen'),
      h('p', null, `Namnet ${profile.name} och djuret. Barnet heter bara pilotkoden i filen.`),
    ),
    h(
      'section',
      { class: 'parent-section', 'aria-labelledby': 'pilot-save' },
      h('h2', { id: 'pilot-save' }, 'Spara filen'),
      h('div', { class: 'settings' }, h('label', null, 'Pilotkod ', input), error, h('button', { class: 'soft-button', type: 'button', onclick: () => void save() }, 'Spara filen')),
      h(
        'p',
        { class: 'muted' },
        'Filen sparas bara på den här enheten. Appen skickar den inte. Du väljer själv om du vill skicka den till den som håller i piloten, till exempel som bilaga i ett mejl.',
      ),
    ),
  );
}
