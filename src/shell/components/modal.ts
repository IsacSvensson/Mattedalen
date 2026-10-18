import { h, type Child } from '../dom';

export interface ModalOption<T extends string> {
  value: T;
  label: string;
  primary?: boolean;
}

/** A simple modal with a few choices. Resolves with the chosen value, or null if dismissed. */
export function choose<T extends string>(title: string, body: Child, options: ModalOption<T>[], { cancel = true } = {}): Promise<T | null> {
  return new Promise((resolve) => {
    const close = (value: T | null) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    const buttons = options.map((o) =>
      h('button', { class: o.primary ? 'big-button' : 'soft-button', type: 'button', onclick: () => close(o.value) }, o.label),
    );
    const overlay = h(
      'div',
      { class: 'modal-overlay', onclick: (e: Event) => e.target === overlay && close(null) },
      h(
        'div',
        { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' },
        h('h2', { id: 'modal-title' }, title),
        h('div', { class: 'modal-body' }, body),
        h(
          'div',
          { class: 'modal-buttons' },
          buttons,
          cancel ? h('button', { class: 'link-button', type: 'button', onclick: () => close(null) }, 'Avbryt') : null,
        ),
      ),
    );
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    // Focused without scrolling, so a long box shows its title first.
    buttons[0]?.focus({ preventScroll: true });
  });
}

/** Short message that disappears by itself. */
export function toast(message: string): void {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}
