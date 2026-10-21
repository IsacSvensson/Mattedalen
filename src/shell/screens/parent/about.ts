import { DEFAULT_CONFIG, type EngineConfig } from '../../../engine';
import type { AppContext } from '../../app';
import { bloomIcon, plantIcon } from '../../components/plant';
import { h } from '../../dom';
import { moreTime } from '../../play';
import { setWhere } from '../../resume';
import { aboutFacts } from '../intro';
import { showParentPage } from './frame';
import { showParent } from './parent';

const sec = (ms: number) => `${ms / 1000} sekunder`;

/**
 * What "sitter" and the pictures mean (docs/PLAN-ENKLARE.md, E4), from the
 * engine's own rules so that the words always say what the app does.
 */
export function sitterRules(status: EngineConfig['status'] = DEFAULT_CONFIG.status): { sits: string; automatic: string; window: string; more: string } {
  const more = moreTime(status);
  return {
    sits: `Rätt svar under ${sec(status.fluentRtMs)} på ${status.fluentDays} olika dagar.`,
    automatic: `Rätt svar under ${sec(status.automaticRtMs)} på ${status.automaticDays} olika dagar, utan svarsalternativ.`,
    window: `Svaren räknas inom ${status.keepEvidenceDays} dagar.`,
    more: `Med ”Ge mer tid” gäller ${sec(more.fluentRtMs)} och ${sec(more.automaticRtMs)}.`,
  };
}

function sitterSection(): HTMLElement {
  const rules = sitterRules();
  const row = (picture: Element, title: string, text: string) => h('li', null, picture, h('span', null, h('strong', null, title), ' ', text));
  return h(
    'section',
    { class: 'parent-section', id: 'sitter', 'aria-labelledby': 'sitter-heading' },
    h('h2', { id: 'sitter-heading' }, 'Växterna, stenarna och lyktorna'),
    h('p', null, 'Bilderna visar vad barnet kan, inte hur mycket barnet har spelat. Varje fakta har ett eget steg.'),
    h(
      'ul',
      { class: 'about-facts' },
      row(plantIcon('soil'), 'Jord:', 'inte övad än.'),
      row(plantIcon('seed'), 'Frö:', 'barnet har nyss mött den.'),
      row(plantIcon('sprout'), 'Planta:', 'barnet övar på den.'),
      row(plantIcon('bush'), 'Buske, sitter:', rules.sits),
      row(plantIcon('tree'), 'Träd, automatiserad:', rules.automatic),
      row(bloomIcon('fruit'), 'Delat med', 'har blomma, kart och mogen frukt på samma sätt.'),
    ),
    h('p', null, `${rules.window} ${rules.more}`),
    h('p', null, 'Vid bäcken fylls en sten i bron för varje del, och på Stigen tänds en lykta, när ungefär fyra av fem fakta i delen sitter.'),
    h('p', { class: 'muted' }, '”94 av 100 sitter” gäller faktana i Mattedalen, inte allt i matematiken.'),
  );
}

/** "Så fungerar Mattedalen": the four lines of the grown-ups' first start (docs/PLAN-ENKLARE.md, E2), and what the pictures and "sitter" mean (E4). `at: 'sitter'` opens at that part. */
export function showAbout(ctx: AppContext, backTo?: string, at?: 'sitter'): void {
  setWhere({ kind: 'parent', page: 'about', profileId: backTo });
  showParentPage(
    ctx,
    { title: 'Så fungerar Mattedalen', back: () => void showParent(ctx, backTo) },
    h('section', { class: 'parent-section', 'aria-label': 'Så fungerar Mattedalen' }, aboutFacts()),
    sitterSection(),
  );
  if (at) document.getElementById(at)?.scrollIntoView({ block: 'start' });
}
