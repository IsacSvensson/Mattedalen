import { candidates, taskAnswer, taskId, type ClockShow, type Task } from '../../../content/clock';
import { clockFace } from '../../../shell/components/clockFace';
import { clockSetter } from '../../../shell/components/clockSetter';
import { icon } from '../../../shell/components/icons';
import { h } from '../../../shell/dom';
import { promptView } from '../../../shell/screens/session';
import { pack } from '../pack';

/**
 * One question of the tower's start check or koll (docs/PLAN-KLOCKAN.md, KL4):
 * the face without supports, then the answer and three wrong ones from the
 * known mistakes, or the hands to set. No right/wrong marks and no clock, as
 * in the other places' checks.
 */
export function askTowerTask(stage: HTMLElement, task: Task, setKey: (handler?: (e: KeyboardEvent) => void) => void, rnd: () => number = Math.random): Promise<string> {
  const item = pack.items.find((it) => it.id === taskId(task))!;
  const show = item.hints.find((x) => x.kind === 'clock')?.data as ClockShow | undefined;
  const face = show ? clockFace({ ...(show.hourOnly ? {} : { minute: show.time.m }), hour: show.time.h + show.time.m / 60, label: 'En klocka' }) : null;
  const prompt = h('div', { class: 'prompt-card card' }, promptView(item.prompt), face);

  return new Promise((resolve) => {
    let done = false;
    const answer = (value: string) => {
      if (done) return;
      done = true;
      setKey(undefined);
      // One answer: a second tap on the way to the next question counts for nothing.
      stage.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
      resolve(value);
    };
    if (task.kind === 'read' && task.form === 'stall') {
      const setter = clockSetter({ start: task.t.m === 0 && task.t.h === 12 ? 6 * 60 : 0, step: task.t.m % 30 === 0 ? 30 : task.t.m % 15 === 0 ? 15 : 5 });
      const ok = h('button', { class: 'big-button set-answer', type: 'button', onclick: () => answer(setter.value().text) }, icon('check', 'on-primary'), 'Svara');
      stage.replaceChildren(h('div', { class: 'question own-input check' }, prompt, h('div', { class: 'answer-area set-clock' }, setter.el, ok)));
      setKey((e) => (e.key === 'Enter' ? (e.preventDefault(), answer(setter.value().text)) : setter.onKey(e)));
      return;
    }
    // The answer and up to three wrong ones, the likeliest first, in a mixed order.
    const wrong = [...candidates(task)].sort((a, b) => b.weight - a.weight).slice(0, 3).map((c) => c.value);
    const options = [taskAnswer(task), ...wrong].map((v) => ({ v, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.v);
    const buttons = options.map((value) =>
      h('button', { class: `choice${/\p{L}/u.test(value) ? ` words${value.length > 6 ? ' long' : ''}` : ''}`, type: 'button', dataset: { value }, onclick: () => answer(value) }, value),
    );
    stage.replaceChildren(h('div', { class: 'question check' }, prompt, h('div', { class: 'answer-area choices' }, buttons)));
    setKey((e) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < options.length) answer(options[i]!);
    });
  });
}
