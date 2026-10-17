import { persistenceStatus, requestPersistence, storageEstimate } from '../../../storage';
import type { AppContext } from '../../app';
import { toast } from '../../components/modal';
import { icon } from '../../components/icons';
import { h } from '../../dom';
import { APP_BUILD, checkForUpdate, installGuide } from '../../pwa';
import { showParentPage } from './frame';
import { showParent } from './parent';
import { choosePin } from './pinGate';

/** "Den här enheten": storage, version and updates, the home screen, privacy and the grown-ups' code. */
export async function showDevice(ctx: AppContext, backTo?: string): Promise<void> {
  showParentPage(ctx, { title: 'Den här enheten', back: () => void showParent(ctx, backTo) }, await deviceSection(ctx, backTo));
}

async function deviceSection(ctx: AppContext, backTo?: string): Promise<HTMLElement> {
  const persist = await persistenceStatus();
  const estimate = await storageEstimate();
  const statusText =
    ctx.storageKind === 'memory'
      ? 'Webbläsaren tillåter inte sparande just nu (privat läge?). Framstegen försvinner när sidan stängs.'
      : persist === 'persisted'
        ? 'Beständig lagring är på: webbläsaren raderar inte datan för att frigöra utrymme.'
        : persist === 'unsupported'
          ? 'Webbläsaren stöder inte beständig lagring.'
          : 'Beständig lagring är inte beviljad. Webbläsaren kan radera datan om utrymmet tar slut.';
  return h(
    'section',
    { class: 'parent-section', 'aria-labelledby': 'device-heading' },
    h('h2', { id: 'device-heading' }, 'Lagring'),
    h('p', null, statusText),
    estimate ? h('p', { class: 'muted' }, `Använder ${(estimate.usage / 1024).toFixed(0)} kB.`) : null,
    persist === 'not-persisted' && ctx.storageKind === 'indexeddb'
      ? h(
          'button',
          {
            class: 'soft-button',
            type: 'button',
            onclick: async () => {
              const result = await requestPersistence();
              toast(result === 'persisted' ? 'Beständig lagring är på' : 'Webbläsaren sa nej – lägg till appen på hemskärmen och försök igen');
              await showDevice(ctx, backTo);
            },
          },
          'Be om beständig lagring',
        )
      : null,
    h('h3', null, 'Version'),
    h('p', { class: 'muted' }, `Appen: ${APP_BUILD}. Nya versioner hämtas av sig själva och tas i bruk när appen startas, eller med knappen ”Ny version finns”.`),
    h(
      'p',
      { class: 'muted' },
      'Ett ideellt projekt, fritt att använda för icke-kommersiella syften (PolyForm Noncommercial 1.0.0). ',
      h('a', { href: './THIRD-PARTY-LICENSES.txt', target: '_blank', rel: 'noopener' }, 'Licenser för ingående delar'),
      '.',
    ),
    h(
      'button',
      {
        class: 'soft-button',
        type: 'button',
        onclick: async (e: Event) => {
          const button = e.currentTarget as HTMLButtonElement;
          button.disabled = true;
          const result = await checkForUpdate();
          button.disabled = false;
          toast(
            result === 'updating'
              ? 'Ny version hittad – appen startar om'
              : result === 'latest'
                ? 'Du har den senaste versionen'
                : 'Kunde inte söka just nu (ingen anslutning?)',
          );
        },
      },
      icon('refresh'),
      'Sök efter uppdatering',
    ),
    h('h3', null, 'Lägg till på hemskärmen'),
    installGuide(),
    h('h3', null, 'Varför lägga till på hemskärmen?'),
    h(
      'p',
      null,
      'All data finns bara på den här enheten. Webbläsare städar ibland bort data från webbplatser – Safari på iPhone och iPad kan radera den efter sju dagar utan besök. ',
      'En app som är tillagd på hemskärmen räknas som installerad och behandlas inte så. Spara också en säkerhetskopia då och då.',
    ),
    h('h3', null, 'Integritet'),
    h(
      'ul',
      { class: 'privacy' },
      h('li', null, 'Appen använder inga cookies och har ingen spårning, analys eller reklam.'),
      h('li', null, 'Barnens namn och framsteg sparas bara här på enheten. Inget skickas iväg – utom när du själv exporterar med QR-kod eller fil.'),
      h('li', null, 'Under ”Tyck till” kan du mejla oss. Mejlet skickas från ditt eget mejlprogram, och inget om barnet följer med.'),
      h('li', null, 'Appen sparar sina egna filer på enheten så att den fungerar utan internet.'),
      h('li', null, 'Sidan ligger på GitHub Pages. Som alla webbservrar loggar GitHub besökares IP-adresser, enligt GitHubs integritetspolicy.'),
      h('li', null, 'Vill du radera allt? Ta bort barnen här ovanför, eller rensa webbplatsdata för sidan i webbläsarens inställningar.'),
    ),
    h('h3', null, 'Vuxenkod'),
    h('button', { class: 'soft-button', type: 'button', onclick: () => choosePin(ctx, async () => (toast('Ny kod sparad'), showDevice(ctx, backTo))) }, 'Byt vuxenkod'),
  );
}

