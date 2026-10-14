import type { ContentPack, Item, ItemState, Unit } from '../../src/engine';
import { emptyState } from '../../src/engine';

/**
 * A tiny non-math content pack (Swedish → English words). Using it in the
 * engine tests shows that the engine works for any content.
 */
const WORDS: [string, string][] = [
  ['hund', 'dog'],
  ['katt', 'cat'],
  ['häst', 'horse'],
  ['ko', 'cow'],
  ['gris', 'pig'],
  ['får', 'sheep'],
  ['röd', 'red'],
  ['blå', 'blue'],
  ['grön', 'green'],
  ['gul', 'yellow'],
  ['vit', 'white'],
  ['svart', 'black'],
];

export function createWordPack(): ContentPack {
  const items: Item[] = WORDS.map(([sv, en], i) => ({
    id: sv,
    prompt: sv,
    answer: en,
    unitId: i < 6 ? 'animals' : 'colours',
    tags: [],
    derivedFrom: [],
    hints: [{ kind: 'text', text: `${sv} = ${en}` }],
    order: i,
  }));
  const units: Unit[] = [
    { id: 'animals', title: 'Djur', order: 0, itemIds: items.slice(0, 6).map((i) => i.id), unlockRule: { kind: 'always' } },
    {
      id: 'colours',
      title: 'Färger',
      order: 1,
      itemIds: items.slice(6).map((i) => i.id),
      unlockRule: { kind: 'previous', fraction: 0.8, minStatus: 'fluent' },
    },
  ];
  return {
    id: 'words',
    version: 1,
    title: 'Glosor',
    items,
    units,
    normalizeAnswer: (raw) => raw.trim().toLowerCase(),
    distractorCandidates: (item) => items.filter((i) => i.id !== item.id).map((i) => ({ value: i.answer, weight: 1 })),
  };
}

/** A state that has already been learnt to the given level. */
export function knownState(itemId: string, status: ItemState['status'], dueDay: string, box = 2): ItemState {
  return { ...emptyState(itemId), status, box, dueDay, introducedDay: '2025-12-01', seen: 10, correct: 10 };
}
