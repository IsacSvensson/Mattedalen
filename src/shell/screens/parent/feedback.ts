import type { AppContext } from '../../app';
import { icon } from '../../components/icons';
import { h } from '../../dom';
import { APP_BUILD } from '../../pwa';
import { showParentPage } from './frame';
import { showParent } from './parent';

export const FEEDBACK_EMAIL = 'matematikdalen@gmail.com';

/** A mail to the project, written in the grown-up's own mail app: the app's version and a few questions, nothing about the child. */
export function feedbackMailto(build = APP_BUILD): string {
  const body = [
    'Barnets ålder:',
    'Det här var roligt:',
    'Det här var tråkigt eller svårt:',
    'Här fastnade barnet:',
    'Det här var krångligt för mig som vuxen:',
    '',
    `Appens version: ${build}`,
  ].join('\n');
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Mattedalen: tyck till')}&body=${encodeURIComponent(body)}`;
}

/**
 * "Tyck till": the app tracks nothing, so what grown-ups tell is all the
 * project learns. The mail is written and sent from the grown-up's own mail
 * app; the app itself sends nothing.
 */
export function showFeedback(ctx: AppContext, backTo?: string): void {
  showParentPage(
    ctx,
    { title: 'Tyck till', back: () => void showParent(ctx, backTo) },
    h(
      'section',
      { class: 'parent-section', 'aria-labelledby': 'feedback-heading' },
      h('h2', { id: 'feedback-heading' }, 'Berätta hur det går'),
      h('p', null, 'Mattedalen spårar ingenting, så vi ser inte hur appen används. Det du berättar är det enda vi får veta.'),
      h('p', null, 'En mening räcker. Skriv gärna hur gammalt barnet är, vad som var roligt eller tråkigt, var barnet fastnade och vad som var krångligt för dig.'),
      h('a', { class: 'soft-button', href: feedbackMailto() }, icon('mail'), 'Skriv ett mejl'),
      h('p', { class: 'muted' }, 'Eller skriv till ', h('strong', { class: 'feedback-address' }, FEEDBACK_EMAIL), '.'),
      h(
        'p',
        { class: 'muted' },
        'Mejlet skickas från ditt eget mejlprogram. Appen skickar ingenting själv, och inget om barnet följer med. Du behöver inte skriva barnets namn.',
      ),
    ),
  );
}
