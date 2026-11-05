import type { AppContext } from '../app';
import { CLOCK_LOOKS, clockFace, type ClockLook } from '../components/clockFace';
import { clockSetter, type SetTime } from '../components/clockSetter';
import { digitalClock } from '../components/digitalClock';
import { h } from '../dom';
import { showParentPage } from './parent/frame';

/**
 * "Prova klockan", only in the test version (docs/PLAN-KLOCKAN.md, KL1): the
 * clock's parts before Klocktornet is in the valley, to try on a phone. Loaded
 * with a dynamic import behind `STAGING`, so the real app does not have it.
 */
const LOOK_NAMES: Record<ClockLook, string> = { plain: 'Vanlig', kitchen: 'Köksklocka', watch: 'Armbandsur', station: 'Stationsklocka' };

export function showClockLab(ctx: AppContext, back: () => void): void {
  showParentPage(ctx, { title: 'Prova klockan', subtitle: 'Bara i testversionen', back, className: 'clock-lab' }, looks(), setterSection(), choicesSection());
}

function figure(el: Element, caption: string): HTMLElement {
  return h('figure', { class: 'lab-figure' }, el, h('figcaption', null, caption));
}

function looks(): HTMLElement {
  return h(
    'section',
    null,
    h('h2', null, 'Urtavlorna'),
    h('p', { class: 'muted' }, 'Klockan är halv fyra. Timvisaren står mitt emellan 3 och 4.'),
    h(
      'div',
      { class: 'lab-grid' },
      CLOCK_LOOKS.map((look) => figure(clockFace({ minute: 30, hour: 3.5, look, label: `${LOOK_NAMES[look]}, halv fyra` }), LOOK_NAMES[look])),
      figure(clockFace({ minute: 15, hour: 3.25, quarters: true, label: 'Fjärdedelar, kvart över tre' }), 'Fjärdedelar'),
      figure(clockFace({ minute: 25, hour: 3 + 25 / 60, minuteRing: true, label: 'Minuterna runt kanten, 3:25' }), 'Minuterna runt kanten'),
      figure(clockFace({ hour: 3 + 20 / 60, label: 'Bara timvisaren, strax efter 3' }), 'Bara timvisaren'),
      figure(clockFace({ minute: 40, hour: 7 + 40 / 60, numbers: false, label: 'Utan siffror, 7:40' }), 'Utan siffror'),
    ),
  );
}

function setterSection(): HTMLElement {
  let step = 5;
  let linked = true;
  const slot = h('div', { class: 'lab-setter' });
  const digital = h('div', { class: 'lab-readout', 'aria-live': 'polite' });
  const show = (t: SetTime) => {
    const [hh, mm] = t.text.split(':').map(Number) as [number, number];
    digital.replaceChildren(digitalClock({ hour: hh, minute: mm }), h('span', { class: 'lab-hour-at' }, linked ? '' : `Timvisaren: ${t.hourAt} timmar från 12`));
  };
  const build = () => {
    const setter = clockSetter({ start: 3 * 60, step, linked, face: { minuteRing: step === 5, quarters: step === 15 }, onChange: show });
    setter.el.addEventListener('keydown', (e) => setter.onKey(e));
    slot.replaceChildren(setter.el);
  };
  const steps = h(
    'select',
    {
      'aria-label': 'Minutvisaren snäpper',
      onchange: (e: Event) => {
        step = Number((e.target as HTMLSelectElement).value);
        build();
      },
    },
    [30, 15, 5, 1].map((n) => h('option', { value: n, selected: n === step }, n === 1 ? 'varje minut' : `var ${n}:e minut`)),
  );
  const apart = h('input', {
    type: 'checkbox',
    onchange: (e: Event) => {
      linked = !(e.target as HTMLInputElement).checked;
      build();
    },
  });
  build();
  return h(
    'section',
    null,
    h('h2', null, 'Ställ klockan'),
    h('p', { class: 'muted' }, 'Dra på urtavlan. Minutvisaren följer fingret, och timvisaren följer med.'),
    h('div', { class: 'settings' }, h('label', null, 'Minutvisaren snäpper ', steps), h('label', { class: 'check' }, apart, h('span', null, 'Visarna var för sig'))),
    slot,
    digital,
  );
}

function choicesSection(): HTMLElement {
  const options: [string, number][] = [
    ['halv fyra', 3.5],
    ['halv tre', 2.5],
    ['kvart över tre', 3.25],
    ['kvart i fyra', 3.75],
  ];
  const buttons = options.map(([name, hour]) =>
    h(
      'button',
      {
        class: 'choice',
        type: 'button',
        'aria-label': name,
        dataset: { value: name },
        onclick: (e: Event) => {
          buttons.forEach((b) => b.classList.remove('chosen'));
          (e.currentTarget as HTMLElement).classList.add('chosen');
        },
      },
      clockFace({ minute: Math.round((hour % 1) * 60), hour, label: '' }),
    ),
  );
  return h('section', null, h('h2', null, 'Svarsknappar med urtavlor'), h('p', { class: 'muted' }, 'Vilken klocka är halv fyra?'), h('div', { class: 'answer-area choices pictures' }, buttons));
}
